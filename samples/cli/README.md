# CLI Sample — Shell script demonstrating touchenv commands

Shows the full touchenv CLI workflow: initialize, set secrets, query them,
edit interactively, and decrypt for piping.

## Prerequisites

- Node.js 18+
- touchenv CLI installed (`npm i -g touchenv`)

## Quick Start

```bash
# Run the demo script
./demo.sh
```

## Commands Demonstrated

| Command | Description |
|---------|-------------|
| `touchenv init` | Generate DEK, store in Keychain, create `.env.encrypted` |
| `touchenv set KEY VALUE` | Add or update a secret |
| `touchenv get KEY` | Retrieve a single secret |
| `touchenv list` | List all secret names |
| `touchenv list -v` | List secrets with values |
| `touchenv edit` | Open decrypted secrets in `$EDITOR` |
| `touchenv decrypt` | Dump plaintext to stdout (for piping) |

## CI/CD Usage

In CI, export the DEK and all commands work without a keychain:

```bash
export TOUCHENV_KEY="your-64-char-hex-dek"
touchenv get DATABASE_URL   # Works without macOS Keychain
```

## Migration from .env

```bash
# 1. Initialize touchenv in your project
touchenv init

# 2. Import your existing .env
while IFS='=' read -r key value; do
  [[ -z "$key" || "$key" == \#* ]] && continue
  touchenv set "$key" "$value"
done < .env

# 3. Verify
touchenv list -v

# 4. Remove plaintext .env
rm .env
echo ".env" >> .gitignore
```

## Files

- `demo.sh` — Interactive demo of all CLI commands
