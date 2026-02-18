"use client";

import { useEffect, useState, useRef } from "react";
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

interface LogItem {
  sessionId?: string | null;
  question: string;
  answer: string;
  model: string;
  createdAt: string;
}

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectChat: (sessionId: string, logs: LogItem[]) => void;
  historyVersion: number;
  dbConnected: boolean | null;
  llmProvider: string | null;
  activeSessionId: string | null;
  onDeleteChats: (deletedSessionIds: string[] | null) => void;
}

export default function Sidebar({
  isOpen,
  onToggle,
  onNewChat,
  onSelectChat,
  historyVersion,
  dbConnected,
  llmProvider,
  activeSessionId,
  onDeleteChats,
}: SidebarProps) {
  const [tab, setTab] = useState<"history" | "search">("history");

  // History state
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<LogItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection mode state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  // Load history
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    // Only show loading spinner on initial load, not background refreshes
    const isInitialLoad = logs.length === 0;
    if (isInitialLoad) {
      setLoading(true);
    }
    setError(null);

    try {
      const settingsStr =
        typeof window !== "undefined" ? localStorage.getItem("settings") : null;
      const settings = settingsStr ? JSON.parse(settingsStr) : {};

      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Failed to load logs")),
        )
        .then((data) => {
          if (cancelled) return;
          setLogs((data.logs as LogItem[]) || []);
        })
        .catch(() => {
          if (cancelled) return;
          setError("Failed to load history");
        })
        .finally(() => {
          if (cancelled) return;
          setLoading(false);
        });
    } catch {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, historyVersion]);

  // Focus search input when switching to search tab
  useEffect(() => {
    if (tab === "search") {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [tab]);

  function handleSearch(value: string) {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      setSearchError(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      runSearch(value.trim());
    }, 300);
  }

  function runSearch(term: string) {
    setSearching(true);
    setSearchError(null);
    setHasSearched(true);

    try {
      const settingsStr = localStorage.getItem("settings");
      const settings = settingsStr ? JSON.parse(settingsStr) : {};

      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings, search: term }),
      })
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Search failed")),
        )
        .then((data) => {
          setSearchResults((data.logs as LogItem[]) || []);
        })
        .catch(() => {
          setSearchError("Search failed");
        })
        .finally(() => {
          setSearching(false);
        });
    } catch {
      setSearching(false);
      setSearchError("Search failed");
    }
  }

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onToggle();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onToggle]);

  async function callDelete(sessionIds: string[] | null) {
    setDeleting(true);
    try {
      const settingsStr = localStorage.getItem("settings");
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      const res = await fetch("/api/logs/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          ...(sessionIds !== null ? { sessionIds } : {}),
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to delete chats");
      }
      onDeleteChats(sessionIds);
      setSelectionMode(false);
      setSelectedKeys(new Set());
    } catch {
      // best-effort, silently fail
    } finally {
      setDeleting(false);
    }
  }

  if (!isOpen) return null;

  const historyItems = tab === "history" ? logs : searchResults;
  const isLoading = tab === "history" ? loading : searching;
  const currentError = tab === "history" ? error : searchError;

  // Group logs by sessionId into conversations
  const conversations = (() => {
    const grouped = new Map<
      string,
      { logs: LogItem[]; firstQuestion: string; latestDate: string }
    >();
    const ungrouped: { log: LogItem; index: number }[] = [];

    historyItems.forEach((log, index) => {
      if (log.sessionId) {
        const existing = grouped.get(log.sessionId);
        if (existing) {
          existing.logs.push(log);
          if (!existing.latestDate || log.createdAt > existing.latestDate) {
            existing.latestDate = log.createdAt;
          }
        } else {
          grouped.set(log.sessionId, {
            logs: [log],
            firstQuestion: log.question,
            latestDate: log.createdAt,
          });
        }
      } else {
        ungrouped.push({ log, index });
      }
    });

    const result: {
      key: string;
      sessionId: string | null;
      title: string;
      date: string;
      model: string;
      msgCount: number;
      allLogs: LogItem[];
    }[] = [];

    // Add grouped conversations
    grouped.forEach((value, sessionId) => {
      const sorted = [...value.logs].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      result.push({
        key: sessionId,
        sessionId,
        title: sorted[0].question,
        date: value.latestDate,
        model: sorted[sorted.length - 1].model,
        msgCount: value.logs.length,
        allLogs: sorted,
      });
    });

    // Add ungrouped (legacy) logs
    ungrouped.forEach(({ log, index }) => {
      result.push({
        key: `legacy-${index}`,
        sessionId: null,
        title: log.question,
        date: log.createdAt,
        model: log.model,
        msgCount: 1,
        allLogs: [log],
      });
    });

    // Sort by latest date descending
    result.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return result;
  })();

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
        onClick={onToggle}
      />

      {/* Sidebar */}
      <div className="fixed md:relative w-80 h-full bg-slate-900 border-r border-slate-700 flex flex-col shrink-0 transition-all duration-300 z-50">
        {/* Status bar */}
        <div className="h-7 border-b border-slate-800 bg-slate-950/60 flex items-center px-3 gap-3 text-[11px] font-mono text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <Database size={10} />
            {dbConnected === null && (
              <span className="text-slate-600">--</span>
            )}
            {dbConnected === true && (
              <span className="text-emerald-400">ok</span>
            )}
            {dbConnected === false && (
              <span className="text-red-400">off</span>
            )}
          </div>
          <div className="w-px h-3 bg-slate-700" />
          <div className="flex items-center gap-1.5">
            <Cpu size={10} />
            <span className="text-slate-400 truncate">
              {llmProvider || "--"}
            </span>
          </div>
          <div className="flex-1" />
          <span className="text-slate-600">{conversations.length} chats</span>
        </div>

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

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${tab === "history"
              ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/40"
              : "text-slate-400 hover:text-slate-200"
              }`}
            onClick={() => setTab("history")}
          >
            <Clock size={13} />
            History
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${tab === "search"
              ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/40"
              : "text-slate-400 hover:text-slate-200"
              }`}
            onClick={() => setTab("search")}
          >
            <Search size={13} />
            Search
          </button>
        </div>

        {/* New Chat Button */}
        <div className="px-3 py-3 border-b border-slate-700">
          {tab === "history" ? (
            <button
              onClick={onNewChat}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus size={16} />
              <span>New Chat</span>
            </button>
          ) : (
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {isLoading && (
            <div className="text-center text-slate-500 mt-6 text-sm">
              {tab === "history" ? "Loading history…" : "Searching…"}
            </div>
          )}
          {!isLoading && currentError && (
            <div className="text-center text-red-400 mt-6 text-sm">
              {currentError}
            </div>
          )}
          {!isLoading && !currentError && conversations.length === 0 && (
            <div className="text-center text-slate-500 mt-10 text-sm">
              {tab === "history"
                ? "No conversations yet."
                : hasSearched
                  ? "No results found."
                  : "Type to search conversations."}
            </div>
          )}
          {!isLoading &&
            !currentError &&
            conversations.map((conv) => {
              const date = new Date(conv.date);
              const title =
                conv.title.length > 80
                  ? conv.title.slice(0, 80) + "…"
                  : conv.title;

              const isActive =
                activeSessionId !== null &&
                (conv.sessionId === activeSessionId ||
                  conv.key === activeSessionId);

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
                  {!selectionMode && conv.sessionId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        callDelete([conv.sessionId!]);
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
            })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 text-xs text-slate-500 text-center">
          Powered by Next.js &amp; MongoDB
        </div>
      </div>
    </>
  );
}
