# Settings QOL Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve the settings modal with auto-fetched model lists for LM Studio and OpenAI, LM Studio connection status, and auto-save.

**Architecture:** All changes are client-side in `components/SettingsModal.tsx`. No new API routes. LM Studio models are fetched from `{lmstudioUrl}/v1/models`; OpenAI models from `https://api.openai.com/v1/models`. Auto-save debounces all field changes to localStorage. The Save button still closes the modal immediately.

**Tech Stack:** React, TypeScript, Tailwind CSS, lucide-react (already installed)

---

### Task 1: Add auto-save with debounce + "Saved" flash

**Files:**
- Modify: `components/SettingsModal.tsx`

This is first because it's self-contained and every subsequent task benefits from auto-save being in place.

**Step 1: Add auto-save state and debounce effect**

Inside `SettingsModal`, add a `savedFlash` state and a `useEffect` that watches all settings fields, debounces 500ms, writes to localStorage, and briefly shows a "Saved" indicator.

Add near the top of the component (after existing state declarations):

```tsx
const [savedFlash, setSavedFlash] = useState(false);
```

Add this effect after the existing `useEffect` blocks:

```tsx
useEffect(() => {
  if (!isOpen) return;
  const timer = setTimeout(() => {
    localStorage.setItem(
      "settings",
      JSON.stringify({
        llm: {
          provider: llmProvider,
          openai: { apiKey: openaiApiKey, model: openaiModel },
          lmstudio: { url: lmstudioUrl, model: lmstudioModel },
          copilot: { githubToken: copilotToken, model: copilotModel },
        },
        database: { mongoUri, mongoDb },
        systemInstruction,
      }),
    );
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }, 500);
  return () => clearTimeout(timer);
}, [
  isOpen,
  llmProvider,
  openaiApiKey,
  openaiModel,
  lmstudioUrl,
  lmstudioModel,
  copilotToken,
  copilotModel,
  mongoUri,
  mongoDb,
  systemInstruction,
]);
```

**Step 2: Show "Saved" flash in footer and remove Cancel button**

Replace the footer `<div>` (the one with Cancel + Save buttons):

```tsx
<div className="p-5 border-t border-slate-800 flex items-center justify-between gap-3">
  <span
    className={`text-xs text-emerald-400 transition-opacity duration-500 ${savedFlash ? "opacity-100" : "opacity-0"}`}
  >
    Saved
  </span>
  <button
    onClick={handleSave}
    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
  >
    <Save size={18} />
    Save & Close
  </button>
</div>
```

**Step 3: Verify manually**
- Open settings, change any field, wait 0.5s → "Saved" flash appears
- Reload page → settings persisted

---

### Task 2: LM Studio — fetch models from `/v1/models`

**Files:**
- Modify: `components/SettingsModal.tsx`

**Step 1: Add state for LM Studio model fetch**

Add after existing state declarations:

```tsx
type FetchState = "idle" | "loading" | "success" | "error";
const [lmModels, setLmModels] = useState<string[]>([]);
const [lmFetchState, setLmFetchState] = useState<FetchState>("idle");
const [lmFetchError, setLmFetchError] = useState("");
const [lmReachable, setLmReachable] = useState<boolean | null>(null);
```

**Step 2: Add fetchLmModels function**

Add before the `return` statement:

```tsx
const fetchLmModels = async (url: string) => {
  setLmFetchState("loading");
  setLmFetchError("");
  setLmReachable(null);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/v1/models`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const ids: string[] = (data.data ?? []).map((m: { id: string }) => m.id).sort();
    setLmModels(ids);
    setLmFetchState("success");
    setLmReachable(true);
    // Pre-select current model if in list
    if (ids.length > 0 && !ids.includes(lmstudioModel)) {
      setLmstudioModel(ids[0]);
    }
  } catch (err) {
    setLmFetchState("error");
    setLmReachable(false);
    setLmFetchError(err instanceof Error ? err.message : "Failed to fetch models");
  }
};
```

**Step 3: Auto-trigger fetch when LM Studio tab is shown or URL changes**

Add this effect (debounced 600ms on URL change, immediate on tab switch):

```tsx
useEffect(() => {
  if (!isOpen || llmProvider !== "lmstudio") return;
  const timer = setTimeout(() => fetchLmModels(lmstudioUrl), 600);
  return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen, llmProvider, lmstudioUrl]);
