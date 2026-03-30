#!/usr/bin/env bash
# touchenv CLI demo — walks through all commands.
#
# Usage: ./demo.sh
#
# This script demonstrates the complete touchenv workflow:
# init → set → get → list → decrypt → edit
set -euo pipefail

DEMO_DIR=$(mktemp -d)
trap 'rm -rf "$DEMO_DIR"' EXIT
cd "$DEMO_DIR"

echo "=== touchenv CLI Demo ==="
echo "Working in: $DEMO_DIR"
echo

# --- init ---
echo "1. Initialize touchenv (creates DEK + .env.encrypted)"
touchenv init
echo

# --- set ---
echo "2. Set some environment variables"
touchenv set DATABASE_URL "postgres://localhost:5432/mydb"
touchenv set API_KEY "sk-example-api-key-12345"
touchenv set PORT "3000"
touchenv set DEBUG "true"
echo "   Set DATABASE_URL, API_KEY, PORT, DEBUG"
echo

# --- get ---
echo "3. Get a single variable"
echo "   DATABASE_URL = $(touchenv get DATABASE_URL)"
echo "   PORT = $(touchenv get PORT)"
echo

# --- list ---
echo "4. List all keys"
touchenv list
echo

echo "5. List keys with values"
touchenv list -v
echo

# --- decrypt ---
echo "6. Decrypt to stdout (pipe-friendly)"
echo "--- begin plaintext ---"
touchenv decrypt
echo "--- end plaintext ---"
echo

# --- edit ---
echo "7. Edit interactively (skipped in non-interactive mode)"
echo "   Run: touchenv edit"
echo "   Opens \$EDITOR with decrypted secrets, re-encrypts on save."
echo

echo "=== Demo complete ==="
echo
echo "Migration from .env:"
echo '  while IFS="=" read -r key value; do'
echo '    [[ -z "$key" || "$key" == \#* ]] && continue'
echo '    touchenv set "$key" "$value"'
echo "  done < .env"
