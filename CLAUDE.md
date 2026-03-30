# touchenv

Encrypted `.env` file manager. Encrypts environment variables at rest using
AES-256-GCM, with the DEK stored in macOS Keychain (Secure Enclave) or
supplied via `TOUCHENV_KEY` for CI.

## Repository Structure

```
touchenv/
├── spec/                   # Specifications
│   ├── FORMAT.md           # Binary file format (.env.encrypted)
│   └── test-vectors/       # Cross-language test vectors (JSON)
├── cli/                    # TypeScript CLI (Node.js)
│   ├── src/
│   │   ├── crypto.ts       # AES-256-GCM encrypt/decrypt
│   │   ├── format.ts       # .env.encrypted read/write
│   │   ├── parser.ts       # dotenv-compatible parser
│   │   └── commands/       # CLI commands (init, edit, set, get, list, decrypt)
│   ├── test/
│   ├── package.json
│   └── tsconfig.json
├── swift/                  # touchenv-keychain macOS binary
│   ├── Package.swift
│   ├── Sources/touchenv-keychain/
│   └── Tests/touchenv-keychainTests/
├── sdks/
│   ├── node/               # @cstar/touchenv-node — drop-in for dotenv
│   ├── python/             # touchenv — drop-in for python-dotenv
│   └── go/                 # touchenv-go — drop-in for godotenv
└── .github/workflows/      # CI
```

## Development

### CLI (TypeScript)

```bash
cd cli
npm install
npm run build
npm test
```

### Swift Binary

```bash
cd swift
swift build
swift test
```

### Test Vectors

```bash
cd spec/test-vectors
node generate.mjs
```

## Definition of Done

Before submitting work:

1. **Build**: `cd cli && npm run build` (must pass)
2. **Test**: `cd cli && npm test` (must pass)
3. **Lint**: `cd cli && npm run lint` (must pass, if configured)
4. **Swift**: `cd swift && swift build && swift test` (must pass, if touching swift/)
5. **Vectors**: test against `spec/test-vectors/*.json` when modifying crypto/format code

## Key Concepts

- **DEK**: 256-bit Data Encryption Key, hex-encoded (64 chars)
- **Keychain**: macOS Keychain with Secure Enclave biometrics via `touchenv-keychain`
- **TOUCHENV_KEY**: env var override for CI/headless (hex DEK)
- **Format**: binary `.env.encrypted` — see `spec/FORMAT.md` for exact layout
- **.env parsing**: standard dotenv rules — see FORMAT.md "Parsing Rules" section

## Conventions

- Commit messages: `type: description (issue-id)` — types: feat, fix, refactor, test, docs, chore
- TypeScript: strict mode, no `any`
- Tests: co-located in `test/` directories, run against test vectors for crypto code
- Cross-language compatibility: all SDKs must pass the same test vector suite
