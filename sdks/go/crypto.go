package touchenv

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
)

const (
	keyLength   = 32
	nonceLength = 12
	tagLength   = 16
)

// parseKey decodes a 64-character hex string into a 32-byte AES key.
func parseKey(hexKey string) ([]byte, error) {
	if len(hexKey) != 64 {
		return nil, errors.New("DEK must be exactly 64 hex characters (256 bits)")
	}
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("invalid hex in DEK: %w", err)
	}
	return key, nil
}

// encryptGCM encrypts plaintext with AES-256-GCM.
// If nonce is nil, a random 12-byte nonce is generated.
func encryptGCM(key, plaintext, aad, nonce []byte) (resultNonce, ciphertext []byte, err error) {
	if len(key) != keyLength {
		return nil, nil, fmt.Errorf("key must be %d bytes", keyLength)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, err
	}

	if nonce == nil {
		nonce = make([]byte, nonceLength)
		if _, err := rand.Read(nonce); err != nil {
			return nil, nil, fmt.Errorf("generating nonce: %w", err)
		}
	}
	if len(nonce) != nonceLength {
		return nil, nil, fmt.Errorf("nonce must be %d bytes", nonceLength)
	}

	// GCM Seal appends the tag to ciphertext
	sealed := gcm.Seal(nil, nonce, plaintext, aad)

	return nonce, sealed, nil
}

// decryptGCM decrypts ciphertext (with appended tag) using AES-256-GCM.
func decryptGCM(key, nonce, ciphertextWithTag, aad []byte) ([]byte, error) {
	if len(key) != keyLength {
		return nil, fmt.Errorf("key must be %d bytes", keyLength)
	}
	if len(nonce) != nonceLength {
		return nil, fmt.Errorf("nonce must be %d bytes", nonceLength)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	plaintext, err := gcm.Open(nil, nonce, ciphertextWithTag, aad)
	if err != nil {
		return nil, fmt.Errorf("decryption failed: %w", err)
	}

	return plaintext, nil
}
