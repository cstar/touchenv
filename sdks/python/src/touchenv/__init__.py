"""touchenv — drop-in replacement for python-dotenv with encrypted .env files."""

from __future__ import annotations

import os
import warnings
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
_PLAINTEXT_FALLBACK = ".env"

_MIGRATION_WARNING = (
    "[touchenv] .env.encrypted not found, falling back to plaintext .env file. "
    "Run `touchenv init` to encrypt your .env file for secure storage."
)


def _resolve_env_file(
    path: str | Path | None = None,
) -> tuple[Path, bool]:
    """Resolve the env file to read.

    Returns (filepath, encrypted) — encrypted is True for .env.encrypted,
    False for plaintext .env fallback.
    """
    if path is not None:
        return Path(path), True

    enc_path = Path(_DEFAULT_PATH)
    if enc_path.exists():
        return enc_path, True

    plain_path = Path(_PLAINTEXT_FALLBACK)
    if plain_path.exists():
        warnings.warn(_MIGRATION_WARNING, stacklevel=3)
        return plain_path, False

    # Neither exists — return encrypted path for normal "file not found" error
    return enc_path, True


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

    Falls back to plaintext .env if .env.encrypted is missing.
    Does NOT modify os.environ.
    """
    filepath, encrypted = _resolve_env_file(path)

    if encrypted:
        dek = key or _get_key()
        data = filepath.read_bytes()
        plaintext = decode_encrypted(data, dek)
        return parse(plaintext)

    plaintext = filepath.read_text(encoding="utf-8")
    return parse(plaintext)


def load(
    path: str | Path | None = None,
    key: str | None = None,
    override: bool = False,
) -> dict[str, str]:
    """Decrypt, parse, and load an .env.encrypted file into os.environ.

    Falls back to plaintext .env if .env.encrypted is missing.
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
