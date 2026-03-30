# touchenv Encrypted File Format

**Version**: 1
**Extension**: `.env.encrypted`
**Encryption**: AES-256-GCM

## Overview

touchenv encrypts `.env` files at rest using AES-256-GCM with a 256-bit Data
Encryption Key (DEK). The DEK is stored in the macOS Keychain (protected by
Secure Enclave biometrics) or supplied via the `TOUCHENV_KEY` environment
variable for headless/CI contexts.

## File Layout

All multi-byte integers are **big-endian**. The file is a single contiguous
binary blob:

```
Offset  Size       Field
──────  ─────────  ─────────────────────────
0       6          magic       "TENV\x00\x01"
6       1          version     0x01
7       12         nonce       random IV (unique per write)
19      *          ciphertext  AES-256-GCM encrypted payload
EOF-16  16         tag         GCM authentication tag
```

**Total overhead**: 35 bytes (6 magic + 1 version + 12 nonce + 16 tag).

### Magic Bytes

```
0x54 0x45 0x4E 0x56 0x00 0x01
 T    E    N    V   \0   \1
```

The magic includes a format version in the last two bytes (`\x00\x01` = format
version 1). This is distinct from the `version` byte at offset 6, which tracks
the encryption parameter version.

### Version Byte

| Value | Meaning                          |
|-------|----------------------------------|
| 0x01  | AES-256-GCM, 12-byte nonce, raw DEK |

Future versions may change KDF parameters or cipher. Readers MUST reject
unknown versions.

### Nonce

12 bytes of cryptographically random data, generated fresh on every write.
Used as the IV for AES-256-GCM. MUST be unique per encryption operation with
the same key.

### Ciphertext

The plaintext is the **UTF-8 encoded `.env` file content** (no transformation,
no compression). The ciphertext length is `file_size - 35` bytes.

### Authentication Tag

16-byte GCM tag. Covers the ciphertext AND the **Additional Authenticated Data
(AAD)**: the 7-byte header (`magic + version`). This binds the tag to the
format version, preventing downgrade attacks.

## Encryption

```
AAD       = magic || version                (7 bytes)
nonce     = random(12)                      (12 bytes)
plaintext = read_utf8(".env")
(ciphertext, tag) = AES-256-GCM-Encrypt(key=DEK, nonce, AAD, plaintext)
output    = magic || version || nonce || ciphertext || tag
```

## Decryption

```
magic     = input[0..6]                     → verify == "TENV\x00\x01"
version   = input[6]                        → verify == 0x01
nonce     = input[7..19]
ciphertext = input[19..len-16]
tag       = input[len-16..len]
AAD       = magic || version                (7 bytes)
plaintext = AES-256-GCM-Decrypt(key=DEK, nonce, AAD, ciphertext, tag)
```

If decryption fails (wrong key, tampered file), implementations MUST return an
error. MUST NOT return partial plaintext.

## Key Management

### DEK (Data Encryption Key)

- **Length**: 32 bytes (256 bits)
- **Generation**: `crypto.randomBytes(32)` or equivalent CSPRNG
- **Encoding**: hex-encoded when stored or transmitted as text (64 hex chars)
- **Storage**: macOS Keychain (primary) or `TOUCHENV_KEY` env var (CI)

### Keychain Storage (macOS)

The DEK is stored via the `touchenv-keychain` Swift binary:

- **Service**: `com.touchenv`
- **Account**: absolute path to the project directory
- **Access Control**: `kSecAccessControlBiometryCurrentSet` (Secure Enclave)
- **Encoding**: hex string

### TOUCHENV_KEY Environment Variable

For CI/CD and headless environments, the DEK can be supplied directly:

```bash
export TOUCHENV_KEY="<64-char hex string>"
```

When `TOUCHENV_KEY` is set, the CLI skips Keychain access entirely.

## .env Plaintext Format

The decrypted plaintext follows standard dotenv conventions:

```bash
# Comments start with #
KEY=value
QUOTED="value with spaces"
SINGLE='literal $value'
MULTI_LINE="line1\nline2"
EMPTY=
EXPORT_PREFIX=exported    # export KEY=value also valid

# Blank lines are preserved
```

### Parsing Rules

1. Lines starting with `#` are comments (preserved on round-trip)
2. Empty lines are preserved
3. `KEY=VALUE` — no spaces around `=`
4. Unquoted values: trimmed, read until EOL
5. Double-quoted values: `\n`, `\t`, `\\`, `\"` escape sequences expanded
6. Single-quoted values: literal (no escape processing)
7. `export ` prefix is optional and stripped
8. Duplicate keys: last value wins
9. Keys: `[A-Za-z_][A-Za-z0-9_]*`

## Portable Format (v2)

Version 2 adds password-based portable files for sharing across machines
without requiring access to the Keychain or `TOUCHENV_KEY`.

### File Layout

```
Offset  Size       Field
──────  ─────────  ─────────────────────────
0       6          magic       "TENV\x00\x02"
6       1          version     0x02
7       16         salt        Argon2id salt
23      12         nonce       AES-256-GCM IV
35      *          ciphertext  encrypted payload
EOF-16  16         tag         GCM authentication tag
```

**Total overhead**: 51 bytes (6 magic + 1 version + 16 salt + 12 nonce + 16 tag).

### Key Derivation

The DEK is derived from a user-supplied password using Argon2id:

```
DEK = Argon2id(password, salt, m=65536, t=3, p=4, dkLen=32)
```

| Parameter | Value | Notes |
|-----------|-------|-------|
| `m`       | 65536 | 64 MiB memory cost |
| `t`       | 3     | 3 iterations (time cost) |
| `p`       | 4     | 4 parallel lanes |
| `dkLen`   | 32    | 256-bit output key |

### Encryption

```
salt       = random(16)
DEK        = Argon2id(password, salt, m=65536, t=3, p=4, dkLen=32)
AAD        = magic || version                (7 bytes)
nonce      = random(12)
plaintext  = read_utf8(".env")
(ciphertext, tag) = AES-256-GCM-Encrypt(key=DEK, nonce, AAD, plaintext)
output     = magic || version || salt || nonce || ciphertext || tag
```

### Decryption

```
magic      = input[0..6]                     → verify == "TENV\x00\x02"
version    = input[6]                        → verify == 0x02
salt       = input[7..23]
nonce      = input[23..35]
ciphertext = input[35..len-16]
tag        = input[len-16..len]
AAD        = magic || version                (7 bytes)
DEK        = Argon2id(password, salt, m=65536, t=3, p=4, dkLen=32)
plaintext  = AES-256-GCM-Decrypt(key=DEK, nonce, AAD, ciphertext, tag)
```

### Usage

```bash
# Export current .env.encrypted as a password-protected portable file
touchenv export -o secrets.portable

# Import a portable file (re-encrypts with local DEK)
touchenv import secrets.portable

# Decrypt portable file to stdout without re-encrypting
touchenv import secrets.portable --stdout
```

### Non-interactive Mode

For CI/headless environments, set `TOUCHENV_PASSWORD` to bypass the
interactive password prompt.
