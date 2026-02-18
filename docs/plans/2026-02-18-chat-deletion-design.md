# Chat Deletion Design

**Date:** 2026-02-18
**Scope:** `app/api/logs/delete/route.ts` (new), `components/Sidebar.tsx`, `app/page.tsx`

## Features

### Per-row delete (hover trash icon)
- Trash icon appears on hover (right side of each chat row)
- One click deletes that conversation immediately, no confirmation
- If the deleted chat is the active session, clear the chat area

### Bulk delete (selection mode)
- "Select" button in the sidebar header (next to "Chats" title)
- Entering selection mode: checkboxes appear on each row, clicking a row toggles checkbox (does not load chat)
- Selection mode header bar replaces normal header: shows "X selected · Delete selected · Delete all · Cancel"
- "Delete all" deletes every conversation regardless of selection
- "Cancel" exits selection mode and clears selection
- If active chat is among deleted, clear the chat area

## Backend: `POST /api/logs/delete`

New route (separate from existing `/api/logs` POST to avoid conflicts).

Request body:
```json
{ "settings": {...}, "sessionIds": ["id1", "id2"] }
```
- If `sessionIds` is present: `deleteMany({ sessionId: { $in: sessionIds } })`
- If `sessionIds` is omitted (delete all): `deleteMany({})`
- Legacy logs (no sessionId): identified by `conv.key` prefixed `"legacy-"` — not deleted by sessionId; for now delete-all covers them; individual legacy delete skipped (YAGNI)
- Returns `{ deleted: number }`

## Data flow

1. User triggers delete → Sidebar calls `POST /api/logs/delete`
2. On success → call `onDeleteChats(deletedSessionIds)` prop from `page.tsx`
3. `page.tsx` increments `historyVersion` (refreshes sidebar) and if active `sessionId` is in deleted set, calls `startNewChat()`

## Files
- `app/api/logs/delete/route.ts` — new
- `components/Sidebar.tsx` — hover trash, selection mode UI, delete API calls
- `app/page.tsx` — add `onDeleteChats` callback prop to Sidebar
