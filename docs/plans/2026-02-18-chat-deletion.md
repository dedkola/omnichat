# Chat Deletion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-row hover trash delete and bulk selection mode with Delete selected / Delete all to the sidebar.

**Architecture:** New `POST /api/logs/delete` route handles deletion by sessionId array or all. Sidebar gains `selectionMode` state, hover trash icons, and a selection mode header bar. `page.tsx` gets an `onDeleteChats` callback that refreshes history and clears active chat if needed.

**Tech Stack:** Next.js App Router, React, TypeScript, MongoDB, Tailwind CSS, lucide-react

---

### Task 1: Backend — `POST /api/logs/delete` route

**Files:**
- Create: `app/api/logs/delete/route.ts`

**Step 1: Create the route file**

```ts
import { NextRequest } from "next/server";
import { MongoClient } from "mongodb";

export async function POST(req: NextRequest) {
  try {
    const { settings, sessionIds } = await req.json();
    const dbSettings = settings?.database || {};

    const mongoUri = dbSettings.mongoUri || process.env.MONGO_URI;
    const mongoDb = dbSettings.mongoDb || process.env.MONGO_DB || "chat_logs";

    if (!mongoUri) {
      return Response.json(
        { error: "MongoDB is not configured." },
        { status: 400 },
      );
    }

    const client = new MongoClient(mongoUri);
    try {
      await client.connect();
      const db = client.db(mongoDb);
      const collection = db.collection("logs");

      let result;
      if (Array.isArray(sessionIds) && sessionIds.length > 0) {
        // Delete specific sessions by sessionId
        result = await collection.deleteMany({
          sessionId: { $in: sessionIds },
        });
      } else {
        // Delete all
        result = await collection.deleteMany({});
      }

      return Response.json({ deleted: result.deletedCount });
    } finally {
      await client.close();
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

**Step 2: Verify TypeScript**

Run: `cd /Users/kolasokol/Code/omnichat && npx tsc --noEmit`
Expected: no errors

---

### Task 2: `page.tsx` — add `onDeleteChats` callback

**Files:**
- Modify: `app/page.tsx`

**Step 1: Add `onDeleteChats` function**

Add this function after `loadChat` (around line 183):

```tsx
function handleDeleteChats(deletedSessionIds: string[] | null) {
  // null means "all deleted"
  setHistoryVersion((v) => v + 1);
  if (
    deletedSessionIds === null ||
    (sessionId && deletedSessionIds.includes(sessionId))
  ) {
    startNewChat();
  }
}
```

**Step 2: Pass `onDeleteChats` to `<Sidebar>`**

Add to the `<Sidebar>` JSX props:
```tsx
onDeleteChats={handleDeleteChats}
```

**Step 3: Verify TypeScript** (will fail until Sidebar prop is added — that's fine, fix in Task 3)

---

### Task 3: `Sidebar.tsx` — hover trash, selection mode, delete API calls

**Files:**
- Modify: `components/Sidebar.tsx`

**Step 1: Add `Trash2` and `CheckSquare` to lucide-react import**

Change:
```tsx
import {
  Plus,
  MessageSquare,
  X,
  Clock,
  Search,
  Database,
  Cpu,
} from "lucide-react";
```
To:
```tsx
import {
  Plus,
  MessageSquare,
  X,
  Clock,
  Search,
  Database,
  Cpu,
  Trash2,
  CheckSquare,
  Square,
} from "lucide-react";
```

**Step 2: Add `onDeleteChats` to `SidebarProps` interface**

```tsx
onDeleteChats: (deletedSessionIds: string[] | null) => void;
```

And add to the destructured props:
```tsx
onDeleteChats,
```

**Step 3: Add selection mode state variables**

After the existing state declarations, add:
```tsx
// Selection mode state
const [selectionMode, setSelectionMode] = useState(false);
const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
const [deleting, setDeleting] = useState(false);
```

**Step 4: Add `callDelete` helper function**

Add before `if (!isOpen) return null;`:

```tsx
async function callDelete(sessionIds: string[] | null) {
  setDeleting(true);
  try {
    const settingsStr = localStorage.getItem("settings");
    const settings = settingsStr ? JSON.parse(settingsStr) : {};
    await fetch("/api/logs/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings,
        ...(sessionIds !== null ? { sessionIds } : {}),
      }),
    });
    onDeleteChats(sessionIds);
    setSelectionMode(false);
    setSelectedKeys(new Set());
  } catch {
    // best-effort, silently fail
  } finally {
    setDeleting(false);
  }
}
```

**Step 5: Replace the sidebar header `<div>` with selection-mode-aware version**

Find the current header div (around line 287):
```tsx
        {/* Header */}
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Chats</h2>
          <button
            onClick={onToggle}
            className="md:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
