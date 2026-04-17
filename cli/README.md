# @escapevelocityoperations/touchenv

Encrypted `.env` file manager. Encrypt environment variables at rest with
AES-256-GCM and unlock them via the macOS login Keychain or a CI-friendly
environment variable.

## Install

```bash
npm install -g @escapevelocityoperations/touchenv
```

macOS installs include a notarized Swift helper (`touchenv-keychain`) for
login-keychain access. Linux/CI users set `TOUCHENV_KEY` instead.

## Quick start

```bash
# Initialize (creates DEK, stores in login Keychain on macOS)
touchenv init

# Set variables
touchenv set DATABASE_URL "postgres://localhost:5432/mydb"
touchenv set API_KEY "sk-secret-key"

# Read
touchenv list
touchenv get DATABASE_URL

# Edit interactively (opens $EDITOR)
touchenv edit

# Decrypt to stdout
touchenv decrypt
```

## CI/CD

Set `TOUCHENV_KEY` (64-char hex) to bypass Keychain:

```bash
export TOUCHENV_KEY="<64-char hex DEK>"
touchenv init     # uses TOUCHENV_KEY, no Keychain store
touchenv decrypt  # uses TOUCHENV_KEY
```

## SDKs

Load encrypted values in your app with a drop-in dotenv replacement:

- **Node.js**: [`@escapevelocityoperations/touchenv-node`](https://www.npmjs.com/package/@escapevelocityoperations/touchenv-node)
- **Python**: [`touchenv`](https://github.com/cstar/touchenv/releases) (GitHub Releases)
- **Go**: `github.com/cstar/touchenv-go`

## Security model

- AES-256-GCM, 96-bit nonce regenerated on every write
- DEK lives in the user's login Keychain
  (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`) — encrypted at rest,
  session-unlock gated, not synced via iCloud
- Helper binary is signed with Developer ID + hardened runtime + notarized

See the repo's [`spec/SECURITY.md`](https://github.com/cstar/touchenv/blob/main/spec/SECURITY.md)
for full threat model and cryptographic details.

## Links

- Repository: https://github.com/cstar/touchenv
- Getting started: https://github.com/cstar/touchenv/blob/main/docs/getting-started.md
- Migration from dotenv: https://github.com/cstar/touchenv/blob/main/docs/migration-from-dotenv.md
- CI integration: https://github.com/cstar/touchenv/blob/main/docs/ci-integration.md

## License

MIT
