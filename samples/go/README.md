# Go Sample — HTTP server with touchenv-go

Drop-in replacement for `godotenv`. Shows how to migrate a Go HTTP server from
`godotenv.Load()` to `touchenv.Load()`.

## Prerequisites

- Go 1.22+
- touchenv CLI installed (`npm i -g touchenv`)

## Quick Start

```bash
# 1. Initialize Go module and install
go mod tidy

# 2. Initialize touchenv and add secrets
touchenv init
touchenv set PORT 8080
touchenv set DATABASE_URL "postgres://localhost:5432/mydb"
touchenv set API_SECRET "my-api-secret"

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
- `go.mod` — Go module definition
