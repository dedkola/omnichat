<h1 align="center">OmniChat</h1>

<p align="center">
  <b>One chat window. Every model. Every conversation, logged.</b>
</p>

<p align="center">
  A self-hostable LLM workbench for OpenAI, LM Studio, and GitHub Copilot — with a
  searchable MongoDB history and live performance telemetry baked in.
</p>

<p align="center">
  <a href="https://github.com/dedkola/omnichat/stargazers"><img src="https://img.shields.io/github/stars/dedkola/omnichat?style=flat-square&color=f5c542" alt="Stars" /></a>
  <a href="https://github.com/dedkola/omnichat/commits"><img src="https://img.shields.io/github/last-commit/dedkola/omnichat?style=flat-square&color=22c55e" alt="Last commit" /></a>
  <a href="https://github.com/dedkola/omnichat/issues"><img src="https://img.shields.io/github/issues/dedkola/omnichat?style=flat-square&color=ef4444" alt="Issues" /></a>
  <img src="https://img.shields.io/badge/license-MIT-6366f1?style=flat-square" alt="MIT" />
</p>

---

## Why OmniChat

Most chat UIs pick a provider for you and forget everything you said the moment you
reload the tab. OmniChat does the opposite:

- **Bring your own model.** OpenAI, any OpenAI-compatible local server, or GitHub Copilot.
- **Own your data.** Every question, answer, model, and timestamp lands in your MongoDB.
- **See what each answer costs.** Latency, token counts, tok/s, and DB write time after every reply.
- **No backend lock-in.** A plain Next.js app that runs on Node, Docker, Vercel, or Cloudflare Workers.

## Features

**Conversations**

- Sidebar groups messages into conversations instead of isolated rows, so you can resume a thread.
- Case-insensitive search across every logged question and answer.
- Multi-select conversations for bulk deletion, or wipe history entirely.
- GitHub-flavored Markdown with tables, task lists, and fenced code.

**Models**

- Switch between OpenAI, LM Studio / any `/v1/chat/completions` server, and the GitHub Copilot SDK.
- Model lists are discovered live for OpenAI and LM Studio.
- A persistent system instruction applies to every conversation.

**Observability**

- Status bar shows connection health, tokens/sec, LLM latency, DB write time, and token usage.
- Logging is best-effort: if MongoDB is down you still get your answer, and the bar says so.

## Quick start

