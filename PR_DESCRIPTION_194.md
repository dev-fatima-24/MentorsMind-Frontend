# Document and Secure Custodial Wallet Implementation

Closes #194

## Problem

The service generates a Stellar keypair server-side and stores the encrypted secret key in the database. This is a fundamental custodial wallet design where the platform holds users' private keys. If the database or encryption key is compromised, all user funds are at risk. This also means users cannot use their own existing Stellar wallets.

## Solution

Document this as a deliberate custodial design decision with comprehensive security measures:

1. Security review sign-off requirement
2. Key rotation with re-encryption capability
3. HSM/KMS integration for encryption key management
4. Non-custodial path for users with existing wallets
5. Encrypted secrets excluded from all API responses and logs

## Changes Made

### New Files
- `server/src/utils/encryption.util.ts` - AES-256-GCM encryption with PBKDF2 key derivation
- `server/src/services/wallet.service.ts` - Custodial and non-custodial wallet management
- `server/docs/CUSTODIAL_WALLET_SECURITY.md` - Comprehensive security documentation

## Features Implemented

### Encryption Utility

**Algorithm**: AES-256-GCM (Galois/Counter Mode)
- Authentication tag prevents tampering
- 64-byte random salt per encryption
- 16-byte random IV per encryption
- PBKDF2 with 100,000 iterations for key derivation

**Format**: `salt:iv:authTag:ciphertext` (all base64-encoded)

**Functions**:
- `encrypt(plaintext)` - Encrypt with current key
- `decrypt(ciphertext)` - Decrypt with current key
- `encryptWithKey(plaintext, key)` - Encrypt with specific key (for rotation)
- `decryptWithKey(ciphertext, key)` - Decrypt with specific key (for rotation)
- `generateEncryptionKey()` - Generate secure random key

### Wallet Service

**Custodial Wallet**:
```typescript
const result = await createCustodialWallet(userId);
// Returns: { publicKey, walletId, custodial: true }
// Secret key encrypted and stored in database
```

**Non-Custodial Wallet**:
```typescript
const result = await registerNonCustodialWallet(userId, userPublicKey);
// Returns: { publicKey, walletId, custodial: false }
// No secret key stored - user manages their own keys
```

**Key Rotation**:
```typescript
const result = await rotateEncryptionKeys(oldKey, newKey);
// Re-encrypts all stored secrets with new key
// Returns: { walletsRotated: number }
```

### Security Controls

**API Response Filtering**:
```sql
-- CORRECT: Only select public information
SELECT wallet_id, public_key, custodial, created_at
FROM wallets
WHERE user_id = $1

-- WRONG: Never select encrypted_secret_key
SELECT * FROM wallets  -- Exposes encrypted secrets
```

**Internal-Only Access**:
- `getDecryptedSecret()` marked `@internal`
- Never exposed through API endpoints
- Only used for transaction signing

**Logging Exclusion**:
- Encrypted secrets never logged
- Only public information in logs

## Security Documentation

Comprehensive documentation includes:

### Risk Assessment
- Database compromise
- Encryption key compromise
- Single point of failure
- Regulatory compliance

### Mitigations
- Key rotation capability
- KMS/HSM integration interface
- Non-custodial option
- High availability architecture
- Insurance recommendations

### Production Recommendations
1. Use AWS KMS, Azure Key Vault, or HashiCorp Vault
2. Implement non-custodial option as default
3. Add monitoring and alerting
4. Obtain insurance coverage
5. Legal and regulatory review

### Security Checklist
- Security review completed
- KMS/HSM integration implemented
- Key rotation tested
- API responses verified
- Logging verified
- Monitoring configured
- Disaster recovery documented
- Legal review completed
- Regulatory compliance verified
- Penetration testing completed

### Incident Response
1. Immediate: Rotate encryption keys
2. Notify affected users
3. Investigate scope
4. Remediate vulnerability
5. Monitor for suspicious activity
6. File regulatory reports

## KMS Integration Interface

```typescript
export interface KMSProvider {
  encrypt(plaintext: string, keyId: string): Promise<string>;
  decrypt(ciphertext: string, keyId: string): Promise<string>;
  rotateKey(oldKeyId: string, newKeyId: string): Promise<void>;
}
```

Example implementations provided for:
- AWS KMS
- HashiCorp Vault

## Database Schema

```sql
CREATE TABLE wallets (
  wallet_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  public_key VARCHAR(56) NOT NULL,
  encrypted_secret_key TEXT,  -- NULL for non-custodial
  custodial BOOLEAN NOT NULL,
  created_at TIMESTAMP NOT NULL,
  key_rotation_date TIMESTAMP,
  deleted_at TIMESTAMP
);

-- Ensure encrypted_secret_key is never in indexes
CREATE INDEX idx_wallets_user_id ON wallets(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_wallets_public_key ON wallets(public_key) WHERE deleted_at IS NULL;
```

## Testing

Manual testing required:
- Custodial wallet creation
- Non-custodial wallet registration
- Key rotation with multiple wallets
- API response verification (no secrets exposed)
- Log verification (no secrets logged)
- Decryption with rotated keys

## Breaking Changes

None - this is a new service implementation

## Dependencies

- `@stellar/stellar-sdk` - Already in use
- `pg` - Already in use
- `crypto` - Node.js built-in

## Production Requirements

Before deploying to production:

1. Security review and approval
2. KMS/HSM integration (AWS KMS recommended)
3. Key rotation procedure tested
4. Monitoring and alerting configured
5. Legal review completed
6. Regulatory compliance verified
7. Insurance coverage obtained (if applicable)
8. Penetration testing completed
9. Disaster recovery procedures documented
10. User disclosure and consent implemented

## Alternative Architectures

### Non-Custodial (Recommended)
Users manage their own keys using browser wallets (Freighter, Albedo)

Pros: No platform liability, true decentralization, no regulatory burden
Cons: Higher user friction, users can lose keys

### Hybrid Model
Offer both custodial (for beginners) and non-custodial (for advanced users)

Pros: Best of both worlds, user choice
Cons: More complex implementation

### Multi-Party Computation (MPC)
Distribute key shares across multiple parties

Pros: No single point of failure, enhanced security
Cons: Complex implementation, higher latency

## Notes

- This implementation prioritizes user experience over full decentralization
- Custodial model requires ongoing security maintenance
- Consider regulatory implications (FinCEN, MiCA, etc.)
- Insurance coverage recommended for custodial funds
- Non-custodial option should be the default for production