```

Replace with:
```tsx
        {/* Header */}
        {selectionMode ? (
          <div className="p-3 border-b border-slate-700 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300 font-medium">
                {selectedKeys.size} selected
              </span>
              <button
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedKeys(new Set());
                }}
                className="text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  if (selectedKeys.size > 0) {
                    callDelete(Array.from(selectedKeys));
                  }
                }}
                disabled={selectedKeys.size === 0 || deleting}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 size={12} />
                Delete selected
              </button>
              <button
                onClick={() => callDelete(null)}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 border border-red-500/40 text-red-400 hover:bg-red-600/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 size={12} />
                Delete all
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Chats</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectionMode(true)}
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Select chats to delete"
              >
                <CheckSquare size={16} />
              </button>
              <button
                onClick={onToggle}
                className="md:hidden p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}
```

**Step 6: Update the conversation list item to support selection mode and hover trash**

Find the conversation row render (starting with `return (` inside `conversations.map`). Replace the entire `return (...)` block with:

```tsx
              return (
                <div
                  key={conv.key}
                  className={`flex items-start gap-2 px-3 py-2 rounded-lg cursor-pointer group transition-colors ${
                    selectionMode
                      ? selectedKeys.has(conv.key)
                        ? "bg-red-900/20 border border-red-500/30"
                        : "hover:bg-slate-800"
                      : isActive
                        ? "bg-slate-700/70 border border-slate-600"
                        : "hover:bg-slate-800"
                  }`}
                  onClick={() => {
                    if (selectionMode) {
                      setSelectedKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(conv.key)) {
                          next.delete(conv.key);
                        } else {
                          next.add(conv.key);
                        }
                        return next;
                      });
                    } else {
                      onSelectChat(conv.sessionId ?? conv.key, conv.allLogs);
                    }
                  }}
                >
                  {selectionMode ? (
                    <div className="mt-1 text-slate-400 shrink-0">
                      {selectedKeys.has(conv.key) ? (
                        <CheckSquare size={16} className="text-red-400" />
                      ) : (
                        <Square size={16} />
                      )}
                    </div>
                  ) : (
                    <div className={`mt-1 shrink-0 ${isActive ? "text-blue-400" : "text-slate-400"}`}>
                      <MessageSquare size={16} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-100 truncate">
                      {title || "(no question)"}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                      <span>
                        {isNaN(date.getTime())
                          ? "Unknown time"
                          : date.toLocaleString()}
                      </span>
                      {conv.msgCount > 1 && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span>{conv.msgCount} msgs</span>
                        </>
                      )}
                      {conv.model && (
                        <>
                          <span className="text-slate-700">·</span>
                          <span className="truncate">{conv.model}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {!selectionMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const ids = conv.sessionId ? [conv.sessionId] : null;
                        callDelete(ids);
                      }}
                      disabled={deleting}
                      className="mt-1 p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all disabled:cursor-not-allowed shrink-0"
                      title="Delete conversation"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
```

**Step 7: Verify TypeScript**

Run: `cd /Users/kolasokol/Code/omnichat && npx tsc --noEmit`
Expected: no errors

---

### Task 4: Manual verification checklist

- Hover over a chat row → trash icon appears on the right
- Click trash → conversation disappears from list, active chat cleared if it was the deleted one
- Click CheckSquare icon in header → selection mode activates, checkboxes appear
- Click rows to toggle selection, counter updates
- "Delete selected" with 0 selected → disabled
- "Delete selected" with some selected → those conversations deleted
- "Delete all" → all conversations gone, active chat cleared
- "Cancel" → exits selection mode, list unchanged

---

## Done

3 files changed: `app/api/logs/delete/route.ts` (new), `components/Sidebar.tsx`, `app/page.tsx`.
