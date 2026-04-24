# Custodial Wallet Security Documentation

## Overview

This document outlines the security considerations, risks, and mitigations for the custodial wallet implementation in the MentorMinds platform.

## Design Decision

The platform implements a **custodial wallet model** where private keys are generated server-side and stored encrypted in the database. This design choice prioritizes user experience (no key management burden) over full decentralization.

## Security Architecture

### Encryption

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Authentication**: Built-in authentication tag prevents tampering
- **Salt**: 64-byte random salt per encryption
- **IV**: 16-byte random initialization vector per encryption

### Storage Format

```
encrypted_secret_key = salt:iv:authTag:ciphertext
```

All components are base64-encoded and separated by colons.

## Risks and Mitigations

### Risk 1: Database Compromise

**Risk**: If an attacker gains access to the database, they can extract encrypted private keys.

**Mitigations**:
- Encryption keys stored separately from database (environment variables or KMS)
- Database access restricted with principle of least privilege
- Database encryption at rest
- Regular security audits and penetration testing
- Intrusion detection systems
- Database activity monitoring

### Risk 2: Encryption Key Compromise

**Risk**: If the encryption key is compromised, all user funds are at risk.

**Mitigations**:
- Key rotation capability (re-encrypt all secrets with new key)
- KMS/HSM integration for key management (recommended for production)
- Key access logging and monitoring
- Multi-factor authentication for key access
- Key stored in secure environment (AWS Secrets Manager, HashiCorp Vault)

### Risk 3: Single Point of Failure

**Risk**: Platform becomes a single point of failure for user funds.

**Mitigations**:
- High availability architecture
- Regular backups with encryption
- Disaster recovery procedures
- Non-custodial option available for advanced users
- Insurance coverage for custodial funds (recommended)

### Risk 4: Regulatory Compliance

**Risk**: Custodial wallets may require money transmitter licenses or other regulatory compliance.

**Mitigations**:
- Legal review of custodial model
- Compliance with FinCEN, MiCA, or local regulations
- KYC/AML procedures
- Transaction monitoring
- Regular compliance audits

## Security Controls

### 1. API Response Filtering

The `encrypted_secret_key` column is **explicitly excluded** from all API responses:

```typescript
// CORRECT: Only select public information
SELECT wallet_id, public_key, custodial, created_at
FROM wallets
WHERE user_id = $1

// WRONG: Never select encrypted_secret_key in API queries
SELECT * FROM wallets  // ❌ Exposes encrypted secrets
```

### 2. Logging Exclusion

Encrypted secrets must never appear in logs:

```typescript
// CORRECT: Log only public information
logger.info('Wallet created', { walletId, publicKey, custodial });

// WRONG: Never log encrypted secrets
logger.info('Wallet created', { wallet });  // ❌ May contain secrets
```

### 3. Internal-Only Access

The `getDecryptedSecret()` function is marked `@internal` and should never be exposed through an API endpoint:

```typescript
// CORRECT: Internal use only for transaction signing
const secret = await getDecryptedSecret(userId);
const keypair = Keypair.fromSecret(secret);
const signedTx = keypair.sign(transaction);

// WRONG: Never expose through API
app.get('/api/wallet/secret', async (req, res) => {  // ❌ Security vulnerability
  const secret = await getDecryptedSecret(req.user.id);
  res.json({ secret });
});
```

### 4. Key Rotation

Regular key rotation (recommended every 90 days):

```typescript
// Rotate encryption keys
const result = await rotateEncryptionKeys(oldKey, newKey);
console.log(`Rotated ${result.walletsRotated} wallets`);
```

## Production Recommendations

### 1. Use KMS/HSM

Replace application-level encryption with a Key Management Service:

**AWS KMS**:
```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'us-east-1' });

async function encryptWithKMS(plaintext: string): Promise<string> {
  const command = new EncryptCommand({
    KeyId: process.env.KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext),
  });
  const response = await kms.send(command);
  return Buffer.from(response.CiphertextBlob!).toString('base64');
}
```

**HashiCorp Vault**:
```typescript
import * as vault from 'node-vault';

const vaultClient = vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
});

async function encryptWithVault(plaintext: string): Promise<string> {
  const result = await vaultClient.write('transit/encrypt/wallet-keys', {
    plaintext: Buffer.from(plaintext).toString('base64'),
  });
  return result.data.ciphertext;
}
```

### 2. Implement Non-Custodial Option

Provide a non-custodial path for users who want full control:

```typescript
// User provides their own public key
await registerNonCustodialWallet(userId, userPublicKey);

// User signs transactions with their own wallet (Freighter, Albedo, etc.)
```

### 3. Add Monitoring and Alerting

- Monitor all decryption operations
- Alert on unusual patterns (bulk decryptions, failed attempts)
- Log all wallet operations for audit trail
- Implement rate limiting on sensitive operations

### 4. Insurance and Legal

- Obtain insurance coverage for custodial funds
- Legal review of terms of service
- Compliance with local regulations
- Clear disclosure to users about custodial nature

## Security Checklist

Before deploying to production:

- [ ] Security review completed and approved
- [ ] KMS/HSM integration implemented
- [ ] Key rotation procedure tested
- [ ] API responses verified to exclude encrypted secrets
- [ ] Logging verified to exclude sensitive data
- [ ] Monitoring and alerting configured
- [ ] Disaster recovery procedures documented
- [ ] Legal review completed
- [ ] Regulatory compliance verified
- [ ] Insurance coverage obtained (if applicable)
- [ ] Penetration testing completed
- [ ] User disclosure and consent implemented

## Incident Response

In case of suspected key compromise:

1. **Immediate**: Rotate encryption keys using `rotateEncryptionKeys()`
2. **Notify**: Inform affected users
3. **Investigate**: Determine scope of compromise
4. **Remediate**: Address vulnerability
5. **Monitor**: Watch for suspicious activity
6. **Report**: File required regulatory reports

## Alternative Architectures

### Non-Custodial (Recommended)

Users manage their own keys using browser wallets (Freighter, Albedo):

**Pros**:
- No platform liability for lost funds
- True decentralization
- No regulatory burden

**Cons**:
- Higher user friction
- Users can lose keys
- More complex UX

### Hybrid Model

Offer both custodial (for beginners) and non-custodial (for advanced users):

**Pros**:
- Best of both worlds
- User choice

**Cons**:
- More complex implementation
- Two code paths to maintain

### Multi-Party Computation (MPC)

Distribute key shares across multiple parties:

**Pros**:
- No single point of failure
- Enhanced security

**Cons**:
- Complex implementation
- Higher latency
- Requires specialized infrastructure

## References

- [NIST Cryptographic Standards](https://csrc.nist.gov/projects/cryptographic-standards-and-guidelines)
- [OWASP Cryptographic Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)
- [FinCEN Virtual Currency Guidance](https://www.fincen.gov/resources/statutes-regulations/guidance/application-fincens-regulations-certain-business-models)

## Contact

For security concerns or questions, contact:
- Security Team: security@mentorminds.dev
- Emergency: security-emergency@mentorminds.dev
