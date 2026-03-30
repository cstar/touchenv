# Migration from dotenv

touchenv is designed as a drop-in replacement for dotenv libraries. This guide
covers migrating from plain-text `.env` to encrypted `.env.encrypted` in each
supported language.

## Overview

| Step | What changes | What stays the same |
|------|-------------|---------------------|
| 1 | Install touchenv | Your env var names and values |
| 2 | Encrypt your `.env` | How you access `process.env` / `os.environ` |
| 3 | Swap one import | Your application code |
| 4 | Commit `.env.encrypted` | Your deploy workflow |

## Step 1: Install the CLI and encrypt your env file

```bash
# Install the CLI
npm install -g touchenv

# Initialize (generates DEK, stores in Keychain)
touchenv init

# Import your existing .env file
touchenv edit < .env
```

Or set variables individually:

```bash
# Read your existing .env and set each variable
while IFS='=' read -r key value; do
  [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
  touchenv set "$key" "$value"
done < .env
```

## Step 2: Swap the SDK

### Node.js (from `dotenv`)

```bash
npm uninstall dotenv
npm install @touchenv/node
```

```diff
- require('dotenv').config()
+ import { config } from '@touchenv/node';
+ config();
```

Or if you use `dotenv/config` as a preload:

```diff
- node -r dotenv/config app.js
+ TOUCHENV_KEY="..." node -r @touchenv/node/config app.js
```

The `config()` function accepts the same pattern:

| dotenv option | touchenv equivalent |
|--------------|---------------------|
| `path: '.env'` | `path: '.env.encrypted'` (default) |
| `override: true` | `override: true` |
| `encoding: 'utf8'` | Always UTF-8 |
| `debug: true` | Not yet supported |

### Python (from `python-dotenv`)

```bash
pip uninstall python-dotenv
pip install touchenv
```

```diff
- from dotenv import load_dotenv
- load_dotenv()
+ from touchenv import load
+ load()
```

| python-dotenv parameter | touchenv equivalent |
|------------------------|---------------------|
| `dotenv_path='.env'` | `path='.env.encrypted'` (default) |
| `override=True` | `override=True` |
| `verbose=True` | Not yet supported |
| `interpolate=True` | Not yet supported |

The `values()` function replaces `dotenv_values()`:

```diff
- from dotenv import dotenv_values
- env = dotenv_values()
+ from touchenv import values
+ env = values()
```

### Go (from `godotenv`)

```diff
- import "github.com/joho/godotenv"
- godotenv.Load()
+ import "github.com/<org>/touchenv-go"
+ touchenv.Load()
```

## Step 3: Update your `.gitignore`

```gitignore
# Remove .env from gitignore (or keep it for safety)
.env
.env.local

# .env.encrypted is safe to commit -- do NOT ignore it
```

## Step 4: Set up CI

Your CI pipeline needs the DEK. See [CI Integration](ci-integration.md) for
platform-specific instructions.

```bash
# Quick version: add TOUCHENV_KEY to your CI secrets
# The hex DEK is printed by:
touchenv get --dek
```

## Step 5: Remove plain-text `.env`

Once you've verified everything works:

```bash
# Double-check the encrypted file has all your variables
touchenv list

# Remove the plain-text file
rm .env

# Commit the encrypted file
git add .env.encrypted
git commit -m "chore: migrate from .env to .env.encrypted"
```

## Rollback

If you need to go back to plain-text dotenv:

```bash
# Decrypt to .env
touchenv decrypt > .env

# Revert your import change
# Reinstall dotenv
```

## FAQ

**Q: Do I need to change how I read `process.env` / `os.environ`?**
No. touchenv loads decrypted values into the environment the same way dotenv
does. Your application code doesn't change.

**Q: Can I keep a `.env` file alongside `.env.encrypted`?**
Yes, but it defeats the purpose. The SDKs read `.env.encrypted` by default.

**Q: What about `.env.example` or `.env.template`?**
Keep them. They document which variables are needed without containing real
values. touchenv doesn't affect them.

**Q: Does touchenv support variable interpolation (`${VAR}`)?**
Not yet. Values are stored and loaded literally. If you rely on interpolation,
expand variables before setting them.
