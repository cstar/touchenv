# Python Sample — Flask app with touchenv

Drop-in replacement for `python-dotenv`. Shows how to migrate a Flask app from
`dotenv.load_dotenv()` to `touchenv.load()`.

This sample consumes the SDK via an **editable install** (`-e ../../sdks/python`)
so it runs against the local source — no PyPI/release URL needed.

## Prerequisites

- Python 3.10+
- CLI built locally: `cd ../../cli && npm install && npm run build`

## Quick Start

```bash
# 1. Install dependencies (editable install of local SDK)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Initialize touchenv and add secrets (use local CLI build)
../../cli/dist/cli.js init
../../cli/dist/cli.js set FLASK_SECRET_KEY "super-secret-flask-key"
../../cli/dist/cli.js set DATABASE_URL "postgres://localhost:5432/mydb"
../../cli/dist/cli.js set DEBUG "true"

# 3. Run the app
python app.py
# → Running on http://localhost:5000
```

## Migration from python-dotenv

**Before** (python-dotenv):

```python
from dotenv import load_dotenv
load_dotenv()
```

**After** (touchenv — one-line change):

```python
from touchenv import load
load()
```

Same API, encrypted at rest.

## CI/CD

Set `TOUCHENV_KEY` in your CI environment:

```bash
export TOUCHENV_KEY="your-64-char-hex-dek"
python app.py
```

## Files

- `app.py` — Flask server using touchenv
- `requirements.txt` — Dependencies (SDK via `-e ../../sdks/python`)
