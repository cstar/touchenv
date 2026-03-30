"""Tests for the .env.encrypted binary format."""

import pytest
from touchenv.format import decode_encrypted, encode_encrypted


def test_roundtrip():
    plaintext = "DB_HOST=localhost\nDB_PORT=5432\n"
    key_hex = "0123456789abcdef" * 4
    encrypted = encode_encrypted(plaintext, key_hex)
    result = decode_encrypted(encrypted, key_hex)
    assert result == plaintext


def test_deterministic_with_nonce():
    plaintext = "KEY=value\n"
    key_hex = "0123456789abcdef" * 4
    nonce = bytes.fromhex("aabbccddeeff00112233aabb")
    a = encode_encrypted(plaintext, key_hex, nonce=nonce)
    b = encode_encrypted(plaintext, key_hex, nonce=nonce)
    assert a == b


def test_magic_bytes():
    plaintext = "K=v\n"
    key_hex = "0123456789abcdef" * 4
    data = encode_encrypted(plaintext, key_hex)
    assert data[:6] == bytes([0x54, 0x45, 0x4E, 0x56, 0x00, 0x01])
    assert data[6] == 0x01


def test_invalid_magic():
    data = b"\x00" * 40
    with pytest.raises(ValueError, match="magic"):
        decode_encrypted(data, "0123456789abcdef" * 4)


def test_file_too_small():
    with pytest.raises(ValueError, match="too small"):
        decode_encrypted(b"short", "0123456789abcdef" * 4)


def test_wrong_key():
    plaintext = "K=v\n"
    key_hex = "0123456789abcdef" * 4
    wrong_key = "fedcba9876543210" * 4
    data = encode_encrypted(plaintext, key_hex)
    with pytest.raises(Exception):
        decode_encrypted(data, wrong_key)
