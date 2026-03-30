# Python Sample — Flask app with touchenv

Drop-in replacement for `python-dotenv`. Shows how to migrate a Flask app from
`dotenv.load_dotenv()` to `touchenv.load()`.

## Prerequisites

- Python 3.10+
- touchenv CLI installed (`npm i -g touchenv`)

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Initialize touchenv and add secrets
touchenv init
touchenv set FLASK_SECRET_KEY "super-secret-flask-key"
touchenv set DATABASE_URL "postgres://localhost:5432/mydb"
touchenv set DEBUG "true"

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
- `requirements.txt` — Dependencies
