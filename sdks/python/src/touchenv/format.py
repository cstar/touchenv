"""Read and write the .env.encrypted binary format."""

from __future__ import annotations

from .crypto import decrypt, encrypt, parse_key

# Magic bytes: "TENV\x00\x01"
MAGIC = bytes([0x54, 0x45, 0x4E, 0x56, 0x00, 0x01])

# Current encryption version
VERSION = 0x01

# Header = magic (6) + version (1) = 7 bytes
HEADER_SIZE = 7
NONCE_SIZE = 12
TAG_SIZE = 16
# Total overhead: header + nonce + tag = 35 bytes
OVERHEAD = HEADER_SIZE + NONCE_SIZE + TAG_SIZE


def _build_header() -> bytes:
    return MAGIC + bytes([VERSION])


def encode_encrypted(
    plaintext: str,
    key_hex: str,
    nonce: bytes | None = None,
) -> bytes:
    """Encode a .env plaintext into the .env.encrypted binary format."""
    key = parse_key(key_hex)
    header = _build_header()
    plain = plaintext.encode("utf-8")

    iv, ciphertext, tag = encrypt(key, plain, header, nonce)
    return header + iv + ciphertext + tag


def decode_encrypted(data: bytes, key_hex: str) -> str:
    """Decode a .env.encrypted binary buffer back to .env plaintext."""
    if len(data) < OVERHEAD:
        raise ValueError(
            f"File too small: expected at least {OVERHEAD} bytes, got {len(data)}"
        )

    magic = data[:6]
    if magic != MAGIC:
        raise ValueError("Invalid magic bytes: not a touchenv encrypted file")

    version = data[6]
    if version != VERSION:
        raise ValueError(f"Unsupported version: 0x{version:02x}")

    header = data[:HEADER_SIZE]
    nonce = data[HEADER_SIZE : HEADER_SIZE + NONCE_SIZE]
    ciphertext = data[HEADER_SIZE + NONCE_SIZE : len(data) - TAG_SIZE]
    tag = data[len(data) - TAG_SIZE :]

    key = parse_key(key_hex)
    plain = decrypt(key, nonce, ciphertext, tag, header)
    return plain.decode("utf-8")
