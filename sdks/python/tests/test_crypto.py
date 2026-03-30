"""Tests for AES-256-GCM crypto module."""

import pytest
from touchenv.crypto import decrypt, encrypt, parse_key


def test_parse_key_valid():
    key = parse_key("0123456789abcdef" * 4)
    assert len(key) == 32


def test_parse_key_invalid_length():
    with pytest.raises(ValueError, match="64 hex"):
        parse_key("abcd")


def test_parse_key_invalid_chars():
    with pytest.raises(ValueError, match="64 hex"):
        parse_key("g" * 64)


def test_roundtrip():
    key = bytes.fromhex("0123456789abcdef" * 4)
    aad = b"test-aad"
    plaintext = b"hello, world"
    nonce, ciphertext, tag = encrypt(key, plaintext, aad)
    result = decrypt(key, nonce, ciphertext, tag, aad)
    assert result == plaintext


def test_wrong_key_fails():
    key = bytes.fromhex("0123456789abcdef" * 4)
    wrong_key = bytes.fromhex("fedcba9876543210" * 4)
    aad = b"test-aad"
    nonce, ciphertext, tag = encrypt(key, b"secret", aad)
    with pytest.raises(Exception):
        decrypt(wrong_key, nonce, ciphertext, tag, aad)


def test_tampered_ciphertext_fails():
    key = bytes.fromhex("0123456789abcdef" * 4)
    aad = b"test-aad"
    nonce, ciphertext, tag = encrypt(key, b"secret", aad)
    tampered = bytes([ciphertext[0] ^ 0xFF]) + ciphertext[1:]
    with pytest.raises(Exception):
        decrypt(key, nonce, tampered, tag, aad)
