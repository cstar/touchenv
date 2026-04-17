# @escapevelocityoperations/touchenv-node

Node.js SDK for [touchenv](https://github.com/cstar/touchenv) — drop-in
replacement for `dotenv` that reads an encrypted `.env.encrypted` file.

## Install

```bash
npm install @escapevelocityoperations/touchenv-node
```

You also need the CLI to create and edit the encrypted file:

```bash
npm install -g @escapevelocityoperations/touchenv
touchenv init
touchenv set DATABASE_URL "postgres://localhost:5432/mydb"
```

## Usage

One-line migration from `dotenv`:

```js
// Before:
// require('dotenv').config();

// After:
const { config } = require('@escapevelocityoperations/touchenv-node');
config();

// process.env.DATABASE_URL is now populated from .env.encrypted
```

ESM:

```js
import { config } from '@escapevelocityoperations/touchenv-node';
config();
```

## API

### `config(options?)`

Loads `.env.encrypted`, decrypts it, and populates `process.env`.

```ts
config({
  path?: string;      // default: '.env.encrypted' in CWD
  override?: boolean; // default: false — don't overwrite existing vars
});
// returns { parsed: Record<string,string>, error?: Error }
```

### `parse(buffer, key)`

Low-level: decrypt a buffer with a hex DEK, returns a key/value object.

## Key resolution

The SDK resolves the DEK in this order:

1. **`options.key`** passed to `config()` / `values()`
2. **`TOUCHENV_KEY`** env var (64-char hex) — for CI/headless
3. **macOS login Keychain** — automatic, via a bundled notarized
   `touchenv-keychain` helper; account = `process.cwd()`

So on a macOS dev machine you typically need nothing beyond `touchenv init` —
`config()` pulls the DEK from Keychain on its own. If none of the sources
yields a key, `config()` returns `{ parsed: {}, error }`.

## CI/CD

```bash
export TOUCHENV_KEY="<64-char hex DEK>"
node app.js  # Keychain access bypassed, decrypt uses TOUCHENV_KEY
```

Store the DEK in your CI platform's secret store. See the repo's
[CI integration guide](https://github.com/cstar/touchenv/blob/main/docs/ci-integration.md).

## Compatibility with `dotenv`

| `dotenv` option | `touchenv-node` equivalent |
|----------------|----------------------------|
| `path: '.env'` | `path: '.env.encrypted'` (default) |
| `override: true` | `override: true` |
| `encoding: 'utf8'` | Always UTF-8 |
| `debug: true` | Not yet supported |

## Links

- Repository: https://github.com/cstar/touchenv
- CLI package: https://www.npmjs.com/package/@escapevelocityoperations/touchenv
- Migration guide: https://github.com/cstar/touchenv/blob/main/docs/migration-from-dotenv.md

## License

MIT
