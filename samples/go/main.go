// HTTP server using touchenv-go (drop-in replacement for godotenv).
//
// Migration from godotenv:
//
//	Before: import "github.com/joho/godotenv"; godotenv.Load()
//	After:  import touchenv "github.com/cstar/touchenv-go"; touchenv.Load()
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	touchenv "github.com/cstar/touchenv-go"
)

func main() {
	// One-line migration from godotenv:
	//   Before: godotenv.Load()
	//   After:  touchenv.Load()
	if err := touchenv.Load(); err != nil {
		log.Fatalf("touchenv: failed to load secrets: %v", err)
	}

	// Read loaded secrets from environment
	env, err := touchenv.Read()
	if err != nil {
		log.Fatalf("touchenv: failed to read secrets: %v", err)
	}

	keys := make([]string, 0, len(env))
	for k := range env {
		keys = append(keys, k)
	}
	fmt.Printf("Loaded variables: %v\n", keys)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"status":      "ok",
			"loaded_keys": keys,
			"port":        port,
		})
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"database_configured":   os.Getenv("DATABASE_URL") != "",
			"api_secret_configured": os.Getenv("API_SECRET") != "",
		})
	})

	fmt.Printf("Server listening on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
