# Getting Started with touchenv

This guide walks you through installing touchenv, encrypting your first `.env`
file, and loading secrets in your application.

## Prerequisites

- **Node.js 20+** (for the CLI and Node SDK)
- **macOS** (for Keychain/Secure Enclave support) -- or set `TOUCHENV_KEY` on Linux/CI

## 1. Install the CLI

touchenv is published to [GitHub Packages](https://github.com/cstar/touchenv/packages).
You need to configure npm to use the GPR registry, then authenticate with a
GitHub personal access token (PAT) that has `read:packages` scope.

**Set up `.npmrc`:**

```ini
# ~/.npmrc (global) or .npmrc (project-level)
@touchenv:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

**Install:**

```bash
npm install -g touchenv --registry=https://npm.pkg.github.com/cstar
```

Or use it locally in your project:

```bash
npm install --save-dev touchenv --registry=https://npm.pkg.github.com/cstar
```

## 2. Initialize an encrypted env file

```bash
touchenv init
```

This does two things:

1. **Generates a DEK** (256-bit random key)
2. **Stores the DEK** in your macOS Keychain, protected by Secure Enclave
   biometrics (Touch ID)

You'll be prompted for Touch ID the first time. After that, the key is
associated with your project directory.

If you're on Linux or in CI, set `TOUCHENV_KEY` instead:

```bash
export TOUCHENV_KEY=$(openssl rand -hex 32)
touchenv init
```

## 3. Add variables

```bash
touchenv set DATABASE_URL "postgres://localhost:5432/mydb"
touchenv set API_KEY "sk-live-abc123"
touchenv set DEBUG "true"
```

Each `set` command decrypts the file, updates the variable, and re-encrypts.
The nonce is regenerated on every write.

## 4. Verify your variables

```bash
# List all keys and values
touchenv list

# Get a single value
touchenv get API_KEY

# Decrypt the entire file to stdout
touchenv decrypt
```

## 5. Edit interactively

```bash
touchenv edit
```

This decrypts to a temporary file, opens `$EDITOR`, and re-encrypts when you
save and close. The temporary file is securely deleted afterward.

## 6. Load in your application

Install the SDK for your language and replace your dotenv import.

### Node.js

With the `.npmrc` registry config from step 1 in place:

```bash
npm install @touchenv/node
```

```js
// Replace: require('dotenv').config()
import { config } from '@touchenv/node';
config();

// process.env.DATABASE_URL is now available
console.log(process.env.DATABASE_URL);
```

### Python

Install from [GitHub Releases](https://github.com/cstar/touchenv/releases):

```bash
pip install "touchenv @ https://github.com/cstar/touchenv/releases/download/python-v0.1.0/touchenv-0.1.0-py3-none-any.whl"
```

```python
# Replace: from dotenv import load_dotenv; load_dotenv()
from touchenv import load
load()

import os
print(os.environ["DATABASE_URL"])
```

### Go

```go
import touchenv "github.com/cstar/touchenv-go"

func main() {
    touchenv.Load()
    // os.Getenv("DATABASE_URL") now works
}
```

## 7. Add to `.gitignore`

Your `.env.encrypted` file **is safe to commit** -- that's the whole point.
But make sure plain-text `.env` files are still ignored:

```gitignore
# Plain-text env files (never commit these)
.env
.env.local
.env.*.local

# Encrypted env file (safe to commit)
# !.env.encrypted
```

## 8. Share the DEK with your team

For local development, each team member needs the DEK in their Keychain.
Export it and share through a secure channel (1Password, Signal, etc.):

```bash
# On the machine that has the key:
touchenv get --dek  # prints the hex DEK

# On the new machine:
export TOUCHENV_KEY="<64-char hex from above>"
touchenv init --import-key
```

For CI/CD, store the DEK as a secret in your pipeline. See
[CI Integration](ci-integration.md).

## Next Steps

- [Migration from dotenv](migration-from-dotenv.md) -- already using dotenv? Switch in minutes
- [CI Integration](ci-integration.md) -- set up your pipeline
- [Security Model](../spec/SECURITY.md) -- understand the cryptographic guarantees
