# OmniChat contributor guide

## Project overview

OmniChat is a Next.js 16 App Router chat interface. It supports OpenAI and
OpenAI-compatible providers, and logs conversations to MongoDB. The codebase is
TypeScript-first with React 19 and Tailwind CSS 4.

## Repository layout

- `app/`: pages, global styles, and API route handlers.
- `components/`: client-side chat, settings, sidebar, and status UI.
- `lib/`: shared server-side utilities, including MongoDB connection helpers.
- `public/`: static assets.
- `docs/plans/`: accepted implementation and design notes.

API handlers live in `app/api/*/route.ts`. Keep route-specific validation and
error handling in the handler; extract only genuinely shared logic to `lib/`.

## Development workflow

- Use pnpm; the repository pins `pnpm@11.1.0` in `package.json`.
- Install dependencies with `pnpm install`.
- Start local development with `pnpm dev`.
- Create a production build with `pnpm build`.
- Type-check with `pnpm exec tsc --noEmit`.
- The configured lint script is `pnpm lint`; verify it works after dependency
  or Next.js upgrades. There is currently no automated test suite.

Run the narrowest relevant validation first, then run a production build for
changes that affect routes, shared types, configuration, or deployment.

## Code conventions

- Use strict TypeScript; avoid `any` and keep API request/response shapes
  explicit.
- Prefer the `@/` import alias for project-root imports.
- Keep components focused and follow the existing client-component boundary
  (`"use client"`) when using browser APIs, state, or effects.
- Match the existing Tailwind styling patterns in `app/globals.css` and nearby
  components rather than introducing a second styling system.
- Use named, actionable error messages for API clients; do not expose secrets,
  connection strings, or upstream provider error payloads to the browser.

## Configuration and security

- Browser settings may contain API keys and MongoDB URIs and are sent with API
  requests. Never log, commit, render, or return those values.
- Environment-based settings include `OPENAI_API_KEY`, `MONGO_URI`, and
  `MONGO_DB` (default: `chat_logs`).
- Treat MongoDB writes as best-effort where the existing API does so: a failed
  log write should not discard a successful model response.
- Preserve support for OpenAI-compatible local endpoints when modifying model
  configuration or chat requests.

## Change discipline

- Inspect related UI, route, and shared helper code before changing an API
  contract.
- Keep user-facing changes aligned across the settings UI, API validation, and
  README when applicable.
- Do not modify unrelated work in the repository. Check `git status` before
  finishing and report any files that were already changed.
