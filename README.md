# touchenv

Encrypted `.env` file manager. Encrypt environment variables at rest with
AES-256-GCM and unlock them via macOS Keychain (Secure Enclave) or a CI-friendly
environment variable.

## Why touchenv?

Plain-text `.env` files are a liability. They get committed, leaked in logs, and
copied to insecure backups. touchenv replaces `.env` with `.env.encrypted` so
your secrets are encrypted at rest while your workflow stays the same.

- **AES-256-GCM** encryption with authenticated headers
- **macOS Keychain** integration (Secure Enclave biometrics) for local development
- **`TOUCHENV_KEY`** env var for CI/CD and headless servers
- **Drop-in SDKs** for Node.js, Python, and Go -- swap one import and you're done
- **Cross-language test vectors** guarantee every SDK decrypts identically

## Quick Start

```bash
# Configure npm to use GitHub Packages for @cstar packages
echo "@cstar:registry=https://npm.pkg.github.com" >> .npmrc

# Install the CLI
npm install -g @cstar/touchenv --registry=https://npm.pkg.github.com

# Initialize a new encrypted env file (generates a DEK, stores in Keychain)
touchenv init

# Set variables
touchenv set DATABASE_URL "postgres://localhost:5432/mydb"
touchenv set API_KEY "sk-secret-key"

# List variables
touchenv list

# Get a single variable
touchenv get DATABASE_URL

# Edit interactively (opens $EDITOR)
touchenv edit

# Decrypt to stdout (pipe to .env if needed)
touchenv decrypt
```

## SDK Usage

touchenv SDKs are drop-in replacements for popular dotenv libraries. Your
application reads `.env.encrypted` instead of `.env` with a one-line change.

### Node.js

Requires `.npmrc` with GPR registry (see [Getting Started](docs/getting-started.md)):

```bash
npm install @cstar/touchenv-node
```

```js
// Before:
// require('dotenv').config()

// After:
import { config } from '@cstar/touchenv-node';
config();
// process.env is now populated from .env.encrypted
```

### Python

Install from [GitHub Releases](https://github.com/cstar/touchenv/releases):

```bash
pip install "touchenv @ https://github.com/cstar/touchenv/releases/download/python-v0.1.0/touchenv-0.1.0-py3-none-any.whl"
```

```python
# Before:
# from dotenv import load_dotenv
# load_dotenv()

# After:
from touchenv import load
load()
# os.environ is now populated from .env.encrypted
```

### Go

```bash
go get github.com/cstar/touchenv-go
```

```go
// Before:
// godotenv.Load()

// After:
import touchenv "github.com/cstar/touchenv-go"
touchenv.Load()
// os.Getenv() now returns decrypted values
```

## CI/CD

Set `TOUCHENV_KEY` in your CI environment to bypass Keychain:

```bash
export TOUCHENV_KEY="<64-char hex DEK>"
```

The CLI and all SDKs check `TOUCHENV_KEY` first. When it's set, Keychain access
is skipped entirely. See [docs/ci-integration.md](docs/ci-integration.md) for
platform-specific setup (GitHub Actions, GitLab CI, etc.).

## Documentation

- [Getting Started](docs/getting-started.md) -- full walkthrough from install to production
- [Migration from dotenv](docs/migration-from-dotenv.md) -- switch from plain-text `.env` in minutes
- [CI Integration](docs/ci-integration.md) -- GitHub Actions, GitLab CI, and more
- [Security Model](spec/SECURITY.md) -- threat model, cryptographic details, and key management
- [File Format](spec/FORMAT.md) -- binary `.env.encrypted` layout

## How It Works

```
  .env (plaintext)
       │
       ▼
┌──────────────┐     ┌──────────────────┐
│ touchenv CLI │────▶│ .env.encrypted   │
│  (encrypt)   │     │ (AES-256-GCM)    │
└──────────────┘     └──────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  ┌──────────┐       ┌──────────┐       ┌──────────┐
  │ Node SDK │       │ Python   │       │ Go SDK   │
  │ config() │       │ load()   │       │ Load()   │
  └──────────┘       └──────────┘       └──────────┘
        │                   │                   │
        ▼                   ▼                   ▼
   process.env         os.environ          os.Getenv()
```

The DEK (Data Encryption Key) is stored in:
- **macOS Keychain** (local dev) -- protected by Secure Enclave biometrics
- **`TOUCHENV_KEY` env var** (CI) -- set in your pipeline's secret store

## Development

```bash
# CLI
cd cli && npm install && npm run build && npm test

# Swift binary (macOS only)
cd swift && swift build && swift test

# Test vectors
cd spec/test-vectors && node generate.mjs
```

## License

MIT
