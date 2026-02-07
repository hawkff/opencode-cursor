#!/usr/bin/env bash
# Sync cursor-acp models in opencode.json from cursor-agent models

set -e

CONFIG_FILE="${HOME}/.config/opencode/opencode.json"

if [[ ! -f "$CONFIG_FILE" ]]; then
  echo "Error: $CONFIG_FILE not found"
  exit 1
fi

# Make a timestamped backup before we mutate the config
BACKUP_PATH="${CONFIG_FILE}.bak.$(date +%Y%m%d-%H%M%S)"
cp "$CONFIG_FILE" "$BACKUP_PATH"
echo "Backup written to $BACKUP_PATH"

if ! command -v cursor-agent &>/dev/null; then
  echo "Error: cursor-agent not found in PATH"
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "Error: jq required but not installed"
  exit 1
fi

echo "Fetching models from cursor-agent..."
RAW_OUTPUT=$(cursor-agent models 2>&1)

# Strip ANSI codes and parse model lines
# Format: "model-id - Display Name [(current)] [(default)]"
MODELS_JSON=$(echo "$RAW_OUTPUT" | sed 's/\x1b\[[0-9;]*[a-zA-Z]//g' | \
  grep -E '^[a-z0-9.-]+ - ' | \
  while IFS= read -r line; do
    id=$(echo "$line" | sed -E 's/^([a-z0-9.-]+) - .*/\1/')
    name=$(echo "$line" | sed -E 's/^[a-z0-9.-]+ - ([^(]+).*/\1/' | sed 's/[[:space:]]*$//')
    echo "{\"$id\": {\"name\": \"$name\"}}"
  done | jq -s 'add')

if [[ -z "$MODELS_JSON" || "$MODELS_JSON" == "null" ]]; then
  echo "Error: Failed to parse models from cursor-agent"
  exit 1
fi

MODEL_COUNT=$(echo "$MODELS_JSON" | jq 'keys | length')
echo "Found $MODEL_COUNT models"

# Update the config file
UPDATED=$(jq --argjson models "$MODELS_JSON" --arg baseURL "http://127.0.0.1:32124/v1" '
  .provider["cursor-acp"].models = $models
  | .provider["cursor-acp"].options.baseURL = $baseURL
' "$CONFIG_FILE")

echo "$UPDATED" > "$CONFIG_FILE"
echo "Updated $CONFIG_FILE with $MODEL_COUNT models"

# Show first few models
echo ""
echo "Models synced:"
echo "$MODELS_JSON" | jq -r 'keys[:10][]' | sed 's/^/  - /'
if [[ $MODEL_COUNT -gt 10 ]]; then
  echo "  ... and $((MODEL_COUNT - 10)) more"
fi
