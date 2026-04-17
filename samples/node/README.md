# Node.js Sample — Express app with touchenv-node

Drop-in replacement for `dotenv`. Shows how to migrate an Express app from
`require('dotenv').config()` to `require('@escapevelocityoperations/touchenv-node').config()`.

This sample consumes the SDK via a **relative path** (`file:../../sdks/node`)
so it runs against the local source — no registry install needed.

## Prerequisites

- Node.js 20+
- CLI built locally: `cd ../../cli && npm install && npm run build`

## Quick Start

```bash
# 1. Build the local SDK (sample depends on it via file: path)
(cd ../../sdks/node && npm install && npm run build)

# 2. Install sample dependencies
npm install

# 3. Initialize touchenv and add secrets (use local CLI build)
export PATH="$PWD/../../cli/dist:$PATH"
chmod +x ../../cli/dist/cli.js
../../cli/dist/cli.js init
../../cli/dist/cli.js set PORT 3000
../../cli/dist/cli.js set DATABASE_URL "postgres://localhost:5432/mydb"
../../cli/dist/cli.js set API_KEY "sk-secret-key-example"

# 4. Run the app
node app.js
# → Server listening on http://localhost:3000
```

## Migration from dotenv

**Before** (dotenv):

```js
require('dotenv').config();
console.log(process.env.DATABASE_URL);
```

**After** (touchenv — one-line change):

```js
require('@escapevelocityoperations/touchenv-node').config();
console.log(process.env.DATABASE_URL);
```

Same API, encrypted at rest.

## CI/CD

Set `TOUCHENV_KEY` in your CI environment (the hex DEK from `touchenv decrypt`
or your keychain). The SDK reads it automatically — no keychain needed.

```bash
export TOUCHENV_KEY="your-64-char-hex-dek"
node app.js
```

## Files

- `app.js` — Express server using touchenv
- `package.json` — Dependencies (SDK via `file:../../sdks/node`)
