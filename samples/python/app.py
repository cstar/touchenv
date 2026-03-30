"""Flask app using touchenv (drop-in replacement for python-dotenv).

Migration from python-dotenv:
    Before: from dotenv import load_dotenv; load_dotenv()
    After:  from touchenv import load; load()
"""

import os
import sys

# One-line migration from python-dotenv:
#   Before: from dotenv import load_dotenv; load_dotenv()
#   After:  from touchenv import load; load()
from touchenv import load

env = load()
print(f"Loaded variables: {', '.join(env.keys())}")

from flask import Flask, jsonify

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-fallback")


@app.route("/")
def index():
    return jsonify(
        status="ok",
        loaded_keys=list(env.keys()),
        debug=os.environ.get("DEBUG", "false"),
    )


@app.route("/health")
def health():
    return jsonify(
        database_configured=bool(os.environ.get("DATABASE_URL")),
        secret_key_configured=bool(os.environ.get("FLASK_SECRET_KEY")),
    )


if __name__ == "__main__":
    debug = os.environ.get("DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=5000, debug=debug)
