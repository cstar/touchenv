package touchenv

import (
	"bytes"
	"errors"
	"fmt"
)

var magic = []byte{0x54, 0x45, 0x4e, 0x56, 0x00, 0x01} // "TENV\x00\x01"

const (
	version    = 0x01
	headerSize = 7  // magic(6) + version(1)
	overhead   = 35 // header(7) + nonce(12) + tag(16)
)

func buildHeader() []byte {
	header := make([]byte, headerSize)
	copy(header, magic)
	header[6] = version
	return header
}

// encodeEncrypted encrypts plaintext and wraps it in the .env.encrypted format.
func encodeEncrypted(plaintext string, keyHex string, nonce []byte) ([]byte, error) {
	key, err := parseKey(keyHex)
	if err != nil {
		return nil, err
	}

	header := buildHeader()
	resultNonce, sealed, err := encryptGCM(key, []byte(plaintext), header, nonce)
	if err != nil {
		return nil, err
	}

	// sealed = ciphertext || tag (Go's GCM appends tag)
	// We need: header || nonce || ciphertext || tag
	var buf bytes.Buffer
	buf.Write(header)
	buf.Write(resultNonce)
	buf.Write(sealed)
	return buf.Bytes(), nil
}

// decodeEncrypted reads a .env.encrypted binary blob and returns the plaintext.
func decodeEncrypted(data []byte, keyHex string) (string, error) {
	if len(data) < overhead {
		return "", fmt.Errorf("file too small: expected at least %d bytes, got %d", overhead, len(data))
	}

	// Validate magic
	if !bytes.Equal(data[:6], magic) {
		return "", errors.New("invalid magic bytes: not a touchenv encrypted file")
	}

	// Validate version
	if data[6] != version {
		return "", fmt.Errorf("unsupported version: 0x%02x", data[6])
	}

	header := data[:headerSize]
	nonce := data[headerSize : headerSize+nonceLength]
	ciphertextWithTag := data[headerSize+nonceLength:]

	key, err := parseKey(keyHex)
	if err != nil {
		return "", err
	}

	plaintext, err := decryptGCM(key, nonce, ciphertextWithTag, header)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
}
