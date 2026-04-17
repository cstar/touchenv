# Go Sample — HTTP server with touchenv-go

Drop-in replacement for `godotenv`. Shows how to migrate a Go HTTP server from
`godotenv.Load()` to `touchenv.Load()`.

This sample consumes the SDK via a `replace` directive (`../../sdks/go`)
so it runs against the local source — no module proxy needed.

## Prerequisites

- Go 1.22+
- CLI built locally: `cd ../../cli && npm install && npm run build`

## Quick Start

```bash
# 1. Fetch dependencies (replace directive points at local SDK)
go mod tidy

# 2. Initialize touchenv and add secrets (use local CLI build)
../../cli/dist/cli.js init
../../cli/dist/cli.js set PORT 8080
../../cli/dist/cli.js set DATABASE_URL "postgres://localhost:5432/mydb"
../../cli/dist/cli.js set API_SECRET "my-api-secret"

# 3. Run the server
go run main.go
# → Server listening on http://localhost:8080
```

## Migration from godotenv

**Before** (godotenv):

```go
import "github.com/joho/godotenv"
godotenv.Load()
```

**After** (touchenv — one-line change):

```go
import touchenv "github.com/cstar/touchenv-go"
touchenv.Load()
```

Same API, encrypted at rest.

## CI/CD

Set `TOUCHENV_KEY` in your CI environment:

```bash
export TOUCHENV_KEY="your-64-char-hex-dek"
go run main.go
```

## Files

- `main.go` — HTTP server using touchenv-go
- `go.mod` — Go module definition (with `replace` → `../../sdks/go`)
