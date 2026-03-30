"""touchenv — drop-in replacement for python-dotenv with encrypted .env files."""

from __future__ import annotations

import os
from pathlib import Path

from .format import decode_encrypted, encode_encrypted
from .parser import parse

__all__ = [
    "load",
    "values",
    "decode_encrypted",
    "encode_encrypted",
    "parse",
]

_DEFAULT_PATH = ".env.encrypted"


def _find_encrypted_file(path: str | Path | None = None) -> Path:
    """Resolve the .env.encrypted file path."""
    if path is not None:
        return Path(path)
    return Path(_DEFAULT_PATH)


def _get_key() -> str:
    """Get the DEK from TOUCHENV_KEY environment variable."""
    key = os.environ.get("TOUCHENV_KEY")
    if not key:
        raise RuntimeError(
            "TOUCHENV_KEY environment variable not set. "
            "Set it to a 64-char hex DEK, or use touchenv-keychain on macOS."
        )
    return key


def values(
    path: str | Path | None = None,
    key: str | None = None,
) -> dict[str, str]:
    """Decrypt and parse an .env.encrypted file, returning the key-value pairs.

    Does NOT modify os.environ.
    """
    filepath = _find_encrypted_file(path)
    dek = key or _get_key()
    data = filepath.read_bytes()
    plaintext = decode_encrypted(data, dek)
    return parse(plaintext)


def load(
    path: str | Path | None = None,
    key: str | None = None,
    override: bool = False,
) -> dict[str, str]:
    """Decrypt, parse, and load an .env.encrypted file into os.environ.

    Drop-in replacement for python-dotenv's load_dotenv().

    Args:
        path: Path to .env.encrypted (default: .env.encrypted in cwd)
        key: Hex-encoded DEK (default: reads TOUCHENV_KEY env var)
        override: If True, overwrite existing env vars (default: False)

    Returns:
        The parsed key-value dict.
    """
    env = values(path=path, key=key)
    for k, v in env.items():
        if override or k not in os.environ:
            os.environ[k] = v
    return env
