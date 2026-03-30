package touchenv

import (
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

type testVector struct {
	Name           string            `json:"name"`
	Description    string            `json:"description"`
	FormatVersion  int               `json:"format_version"`
	Encryption     string            `json:"encryption"`
	DEK            string            `json:"dek"`
	Nonce          string            `json:"nonce"`
	AAD            string            `json:"aad"`
	Plaintext      string            `json:"plaintext"`
	Encrypted      string            `json:"encrypted"`
	EncryptedB64   string            `json:"encrypted_base64"`
	Env            map[string]string `json:"env"`
}

type vectorFile struct {
	Vectors []testVector `json:"vectors"`
}

func loadVectors(t *testing.T) []testVector {
	t.Helper()
	path := filepath.Join("..", "..", "spec", "test-vectors", "all-vectors.json")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("failed to read test vectors: %v", err)
	}
	var vf vectorFile
	if err := json.Unmarshal(data, &vf); err != nil {
		t.Fatalf("failed to parse test vectors: %v", err)
	}
	return vf.Vectors
}

func TestDecryptVectors(t *testing.T) {
	vectors := loadVectors(t)

	for _, v := range vectors {
		t.Run(v.Name, func(t *testing.T) {
			encrypted, err := hex.DecodeString(v.Encrypted)
			if err != nil {
				t.Fatalf("invalid hex in encrypted field: %v", err)
			}

			plaintext, err := decodeEncrypted(encrypted, v.DEK)
			if err != nil {
				t.Fatalf("decodeEncrypted failed: %v", err)
			}

			if plaintext != v.Plaintext {
				t.Errorf("plaintext mismatch:\ngot:  %q\nwant: %q", plaintext, v.Plaintext)
			}
		})
	}
}

func TestParseVectors(t *testing.T) {
	vectors := loadVectors(t)

	for _, v := range vectors {
		t.Run(v.Name, func(t *testing.T) {
			env := parse(v.Plaintext)

			if len(env) != len(v.Env) {
				t.Errorf("key count mismatch: got %d, want %d", len(env), len(v.Env))
			}

			for key, want := range v.Env {
				got, ok := env[key]
				if !ok {
					t.Errorf("missing key %q", key)
					continue
				}
				if got != want {
					t.Errorf("key %q: got %q, want %q", key, got, want)
				}
			}
		})
	}
}

func TestRoundTrip(t *testing.T) {
	vectors := loadVectors(t)

	for _, v := range vectors {
		t.Run(v.Name, func(t *testing.T) {
			encrypted, err := hex.DecodeString(v.Encrypted)
			if err != nil {
				t.Fatalf("invalid hex: %v", err)
			}

			plaintext, err := decodeEncrypted(encrypted, v.DEK)
			if err != nil {
				t.Fatalf("decrypt failed: %v", err)
			}

			env := parse(plaintext)

			for key, want := range v.Env {
				got, ok := env[key]
				if !ok {
					t.Errorf("missing key %q after round-trip", key)
					continue
				}
				if got != want {
					t.Errorf("key %q after round-trip: got %q, want %q", key, got, want)
				}
			}
		})
	}
}

func TestEncryptDecryptRoundTrip(t *testing.T) {
	keyHex := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	plaintext := "FOO=bar\nBAZ=qux\n"

	data, err := encodeEncrypted(plaintext, keyHex, nil)
	if err != nil {
		t.Fatalf("encodeEncrypted failed: %v", err)
	}

	got, err := decodeEncrypted(data, keyHex)
	if err != nil {
		t.Fatalf("decodeEncrypted failed: %v", err)
	}

	if got != plaintext {
		t.Errorf("round-trip mismatch: got %q, want %q", got, plaintext)
	}
}

func TestLoadSetsEnvVars(t *testing.T) {
	keyHex := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	plaintext := "TOUCHENV_TEST_VAR=hello_world\n"

	data, err := encodeEncrypted(plaintext, keyHex, nil)
	if err != nil {
		t.Fatalf("encodeEncrypted failed: %v", err)
	}

	// Write to temp file
	tmpDir := t.TempDir()
	tmpFile := filepath.Join(tmpDir, ".env.encrypted")
	if err := os.WriteFile(tmpFile, data, 0600); err != nil {
		t.Fatalf("writing temp file: %v", err)
	}

	// Set the key and load
	t.Setenv("TOUCHENV_KEY", keyHex)
	t.Setenv("TOUCHENV_TEST_VAR", "") // clear first

	if err := Load(tmpFile); err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	got := os.Getenv("TOUCHENV_TEST_VAR")
	if got != "hello_world" {
		t.Errorf("TOUCHENV_TEST_VAR: got %q, want %q", got, "hello_world")
	}
}

func TestLoadNoKeyError(t *testing.T) {
	t.Setenv("TOUCHENV_KEY", "")
	err := Load()
	if err == nil {
		t.Error("expected error when TOUCHENV_KEY is not set")
	}
}

func TestDecodeInvalidMagic(t *testing.T) {
	data := make([]byte, 35)
	_, err := decodeEncrypted(data, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	if err == nil {
		t.Error("expected error for invalid magic bytes")
	}
}

func TestDecodeFileTooSmall(t *testing.T) {
	data := make([]byte, 10)
	_, err := decodeEncrypted(data, "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	if err == nil {
		t.Error("expected error for file too small")
	}
}

func TestParseKey(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
	}{
		{"valid", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", false},
		{"too short", "0123", true},
		{"invalid hex", "zzzz456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parseKey(tt.input)
			if (err != nil) != tt.wantErr {
				t.Errorf("parseKey(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
		})
	}
}

func TestPublicAPI(t *testing.T) {
	// Test Decrypt
	vectors := loadVectors(t)
	v := vectors[0] // basic

	encrypted, _ := hex.DecodeString(v.Encrypted)
	plaintext, err := Decrypt(encrypted, v.DEK)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}
	if plaintext != v.Plaintext {
		t.Errorf("Decrypt: got %q, want %q", plaintext, v.Plaintext)
	}

	// Test Parse
	env := Parse(plaintext)
	for key, want := range v.Env {
		got, ok := env[key]
		if !ok {
			t.Errorf("Parse: missing key %q", key)
			continue
		}
		if got != want {
			t.Errorf("Parse key %q: got %q, want %q", key, got, want)
		}
	}
}