```

**Step 4: Replace LM Studio model text input with dropdown + status UI**

Replace the entire "LM Studio Model ID" `<div className="space-y-3">` block with:

```tsx
{/* LM Studio Model */}
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <label className="text-sm font-medium text-slate-400">Model</label>
    <button
      type="button"
      onClick={() => fetchLmModels(lmstudioUrl)}
      disabled={lmFetchState === "loading"}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
    >
      <RefreshCw size={12} className={lmFetchState === "loading" ? "animate-spin" : ""} />
      Refresh
    </button>
  </div>

  {lmFetchState === "success" && lmModels.length > 0 ? (
    <select
      value={lmstudioModel}
      onChange={(e) => setLmstudioModel(e.target.value)}
      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
    >
      {lmModels.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  ) : (
    <input
      type="text"
      value={lmstudioModel}
      onChange={(e) => setLmstudioModel(e.target.value)}
      placeholder="e.g. qwen/qwen3-4b-2507"
      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
    />
  )}

  {lmFetchState === "error" && (
    <p className="text-xs text-red-400">{lmFetchError} — enter model ID manually above.</p>
  )}
  {lmFetchState === "loading" && (
    <p className="text-xs text-slate-500">Fetching models…</p>
  )}
</div>
```

**Step 5: Add connection status dot below the URL field**

After the LM Studio URL `<input>` closing tag, add:

```tsx
{lmReachable !== null && (
  <p className={`text-xs flex items-center gap-1.5 ${lmReachable ? "text-emerald-400" : "text-red-400"}`}>
    <span className={`inline-block w-2 h-2 rounded-full ${lmReachable ? "bg-emerald-400" : "bg-red-400"}`} />
    {lmReachable ? "Reachable" : "Unreachable"}
  </p>
)}
```

**Step 6: Add `RefreshCw` to the lucide-react import**

Change the import at the top:

```tsx
import { X, Save, Cpu, Database, RefreshCw } from "lucide-react";
```

**Step 7: Verify manually**
- Select LM Studio tab with LM Studio running → dropdown appears with loaded models
- Select LM Studio tab with no server running → error message + text input fallback visible
- Change URL → models re-fetch after 600ms

---

### Task 3: OpenAI — fetch real model list

**Files:**
- Modify: `components/SettingsModal.tsx`

**Step 1: Add state for OpenAI model fetch**

Add after the LM Studio fetch state declarations:

```tsx
const [openaiModels, setOpenaiModels] = useState<string[]>([]);
const [oaiFetchState, setOaiFetchState] = useState<FetchState>("idle");
const [oaiFetchError, setOaiFetchError] = useState("");
```

**Step 2: Add fetchOpenAIModels function**

Add after `fetchLmModels`:

```tsx
const fetchOpenAIModels = async (apiKey: string) => {
  if (!apiKey) return;
  setOaiFetchState("loading");
  setOaiFetchError("");
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const ids: string[] = (data.data ?? [])
      .map((m: { id: string }) => m.id)
      .filter((id: string) => id.includes("gpt"))
      .sort();
    setOpenaiModels(ids);
    setOaiFetchState("success");
    if (ids.length > 0 && !ids.includes(openaiModel)) {
      setOpenaiModel(ids[0]);
    }
  } catch (err) {
    setOaiFetchState("error");
    setOaiFetchError(err instanceof Error ? err.message : "Failed to fetch models");
  }
};
```

**Step 3: Auto-trigger fetch when API key changes or OpenAI tab is shown**

```tsx
useEffect(() => {
  if (!isOpen || llmProvider !== "openai" || !openaiApiKey) return;
  const timer = setTimeout(() => fetchOpenAIModels(openaiApiKey), 800);
  return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isOpen, llmProvider, openaiApiKey]);
```

**Step 4: Replace hardcoded OpenAI model `<select>` with dynamic one**

Replace the "Default model" `<div className="space-y-3">` block inside `llmProvider === "openai"`:

```tsx
<div className="space-y-3">
  <div className="flex items-center justify-between">
    <label className="text-sm font-medium text-slate-400">Default model</label>
    <button
      type="button"
      onClick={() => fetchOpenAIModels(openaiApiKey)}
      disabled={!openaiApiKey || oaiFetchState === "loading"}
      className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 transition-colors"
    >
      <RefreshCw size={12} className={oaiFetchState === "loading" ? "animate-spin" : ""} />
      Refresh
    </button>
  </div>

  {oaiFetchState === "success" && openaiModels.length > 0 ? (
    <select
      value={openaiModel}
      onChange={(e) => setOpenaiModel(e.target.value)}
      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
    >
      {openaiModels.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  ) : (
    <select
      value={openaiModel}
      onChange={(e) => setOpenaiModel(e.target.value)}
      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
    >
      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
      <option value="gpt-4">GPT-4</option>
      <option value="gpt-4-turbo">GPT-4 Turbo</option>
      <option value="gpt-4o">GPT-4o</option>
      <option value="gpt-4o-mini">GPT-4o Mini</option>
    </select>
  )}

  {oaiFetchState === "error" && (
    <p className="text-xs text-red-400">{oaiFetchError} — showing default model list.</p>
  )}
  {oaiFetchState === "loading" && (
    <p className="text-xs text-slate-500">Fetching models…</p>
  )}
  <p className="text-xs text-slate-500">
    {oaiFetchState === "success"
      ? "Model list fetched from OpenAI."
      : "Enter your API key above to fetch available models."}
  </p>
</div>
```

**Step 5: Verify manually**
- Enter a valid OpenAI key → after 800ms, dropdown updates with real model list
- Enter invalid key → error message shown, fallback hardcoded list visible
- Click Refresh → re-fetches immediately

---

## Done

All changes are in `components/SettingsModal.tsx`. No new files, no new API routes.
