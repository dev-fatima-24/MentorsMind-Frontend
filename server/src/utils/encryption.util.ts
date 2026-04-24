import * as crypto from 'crypto';

/**
 * Encryption utility using AES-256-GCM
 * 
 * PRODUCTION RECOMMENDATION:
 * Replace this with AWS KMS, HashiCorp Vault, or Azure Key Vault
 * for enterprise-grade key management.
 * 
 * Current implementation uses environment variable for encryption key,
 * which is acceptable for development but NOT recommended for production.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Get encryption key from environment or KMS
 * 
 * TODO: Replace with KMS integration in production
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable not set');
  }
  if (key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters');
  }
  return key;
}

/**
 * Derive encryption key from password using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt data using AES-256-GCM
 * 
 * Format: salt:iv:authTag:encryptedData (all base64 encoded)
 */
export async function encrypt(plaintext: string): Promise<string> {
  const masterKey = getEncryptionKey();
  return encryptWithKey(plaintext, masterKey);
}

/**
 * Encrypt with a specific key (used for key rotation)
 */
export async function encryptWithKey(plaintext: string, masterKey: string): Promise<string> {
  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from master key and salt
  const key = deriveKey(masterKey, salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  // Combine salt:iv:authTag:encrypted (all base64)
  return [
    salt.toString('base64'),
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted,
  ].join(':');
}

/**
 * Decrypt data using AES-256-GCM
 */
export async function decrypt(ciphertext: string): Promise<string> {
  const masterKey = getEncryptionKey();
  return decryptWithKey(ciphertext, masterKey);
}

/**
 * Decrypt with a specific key (used for key rotation)
 */
export async function decryptWithKey(ciphertext: string, masterKey: string): Promise<string> {
  // Split the ciphertext
  const parts = ciphertext.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid ciphertext format');
  }

  const [saltB64, ivB64, authTagB64, encrypted] = parts;

  // Decode from base64
  const salt = Buffer.from(saltB64, 'base64');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  // Derive key
  const key = deriveKey(masterKey, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  let decrypted = decipher.update(encrypted, 'base64', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Generate a secure random encryption key
 * 
 * Use this to generate ENCRYPTION_KEY for your environment
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('base64');
}

/**
 * KMS Integration Interface
 * 
 * Implement this interface to integrate with AWS KMS, Azure Key Vault,
 * or HashiCorp Vault for production use.
 */
export interface KMSProvider {
  encrypt(plaintext: string, keyId: string): Promise<string>;
  decrypt(ciphertext: string, keyId: string): Promise<string>;
  rotateKey(oldKeyId: string, newKeyId: string): Promise<void>;
}

/**
 * AWS KMS Integration Example (not implemented)
 * 
 * import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
 * 
 * export class AWSKMSProvider implements KMSProvider {
 *   private client: KMSClient;
 *   
 *   constructor() {
 *     this.client = new KMSClient({ region: process.env.AWS_REGION });
 *   }
 *   
 *   async encrypt(plaintext: string, keyId: string): Promise<string> {
 *     const command = new EncryptCommand({
 *       KeyId: keyId,
 *       Plaintext: Buffer.from(plaintext),
 *     });
 *     const response = await this.client.send(command);
 *     return Buffer.from(response.CiphertextBlob!).toString('base64');
 *   }
 *   
 *   async decrypt(ciphertext: string, keyId: string): Promise<string> {
 *     const command = new DecryptCommand({
 *       KeyId: keyId,
 *       CiphertextBlob: Buffer.from(ciphertext, 'base64'),
 *     });
 *     const response = await this.client.send(command);
 *     return Buffer.from(response.Plaintext!).toString('utf8');
 *   }
 * }
 */

export const EncryptionUtil = {
  encrypt,
  decrypt,
  encryptWithKey,
  decryptWithKey,
  generateEncryptionKey,
};
