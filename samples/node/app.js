// One-line migration from dotenv:
//   Before: require('dotenv').config()
//   After:  require('@escapevelocityoperations/touchenv-node').config()
const { config } = require("@escapevelocityoperations/touchenv-node");

const { parsed, error } = config();

if (error) {
  console.error("touchenv: failed to load secrets:", error.message);
  process.exit(1);
}

console.log("Loaded variables:", Object.keys(parsed).join(", "));

const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    // Show that secrets are loaded (don't log real values in production!)
    loaded_keys: Object.keys(parsed),
    port: PORT,
  });
});

app.get("/health", (_req, res) => {
  res.json({
    database_configured: !!process.env.DATABASE_URL,
    api_key_configured: !!process.env.API_KEY,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
