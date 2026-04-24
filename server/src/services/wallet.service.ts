import { Keypair } from '@stellar/stellar-sdk';
import { Pool } from 'pg';
import { EncryptionUtil } from '../utils/encryption.util';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface WalletCreationResult {
  publicKey: string;
  walletId: string;
  custodial: boolean;
}

export interface WalletInfo {
  walletId: string;
  publicKey: string;
  custodial: boolean;
  createdAt: Date;
  // encrypted_secret_key is NEVER included in responses
}

/**
 * CUSTODIAL WALLET DESIGN DECISION
 * 
 * This service implements a custodial wallet model where the platform generates
 * and stores encrypted private keys on behalf of users. This design choice has
 * important security implications:
 * 
 * RISKS:
 * - If the database is compromised, encrypted keys could be exposed
 * - If the encryption key is compromised, all user funds are at risk
 * - Users do not have full control over their private keys
 * - Platform becomes a single point of failure
 * 
 * MITIGATIONS IMPLEMENTED:
 * - Encryption using industry-standard algorithms (AES-256-GCM)
 * - Key rotation support with re-encryption capability
 * - HSM/KMS integration for encryption key management
 * - Encrypted keys excluded from all API responses and logs
 * - Non-custodial option available for users with existing wallets
 * 
 * SECURITY REVIEW REQUIRED:
 * This custodial design must be reviewed and approved by security team before
 * production deployment. Consider regulatory implications (FinCEN, MiCA, etc.)
 * 
 * ALTERNATIVES:
 * - Non-custodial: Users manage their own keys (recommended for production)
 * - Hybrid: Custodial for beginners, non-custodial option for advanced users
 * - MPC: Multi-party computation for distributed key management
 */

/**
 * Create a custodial wallet (platform manages private key)
 * 
 * WARNING: This stores the encrypted private key in the database.
 * Only use this after security review and approval.
 */
export async function createCustodialWallet(userId: string): Promise<WalletCreationResult> {
  // Generate new Stellar keypair
  const keypair = Keypair.random();
  const publicKey = keypair.publicKey();
  const secret = keypair.secret();

  // Encrypt the secret key using KMS/HSM-backed encryption
  const encryptedSecret = await EncryptionUtil.encrypt(secret);

  // Store in database
  const result = await pool.query(
    `INSERT INTO wallets (user_id, public_key, encrypted_secret_key, custodial, created_at)
     VALUES ($1, $2, $3, true, NOW())
     RETURNING wallet_id, public_key, custodial`,
    [userId, publicKey, encryptedSecret]
  );

  // SECURITY: Never return the secret key or encrypted secret
  return {
    publicKey: result.rows[0].public_key,
    walletId: result.rows[0].wallet_id,
    custodial: true,
  };
}

/**
 * Register a non-custodial wallet (user provides their own public key)
 * 
 * RECOMMENDED: This is the preferred approach for production as users
 * maintain full control of their private keys.
 */
export async function registerNonCustodialWallet(
  userId: string,
  publicKey: string
): Promise<WalletCreationResult> {
  // Validate the public key format
  try {
    Keypair.fromPublicKey(publicKey);
  } catch (error) {
    throw new Error('Invalid Stellar public key format');
  }

  // Store only the public key (no secret)
  const result = await pool.query(
    `INSERT INTO wallets (user_id, public_key, encrypted_secret_key, custodial, created_at)
     VALUES ($1, $2, NULL, false, NOW())
     RETURNING wallet_id, public_key, custodial`,
    [userId, publicKey]
  );

  return {
    publicKey: result.rows[0].public_key,
    walletId: result.rows[0].wallet_id,
    custodial: false,
  };
}

/**
 * Get wallet information for a user
 * 
 * SECURITY: encrypted_secret_key is explicitly excluded from the SELECT
 */
export async function getWalletInfo(userId: string): Promise<WalletInfo | null> {
  const result = await pool.query(
    `SELECT wallet_id, public_key, custodial, created_at
     FROM wallets
     WHERE user_id = $1
     AND deleted_at IS NULL`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    walletId: result.rows[0].wallet_id,
    publicKey: result.rows[0].public_key,
    custodial: result.rows[0].custodial,
    createdAt: result.rows[0].created_at,
  };
}

/**
 * Get decrypted secret key for custodial wallet operations
 * 
 * SECURITY: This should only be called internally for transaction signing.
 * Never expose this through an API endpoint.
 * 
 * @internal
 */
export async function getDecryptedSecret(userId: string): Promise<string> {
  const result = await pool.query(
    `SELECT encrypted_secret_key, custodial
     FROM wallets
     WHERE user_id = $1
     AND deleted_at IS NULL`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new Error('Wallet not found');
  }

  if (!result.rows[0].custodial) {
    throw new Error('Cannot retrieve secret for non-custodial wallet');
  }

  const encryptedSecret = result.rows[0].encrypted_secret_key;
  if (!encryptedSecret) {
    throw new Error('No encrypted secret found for custodial wallet');
  }

  // Decrypt using KMS/HSM-backed decryption
  return await EncryptionUtil.decrypt(encryptedSecret);
}

/**
 * Rotate encryption keys and re-encrypt all stored secrets
 * 
 * This should be run periodically (e.g., every 90 days) or when
 * a key compromise is suspected.
 * 
 * @param oldEncryptionKey - The current encryption key
 * @param newEncryptionKey - The new encryption key to use
 */
export async function rotateEncryptionKeys(
  oldEncryptionKey: string,
  newEncryptionKey: string
): Promise<{ walletsRotated: number }> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get all custodial wallets with encrypted secrets
    const result = await client.query(
      `SELECT wallet_id, encrypted_secret_key
       FROM wallets
       WHERE custodial = true
       AND encrypted_secret_key IS NOT NULL
       AND deleted_at IS NULL
       FOR UPDATE`
    );

    let walletsRotated = 0;

    for (const row of result.rows) {
      try {
        // Decrypt with old key
        const secret = await EncryptionUtil.decryptWithKey(
          row.encrypted_secret_key,
          oldEncryptionKey
        );

        // Re-encrypt with new key
        const newEncryptedSecret = await EncryptionUtil.encryptWithKey(
          secret,
          newEncryptionKey
        );

        // Update in database
        await client.query(
          `UPDATE wallets
           SET encrypted_secret_key = $1,
               key_rotation_date = NOW()
           WHERE wallet_id = $2`,
          [newEncryptedSecret, row.wallet_id]
        );

        walletsRotated++;
      } catch (error) {
        console.error(`Failed to rotate key for wallet ${row.wallet_id}:`, error);
        // Continue with other wallets
      }
    }

    await client.query('COMMIT');

    return { walletsRotated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a wallet (soft delete)
 * 
 * SECURITY: Encrypted secrets are kept for audit purposes but marked as deleted.
 * Consider implementing hard delete after a retention period.
 */
export async function deleteWallet(userId: string): Promise<void> {
  await pool.query(
    `UPDATE wallets
     SET deleted_at = NOW()
     WHERE user_id = $1
     AND deleted_at IS NULL`,
    [userId]
  );
}
