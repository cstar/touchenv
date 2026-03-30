# CI Integration

touchenv uses the `TOUCHENV_KEY` environment variable to decrypt
`.env.encrypted` in CI/CD pipelines. When `TOUCHENV_KEY` is set, all Keychain
access is bypassed -- no macOS, no biometrics, no special hardware required.

## How it works

1. You store your DEK (64-character hex string) as a secret in your CI platform
2. The pipeline exports it as `TOUCHENV_KEY`
3. The touchenv CLI and SDKs detect `TOUCHENV_KEY` and use it directly

## Getting your DEK

On the machine where you initialized touchenv:

```bash
touchenv get --dek
# Prints: 0123456789abcdef...  (64 hex characters)
```

Copy this value into your CI platform's secret store.

## Installing touchenv in CI

touchenv packages are published to GitHub Packages Registry (GPR). Your CI
pipeline needs GPR auth to install the CLI and SDKs.

### npm packages (CLI and Node SDK)

Add a `.npmrc` to your repo (or generate one in CI):

```ini
@cstar:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

In GitHub Actions, `GITHUB_TOKEN` provides automatic GPR access. For other CI
platforms, create a GitHub PAT with `read:packages` scope and store it as a
secret.

### Python SDK

The Python SDK is distributed via GitHub Releases. Install directly:

```bash
pip install "touchenv @ https://github.com/cstar/touchenv/releases/download/python-v0.1.0/touchenv-0.1.0-py3-none-any.whl"
```

For private repos, authenticate with a GitHub PAT:

```bash
pip install "touchenv @ https://${GITHUB_TOKEN}@github.com/cstar/touchenv/releases/download/python-v0.1.0/touchenv-0.1.0-py3-none-any.whl"
```

### Go SDK

The Go SDK uses the standard Go module path and is fetched via the Go proxy:

```bash
go get github.com/cstar/touchenv-go
```

No additional auth is needed for public repos.

## Platform Setup

### GitHub Actions

Add `TOUCHENV_KEY` as a repository secret:

1. Go to **Settings > Secrets and variables > Actions**
2. Click **New repository secret**
3. Name: `TOUCHENV_KEY`
4. Value: your 64-char hex DEK

Use it in your workflow:

```yaml
name: CI
on: [push, pull_request]

env:
  TOUCHENV_KEY: ${{ secrets.TOUCHENV_KEY }}

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://npm.pkg.github.com"
      - run: npm install
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: npm test
      # process.env is populated from .env.encrypted automatically
```

### GitLab CI

Add the variable in **Settings > CI/CD > Variables**:

```yaml
# .gitlab-ci.yml
variables:
  TOUCHENV_KEY: $TOUCHENV_KEY  # references the CI variable

test:
  image: node:20
  script:
    - npm install
    - npm test
```

Mark the variable as **Masked** and **Protected** in the GitLab UI.

### CircleCI

Add `TOUCHENV_KEY` in **Project Settings > Environment Variables**:

```yaml
# .circleci/config.yml
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npm install
      - run: npm test
```

### Docker

Pass the key at runtime (never bake it into the image):

```bash
docker run -e TOUCHENV_KEY="$TOUCHENV_KEY" myapp
```

Or with Docker Compose:

```yaml
# docker-compose.yml
services:
  app:
    build: .
    environment:
      - TOUCHENV_KEY=${TOUCHENV_KEY}
```

### Kubernetes

Store the DEK in a Secret:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: touchenv-secret
type: Opaque
stringData:
  TOUCHENV_KEY: "<64-char hex DEK>"
```

Reference it in your deployment:

```yaml
env:
  - name: TOUCHENV_KEY
    valueFrom:
      secretKeyRef:
        name: touchenv-secret
        key: TOUCHENV_KEY
```

## Security best practices

1. **Never log the DEK.** Audit your CI config for `echo $TOUCHENV_KEY` or
   similar. Most CI platforms mask secrets in logs, but don't rely on it.

2. **Rotate the DEK periodically.** Generate a new key, re-encrypt, and update
   the CI secret:
   ```bash
   export TOUCHENV_KEY=$(openssl rand -hex 32)
   touchenv init --import-key
   # Re-encrypt existing file
   touchenv decrypt | touchenv edit
   # Update the secret in your CI platform
   ```

3. **Limit secret access.** Use branch protection or environment-scoped secrets
   so forks and untrusted branches can't read the DEK.

4. **Don't store the DEK in code.** Not in `.env`, not in `docker-compose.yml`,
   not in a config file. It belongs in your CI platform's secret store.

5. **Commit `.env.encrypted`.** The encrypted file is designed to be committed.
   Without the DEK, it's a 35-byte-overhead opaque blob.

## Troubleshooting

### `TOUCHENV_KEY environment variable not set`

The SDK or CLI can't find the key. Check:
- The secret is defined in your CI platform
- The variable name is exactly `TOUCHENV_KEY` (case-sensitive)
- The variable is available in the job's environment (not scoped to a different
  environment or branch)

### `wrong key or tampered file`

The DEK doesn't match the one used to encrypt. This usually means:
- The CI secret is stale (someone re-initialized locally with a new key)
- The `.env.encrypted` file was encrypted with a different key

Fix: re-encrypt with the correct key or update the CI secret.

### `invalid hex key`

The DEK must be exactly 64 hexadecimal characters (0-9, a-f). Check for:
- Trailing newlines (common with `echo` piping)
- Quotes included in the value
- Truncated copy-paste
