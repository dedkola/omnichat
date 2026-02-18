# Settings QOL — Design

**Date:** 2026-02-18
**Scope:** `components/SettingsModal.tsx` only (client-side, no new API routes)

## Features

### 1. LM Studio: Auto-fetch models
- When the LM Studio tab is active, auto-trigger `GET {lmstudioUrl}/v1/models`
- Also re-trigger when `lmstudioUrl` changes (debounced 600ms)
- Refresh button (rotate icon) next to the "LM Studio Model" label
- States: idle → loading (spinner) → success (dropdown) → error (message + fallback text input)
- Pre-select the saved model ID if it appears in the fetched list
- Connection status dot (green/red/grey) + text below the URL field ("Reachable" / "Unreachable" / "Checking...")

### 2. OpenAI: Fetch real model list
- When `openaiApiKey` is non-empty and OpenAI tab is active, fetch `https://api.openai.com/v1/models`
- Filter to models with ids containing `gpt`, sort alphabetically
- Debounce key-change trigger 800ms to avoid spamming while typing
- Refresh button + error fallback (show hardcoded list on failure)
- Pre-select saved model if present in fetched list

### 3. Auto-save
- Debounce all field changes, write to localStorage after 500ms of inactivity
- Show subtle "Saved" flash near the footer when auto-save fires
- Keep explicit Save button (saves + closes modal)
- Remove Cancel button (auto-save makes it redundant; X button still works)

## Approach
Option A — all client-side fetches. LM Studio supports CORS by default; OpenAI model list endpoint works from the browser.

## Files Changed
- `components/SettingsModal.tsx` — all changes contained here
