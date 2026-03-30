"""Cross-language test vector validation."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from touchenv.format import decode_encrypted, encode_encrypted
from touchenv.parser import parse

VECTORS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "spec" / "test-vectors"


def _load_vectors() -> list[dict]:
    all_vectors = VECTORS_DIR / "all-vectors.json"
    data = json.loads(all_vectors.read_text())
    return data["vectors"]


VECTORS = _load_vectors()


@pytest.mark.parametrize("vector", VECTORS, ids=[v["name"] for v in VECTORS])
def test_decrypt_vector(vector: dict):
    """Decrypt the test vector encrypted blob and verify plaintext matches."""
    encrypted_hex = vector["encrypted"]
    encrypted = bytes.fromhex(encrypted_hex)
    dek = vector["dek"]

    plaintext = decode_encrypted(encrypted, dek)
    assert plaintext == vector["plaintext"]


@pytest.mark.parametrize("vector", VECTORS, ids=[v["name"] for v in VECTORS])
def test_encrypt_deterministic(vector: dict):
    """Encrypt with the same nonce and verify output matches the vector."""
    dek = vector["dek"]
    nonce = bytes.fromhex(vector["nonce"])
    plaintext = vector["plaintext"]
    expected_hex = vector["encrypted"]

    result = encode_encrypted(plaintext, dek, nonce=nonce)
    assert result.hex() == expected_hex


@pytest.mark.parametrize("vector", VECTORS, ids=[v["name"] for v in VECTORS])
def test_parse_vector(vector: dict):
    """Parse the plaintext and verify env matches the vector."""
    plaintext = vector["plaintext"]
    expected_env = vector["env"]
    env = parse(plaintext)
    assert env == expected_env