You need Node.js 20+, pnpm, a MongoDB instance ([Atlas](https://www.mongodb.com/atlas) or
local), and one LLM provider.

```bash
git clone https://github.com/dedkola/omnichat.git
cd omnichat
pnpm install
pnpm dev
```

Open **http://localhost:3000** — the settings modal opens on first run.

1. **LLM Connections** — pick a provider and paste credentials.
2. **Database** — paste your MongoDB URI and hit **Test connection**.
3. **Save Settings.**

Settings live in `localStorage` and travel with each request. Nothing is persisted server-side.

## Configuration

Create `.env.local` from the included example:

```bash
cp .env.example .env.local
```

- `OPENAI_API_KEY` — OpenAI key, used when the browser doesn't supply one.
- `GITHUB_TOKEN` — Copilot SDK token. Falls back to the logged-in `gh` CLI user.
- `MONGO_URI` — MongoDB connection string. Leave unset to skip logging.
- `MONGO_DB` — database name, defaults to `chat_logs`.

Browser settings take precedence over environment variables.

## Providers

- **OpenAI** — key-based, model list fetched live. Default model `gpt-3.5-turbo`.
- **LM Studio** — defaults to `http://localhost:1234`, models read from `/v1/models`.
- **GitHub Copilot** — uses `GITHUB_TOKEN` or your `gh` session. Default model `gpt-4.1`.
  The SDK doesn't report token usage, so tok/s is unavailable for this provider.

All three share the same request contract, so the rest of the app doesn't care who answered.

## How it fits together

Browser chat UI → `POST /api/chat` → provider → best-effort insert into MongoDB → stats back to the status bar.
The sidebar reads `POST /api/logs` for history and search, and `POST /api/logs/delete` for cleanup.

- Settings, API keys, and connection strings are sent per request; never written to disk.
- Provider errors are surfaced as actionable messages without leaking credentials or upstream payloads.

## Scripts

- `pnpm dev` — start the dev server.
- `pnpm build` — production build (`output: standalone`).
- `pnpm start` — serve the production build.
- `pnpm lint` — the configured lint script.
- `pnpm exec tsc --noEmit` — strict type check.
- `pnpm deploy` / `pnpm preview` — build and ship to Cloudflare Workers via OpenNext.

## Deployment

**Vercel** — import the repository, set `OPENAI_API_KEY`, `MONGO_URI`, and `MONGO_DB`,
then deploy. No extra build configuration needed.

**Docker** — the multi-stage `Dockerfile` produces a slim standalone image running as a
non-root user.

```bash
docker compose up --build

# or manually
docker build -t omnichat .
docker run -p 3000:3000 \
  -e MONGO_URI="mongodb://host.docker.internal:27017" \
  -e MONGO_DB=chat_logs \
  omnichat
```

See `.github/workflows/docker-build.yml` for the GHCR build-and-push pipeline.

**Cloudflare Workers** — run `pnpm deploy`. `wrangler.jsonc` expects an R2 bucket named
`omnichat-opennext-cache`, a self-reference service binding for ISR, and the Images and
observability bindings that are already enabled. Add your secrets before the first request.

## API reference

<details>
<summary><code>POST /api/chat</code> — ask a model and log the exchange</summary>

```json
{
  "message": "Hello!",
  "sessionId": "optional-uuid",
  "settings": {
    "systemInstruction": "You are a helpful assistant.",
    "llm": {
      "provider": "openai",
      "openai":   { "apiKey": "sk-...", "model": "gpt-4o-mini" },
      "lmstudio": { "url": "http://localhost:1234", "model": "local-model" },
      "copilot":  { "githubToken": "ghp_...", "model": "gpt-4.1" }
    },
    "database": { "mongoUri": "mongodb://localhost:27017", "mongoDb": "chat_logs" }
  }
}
```

```json
{
  "answer": "Hi there!",
  "logged": true,
  "stats": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "llmMs": 820,
    "dbMs": 45,
    "promptTokens": 25,
    "completionTokens": 12,
    "totalTokens": 37,
    "tokensPerSecond": 14.6
  }
}
```

`tokensPerSecond` is `null` when the provider reports no completion tokens.

</details>

<details>
<summary><code>POST /api/logs</code> — history or search</summary>

Without `search`, returns the 50 most recent conversations with all of their messages.
With `search`, returns up to 200 matches across questions and answers.

```json
{
  "settings": { "database": { "mongoUri": "...", "mongoDb": "chat_logs" } },
  "search": "vector database"
}
```

Each log entry contains `sessionId`, `question`, `answer`, `model`, and `createdAt`.

</details>

<details>
<summary><code>GET /api/logs</code> — env-configured history</summary>

Returns the 50 most recent entries using `MONGO_URI` and `MONGO_DB`. Handy for scripts and
health checks; responds with an empty array when `MONGO_URI` is unset.

</details>

<details>
<summary><code>POST /api/logs/delete</code> — remove conversations</summary>

```json
{ "settings": { "database": { "mongoUri": "..." } }, "sessionIds": ["uuid-1", "uuid-2"] }
```

Omit `sessionIds`, or send an empty array, to delete all logs. Responds with the deleted count.

</details>

<details>
<summary><code>POST /api/test-db</code> — ping MongoDB</summary>

```json
{ "mongoUri": "mongodb://localhost:27017", "mongoDb": "chat_logs" }
```

Returns `{ "ok": true }` on success, or `{ "ok": false, "error": "..." }` with a `4xx`/`5xx` status.

</details>

<details>
<summary><code>POST /api/lmstudio-models</code> — discover local models</summary>

Proxies `<url>/v1/models` so the browser can list LM Studio models without CORS issues.

```json
{ "url": "http://localhost:1234" }
```

</details>

## Data model

Exchanges are written to the `logs` collection with `sessionId` (groups messages into a
conversation), `question`, `answer`, `model`, and `createdAt`.

One index covers the history grouping used by the sidebar:

```js
db.logs.createIndex({ sessionId: 1, createdAt: -1 });
```

## Project layout

```text
app/
  api/chat/                 LLM proxy, logging, telemetry
  api/logs/                 history and search
  api/logs/delete/          bulk conversation deletion
  api/lmstudio-models/      local model discovery
  api/test-db/              MongoDB connectivity check
  layout.tsx, page.tsx      app shell and chat experience
components/                 chat, settings, sidebar, status bar
lib/mongo.ts                environment-based MongoDB helper
docs/plans/                 accepted design notes
```

## Contributing

Found a sharp edge? Open an issue. Want to smooth it out? Send a PR.

```bash
git checkout -b feat/my-idea
pnpm install
pnpm exec tsc --noEmit && pnpm build
```

- One focused change per PR — feature or fix, not both.
- Keep API behavior, the settings UI, and this README in sync.
- Never log, commit, or return API keys or MongoDB URIs.
- Include screenshots or reproduction steps with UI changes.

## License

Distributed under the **MIT License**.
