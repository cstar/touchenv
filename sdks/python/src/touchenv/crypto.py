"""AES-256-GCM encryption and decryption for touchenv."""

from __future__ import annotations

import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

NONCE_LENGTH = 12
TAG_LENGTH = 16
KEY_LENGTH = 32


def parse_key(hex_key: str) -> bytes:
    """Parse a hex-encoded 256-bit DEK into bytes.

    Raises ValueError if the key is not exactly 64 hex characters.
    """
    hex_key = hex_key.strip()
    if len(hex_key) != 64:
        raise ValueError("DEK must be exactly 64 hex characters (256 bits)")
    try:
        return bytes.fromhex(hex_key)
    except ValueError as exc:
        raise ValueError("DEK must be exactly 64 hex characters (256 bits)") from exc


def encrypt(
    key: bytes,
    plaintext: bytes,
    aad: bytes,
    nonce: bytes | None = None,
) -> tuple[bytes, bytes, bytes]:
    """Encrypt plaintext using AES-256-GCM.

    Returns (nonce, ciphertext, tag) where ciphertext does NOT include the tag
    (tag is separated from the AESGCM output which appends it).
    """
    if len(key) != KEY_LENGTH:
        raise ValueError(f"Key must be {KEY_LENGTH} bytes")
    iv = nonce if nonce is not None else os.urandom(NONCE_LENGTH)
    if len(iv) != NONCE_LENGTH:
        raise ValueError(f"Nonce must be {NONCE_LENGTH} bytes")

    aesgcm = AESGCM(key)
    # AESGCM.encrypt returns ciphertext || tag (tag is last 16 bytes)
    ct_with_tag = aesgcm.encrypt(iv, plaintext, aad)
    ciphertext = ct_with_tag[:-TAG_LENGTH]
    tag = ct_with_tag[-TAG_LENGTH:]
    return iv, ciphertext, tag


def decrypt(
    key: bytes,
    nonce: bytes,
    ciphertext: bytes,
    tag: bytes,
    aad: bytes,
) -> bytes:
    """Decrypt ciphertext using AES-256-GCM.

    Returns the decrypted plaintext bytes.
    Raises an exception if authentication fails.
    """
    if len(key) != KEY_LENGTH:
        raise ValueError(f"Key must be {KEY_LENGTH} bytes")
    if len(nonce) != NONCE_LENGTH:
        raise ValueError(f"Nonce must be {NONCE_LENGTH} bytes")
    if len(tag) != TAG_LENGTH:
        raise ValueError(f"Tag must be {TAG_LENGTH} bytes")

    aesgcm = AESGCM(key)
    # AESGCM.decrypt expects ciphertext || tag
    ct_with_tag = ciphertext + tag
    return aesgcm.decrypt(nonce, ct_with_tag, aad)
