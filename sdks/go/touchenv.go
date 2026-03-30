// Package touchenv provides Load() as a drop-in replacement for godotenv.Load().
//
// It reads a .env.encrypted file, decrypts it using AES-256-GCM, parses the
// dotenv content, and sets the environment variables. The decryption key is
// read from the TOUCHENV_KEY environment variable (64-char hex DEK).
package touchenv

import (
	"fmt"
	"os"
	"path/filepath"
)

const defaultFile = ".env.encrypted"

// Load reads and decrypts .env.encrypted files, then sets the parsed
// key-value pairs as environment variables. If no filenames are given,
// it defaults to ".env.encrypted" in the current directory.
//
// The DEK is read from the TOUCHENV_KEY environment variable.
// This is a drop-in replacement for godotenv.Load().
func Load(filenames ...string) error {
	if len(filenames) == 0 {
		filenames = []string{defaultFile}
	}

	keyHex := os.Getenv("TOUCHENV_KEY")
	if keyHex == "" {
		return fmt.Errorf("TOUCHENV_KEY environment variable not set")
	}

	for _, filename := range filenames {
		if err := loadFile(filename, keyHex); err != nil {
			return fmt.Errorf("loading %s: %w", filename, err)
		}
	}

	return nil
}

// Read reads and decrypts .env.encrypted files and returns the parsed
// key-value pairs without setting environment variables.
func Read(filenames ...string) (map[string]string, error) {
	if len(filenames) == 0 {
		filenames = []string{defaultFile}
	}

	keyHex := os.Getenv("TOUCHENV_KEY")
	if keyHex == "" {
		return nil, fmt.Errorf("TOUCHENV_KEY environment variable not set")
	}

	result := make(map[string]string)
	for _, filename := range filenames {
		env, err := readFile(filename, keyHex)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", filename, err)
		}
		for k, v := range env {
			result[k] = v
		}
	}

	return result, nil
}

// Decrypt decrypts a .env.encrypted binary blob and returns the raw plaintext.
func Decrypt(data []byte, keyHex string) (string, error) {
	return decodeEncrypted(data, keyHex)
}

// Parse parses dotenv-formatted text into key-value pairs.
func Parse(content string) map[string]string {
	return parse(content)
}

func loadFile(filename, keyHex string) error {
	env, err := readFile(filename, keyHex)
	if err != nil {
		return err
	}

	for k, v := range env {
		if os.Getenv(k) == "" {
			os.Setenv(k, v)
		}
	}

	return nil
}

func readFile(filename, keyHex string) (map[string]string, error) {
	path, err := filepath.Abs(filename)
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	plaintext, err := decodeEncrypted(data, keyHex)
	if err != nil {
		return nil, err
	}

	return parse(plaintext), nil
}
