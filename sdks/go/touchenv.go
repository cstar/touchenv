// Package touchenv provides Load() as a drop-in replacement for godotenv.Load().
//
// It reads a .env.encrypted file, decrypts it using AES-256-GCM, parses the
// dotenv content, and sets the environment variables. The decryption key is
// read from the TOUCHENV_KEY environment variable (64-char hex DEK).
//
// If .env.encrypted is not found but a plaintext .env exists, it falls back to
// reading .env and emits a warning suggesting migration to touchenv.
package touchenv

import (
	"fmt"
	"os"
	"path/filepath"
)

const defaultFile = ".env.encrypted"
const plaintextFallback = ".env"

const migrationWarning = "[touchenv] Warning: .env.encrypted not found, falling back to plaintext .env file. " +
	"Run `touchenv init` to encrypt your .env file for secure storage."

// Load reads and decrypts .env.encrypted files, then sets the parsed
// key-value pairs as environment variables. If no filenames are given,
// it defaults to ".env.encrypted" in the current directory.
//
// If .env.encrypted is not found but .env exists, it falls back to reading
// the plaintext .env and emits a warning.
//
// The DEK is read from the TOUCHENV_KEY environment variable.
// This is a drop-in replacement for godotenv.Load().
func Load(filenames ...string) error {
	if len(filenames) == 0 {
		filenames = []string{defaultFile}
	}

	for _, filename := range filenames {
		if err := loadFile(filename); err != nil {
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

	result := make(map[string]string)
	for _, filename := range filenames {
		env, err := readFile(filename)
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

// resolveEnvFile checks if filename exists; if not and filename is the default,
// falls back to .env plaintext. Returns (resolvedPath, encrypted, error).
func resolveEnvFile(filename string) (string, bool, error) {
	path, err := filepath.Abs(filename)
	if err != nil {
		return "", false, err
	}

	if _, err := os.Stat(path); err == nil {
		return path, true, nil
	}

	// Only try fallback for the default .env.encrypted filename
	if filepath.Base(filename) == defaultFile {
		dir := filepath.Dir(path)
		plainPath := filepath.Join(dir, plaintextFallback)
		if _, err := os.Stat(plainPath); err == nil {
			fmt.Fprintln(os.Stderr, migrationWarning)
			return plainPath, false, nil
		}
	}

	// Return original path so caller gets a normal "file not found" error
	return path, true, nil
}

func loadFile(filename string) error {
	env, err := readFile(filename)
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

func readFile(filename string) (map[string]string, error) {
	path, encrypted, err := resolveEnvFile(filename)
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	if encrypted {
		keyHex := os.Getenv("TOUCHENV_KEY")
		if keyHex == "" {
			return nil, fmt.Errorf("TOUCHENV_KEY environment variable not set")
		}
		plaintext, err := decodeEncrypted(data, keyHex)
		if err != nil {
			return nil, err
		}
		return parse(plaintext), nil
	}

	return parse(string(data)), nil
}
