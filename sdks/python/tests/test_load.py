"""Tests for the load() and values() public API."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from touchenv import load, values
from touchenv.format import encode_encrypted


KEY_HEX = "0123456789abcdef" * 4
PLAINTEXT = "DB_HOST=localhost\nDB_PORT=5432\n"


def _write_encrypted(tmpdir: Path) -> Path:
    data = encode_encrypted(PLAINTEXT, KEY_HEX)
    path = tmpdir / ".env.encrypted"
    path.write_bytes(data)
    return path


def test_values_returns_dict(tmp_path: Path):
    path = _write_encrypted(tmp_path)
    env = values(path=path, key=KEY_HEX)
    assert env == {"DB_HOST": "localhost", "DB_PORT": "5432"}


def test_load_sets_environ(tmp_path: Path):
    path = _write_encrypted(tmp_path)
    # Clean up any existing keys
    os.environ.pop("DB_HOST", None)
    os.environ.pop("DB_PORT", None)

    load(path=path, key=KEY_HEX)
    assert os.environ["DB_HOST"] == "localhost"
    assert os.environ["DB_PORT"] == "5432"

    # Cleanup
    del os.environ["DB_HOST"]
    del os.environ["DB_PORT"]


def test_load_no_override(tmp_path: Path):
    path = _write_encrypted(tmp_path)
    os.environ["DB_HOST"] = "original"

    load(path=path, key=KEY_HEX)
    assert os.environ["DB_HOST"] == "original"

    del os.environ["DB_HOST"]
    os.environ.pop("DB_PORT", None)


def test_load_override(tmp_path: Path):
    path = _write_encrypted(tmp_path)
    os.environ["DB_HOST"] = "original"

    load(path=path, key=KEY_HEX, override=True)
    assert os.environ["DB_HOST"] == "localhost"

    del os.environ["DB_HOST"]
    os.environ.pop("DB_PORT", None)
