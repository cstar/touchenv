# Security Model

This document describes the threat model, cryptographic design, and key
management strategy for touchenv.

## Goals

1. **Encryption at rest**: `.env` secrets are never stored in plaintext on disk
   or in version control
2. **Tamper detection**: any modification to the encrypted file is detected
   before secrets are loaded
3. **Minimal trust surface**: the DEK is the only secret; protect it and
   everything else follows

## Non-goals

- **Transport encryption**: touchenv does not encrypt secrets in transit (use
  TLS for that)
- **Access control**: touchenv does not manage who can read the DEK -- that's
  your Keychain, CI platform, or secrets manager
- **Key escrow/recovery**: if you lose the DEK, the encrypted file is
  unrecoverable (by design)

## Cryptographic Design

### Algorithm

**AES-256-GCM** (Galois/Counter Mode)

- 256-bit key (the DEK)
- 12-byte random nonce (regenerated on every write)
- 16-byte authentication tag
- Authenticated Additional Data (AAD): the 7-byte file header (magic + version)

### Why AES-256-GCM?

- NIST-approved, FIPS 140-2 compliant
- Authenticated encryption: provides confidentiality AND integrity in one pass
- Available in every major language's standard crypto library
- Hardware-accelerated (AES-NI) on modern CPUs

### Nonce handling

A fresh 12-byte nonce is generated from a CSPRNG on every encryption operation.
With a 96-bit nonce space, the birthday bound allows ~2^32 encryptions under the
same key before nonce collision becomes a concern. For `.env` files (edited
infrequently), this is a non-issue.

### AAD binding

The 7-byte header (6-byte magic + 1-byte version) is included as Additional
Authenticated Data. This means:

- The GCM tag covers both the ciphertext AND the header
- An attacker cannot change the version byte without invalidating the tag
- Downgrade attacks (swapping a v2 header onto v1 ciphertext) are detected

## Key Management

### Data Encryption Key (DEK)

- **Length**: 256 bits (32 bytes), hex-encoded as 64 characters
- **Generation**: `crypto.randomBytes(32)` or equivalent CSPRNG
- **Single key per project**: one DEK encrypts one `.env.encrypted` file

### Storage: macOS Keychain

On macOS, the DEK is stored in the system Keychain via the `touchenv-keychain`
Swift binary:

| Property | Value |
|----------|-------|
| Service | `com.touchenv` |
| Account | Absolute path to project directory |
| Access Control | `kSecAccessControlBiometryCurrentSet` |

**Secure Enclave protection**: the access control flag requires biometric
authentication (Touch ID / Face ID) to read the key. The key is:

- Bound to the current set of enrolled biometrics (re-enrolling a fingerprint
  invalidates access)
- Never exported from the Secure Enclave in plaintext
- Not accessible by other applications without biometric approval

### Storage: `TOUCHENV_KEY` environment variable

For CI/CD and headless environments:

- The DEK is stored in the CI platform's secret store (GitHub Secrets, GitLab
  CI Variables, etc.)
- Exported as `TOUCHENV_KEY` at runtime
- When set, all Keychain access is bypassed

**Risk**: the DEK exists in process memory and potentially in CI logs. Mitigate
by:

- Masking the variable in CI output
- Limiting secret scope to protected branches/environments
- Rotating the DEK periodically

## Threat Model

### What touchenv protects against

| Threat | Mitigation |
|--------|-----------|
| Secrets in version control | `.env.encrypted` is opaque without the DEK |
| Disk theft / backup leak | AES-256-GCM encryption at rest |
| File tampering | GCM authentication tag rejects modified files |
| Version downgrade | AAD binding detects header manipulation |
| Accidental `.env` commit | `.env.encrypted` replaces `.env` entirely |

### What touchenv does NOT protect against

| Threat | Why | Mitigation |
|--------|-----|-----------|
| Compromised DEK | If the attacker has the key, they can decrypt | Rotate keys, limit access |
| Memory scraping | Decrypted values exist in `process.env` | OS-level protections, short-lived processes |
| Malicious SDK | A compromised touchenv package could exfiltrate | Pin versions, audit dependencies |
| Side-channel attacks | AES-GCM timing varies by implementation | Use platform-provided crypto (OpenSSL, CryptoKit) |
| Multi-user access control | touchenv has one key per file, no per-user permissions | Use a secrets manager for team-scoped access |

## File Format Security Properties

See [FORMAT.md](FORMAT.md) for the full binary layout.

- **Magic bytes** identify the file type and prevent accidental misinterpretation
- **Version byte** enables future cipher upgrades; readers reject unknown versions
- **Fresh nonce per write** prevents nonce reuse
- **AAD = header** prevents header/ciphertext mix-and-match attacks
- **Tag at EOF** allows streaming reads (header + nonce + ciphertext), then
  authentication in one final step

## Key Rotation

To rotate the DEK:

```bash
# 1. Decrypt with old key
touchenv decrypt > /tmp/env-plaintext

# 2. Generate new key
export TOUCHENV_KEY=$(openssl rand -hex 32)
touchenv init --import-key

# 3. Re-encrypt with new key
touchenv edit < /tmp/env-plaintext

# 4. Securely delete plaintext
rm -P /tmp/env-plaintext  # macOS secure delete

# 5. Update CI secrets with the new TOUCHENV_KEY
```

After rotation, all previous ciphertext files are unreadable with the new key.
Keep backups if you need to access historical encrypted files.

## Recommendations

1. **Use Keychain on dev machines.** Secure Enclave biometrics are stronger than
   any env var.
2. **Rotate keys on team changes.** When someone leaves the team, generate a new
   DEK and re-encrypt.
3. **Don't log decrypted values.** Check your logging config and CI scripts.
4. **Pin SDK versions.** Audit updates before adopting them.
5. **Commit `.env.encrypted`.** That's the point -- the file is safe to commit.
6. **Never commit `.env`.** Keep it in `.gitignore` as a safety net even after
   migration.
