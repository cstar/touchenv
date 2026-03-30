# Node.js Sample — Express app with @touchenv/node

Drop-in replacement for `dotenv`. Shows how to migrate an Express app from
`require('dotenv').config()` to `require('@touchenv/node').config()`.

## Prerequisites

- Node.js 18+
- touchenv CLI installed (`npm i -g touchenv`)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Initialize touchenv and add secrets
touchenv init
touchenv set PORT 3000
touchenv set DATABASE_URL "postgres://localhost:5432/mydb"
touchenv set API_KEY "sk-secret-key-example"

# 3. Run the app
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
require('@touchenv/node').config();
console.log(process.env.DATABASE_URL);
```

That's it. Same API, encrypted at rest.

## CI/CD

Set `TOUCHENV_KEY` in your CI environment (the hex DEK from `touchenv decrypt`
or your keychain). The SDK reads it automatically — no keychain needed.

```bash
export TOUCHENV_KEY="your-64-char-hex-dek"
node app.js
```

## Files

- `app.js` — Express server using touchenv
- `package.json` — Dependencies
