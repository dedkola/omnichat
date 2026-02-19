"use client";

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { Menu, Settings } from "lucide-react";
import ChatMessage from "@/components/ChatMessage";
import Sidebar from "@/components/Sidebar";
import SettingsModal from "@/components/SettingsModal";
import StatusBar, { type ChatStats } from "@/components/StatusBar";

interface LogItem {
  sessionId?: string | null;
  question: string;
  answer: string;
  model: string;
  createdAt: string;
}

export default function HomePage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [chatStats, setChatStats] = useState<ChatStats | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const checkDbConnection = useCallback(() => {
    try {
      const settingsStr = localStorage.getItem("settings");
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      const mongoUri = settings.database?.mongoUri;
      if (!mongoUri) {
        setDbConnected(null);
        return;
      }
      fetch("/api/test-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mongoUri, mongoDb: settings.database?.mongoDb }),
      })
        .then((r) => r.json())
        .then((data) => setDbConnected(!!data.ok))
        .catch(() => setDbConnected(false));
    } catch {
      setDbConnected(null);
    }
  }, []);

  useEffect(() => {
    checkDbConnection();
  }, [checkDbConnection]);

  useEffect(() => {
    // Load the most recent session on first render so the user can continue it
    try {
      const settingsStr =
        typeof window !== "undefined" ? localStorage.getItem("settings") : null;
      const settings = settingsStr ? JSON.parse(settingsStr) : {};

      // Auto-open settings on first visit when nothing is configured
      const hasLlm =
        settings.llm?.openai?.apiKey || settings.llm?.lmstudio?.model;
      const hasDb = settings.database?.mongoUri;
      if (!hasLlm && !hasDb) {
        setSettingsOpen(true);
      }

      fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      })
        .then((r) =>
          r.ok ? r.json() : Promise.reject(new Error("Failed to load logs")),
        )
        .then((data) => {
          const logs = (data.logs as LogItem[]) || [];
          if (logs.length === 0) return;

          // Find the most recent session and load only its messages so the
          // user can continue that conversation.  This also sets sessionId so
          // subsequent messages are correctly grouped under the same session.
          const mostRecentSessionId = logs.find((l) => l.sessionId)?.sessionId;
          const sessionLogs = mostRecentSessionId
            ? logs.filter((l) => l.sessionId === mostRecentSessionId)
            : // Fallback: no sessions at all – show the single most-recent log
              logs.slice(0, 1);

          const sorted = [...sessionLogs].sort(
            (a, b) =>
              new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          );
          const mapped = sorted.flatMap((l) => [
            { role: "user" as const, content: l.question },
            { role: "assistant" as const, content: l.answer },
          ]);
          setMessages(mapped);
          if (mostRecentSessionId) {
            setSessionId(mostRecentSessionId);
          }
        })
        .catch(() => { });
    } catch {
      // If settings parsing fails, just skip loading history
    }
  }, []);

  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, loading]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const msg = input.trim();
    if (!msg) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);

    try {
      // Get settings from localStorage
      const settingsStr = localStorage.getItem("settings");
      const settings = settingsStr ? JSON.parse(settingsStr) : {};

      // Ensure we have a session id for this conversation
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : // Fallback for non-secure contexts (e.g. HTTP on LAN) where
              // crypto.randomUUID is unavailable
              `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setSessionId(currentSessionId);
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          sessionId: currentSessionId,
          settings: settings,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || `Request failed with status ${res.status}`,
        );
      }

      const answer = data.answer ?? "(no answer)";
      if (data.stats) {
        setChatStats(data.stats);
        if (data.stats.dbMs !== null) setDbConnected(true);
      }
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
      // Trigger sidebar history refresh (best-effort, regardless of logged flag)
      setHistoryVersion((v) => v + 1);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `Error: ${errorMessage}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setSessionId(null);
    setChatStats(null);
    // Also refresh sidebar history so the just-finished chat appears
    setHistoryVersion((v) => v + 1);
  }

  function loadChat(chatSessionId: string, logs: LogItem[]) {
    const mapped = logs.flatMap((l) => [
      { role: "user" as const, content: l.question },
      { role: "assistant" as const, content: l.answer },
    ]);
    setMessages(mapped);
    setSessionId(chatSessionId);
    setChatStats(null);
  }

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

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setSidebarOpen(!isSidebarOpen)}
        onNewChat={startNewChat}
        onSelectChat={loadChat}
        historyVersion={historyVersion}
        dbConnected={dbConnected}
        activeSessionId={sessionId}
        onDeleteChats={handleDeleteChats}
        llmProvider={
          chatStats
            ? chatStats.provider === "copilot"
              ? "Copilot"
              : chatStats.provider === "lmstudio"
                ? "LM Studio"
                : "OpenAI"
            : null
        }
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative h-full">
        {/* Status Bar */}
        <StatusBar dbConnected={dbConnected} stats={chatStats} />

        {/* Header */}
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-xl font-semibold text-slate-100">OmniChat</h1>
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Model Settings"
          >
            <Settings size={20} />
          </button>
        </header>

        {/* Chat Area */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 md:px-0">
          <div className="max-w-3xl mx-auto py-8">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-4">
                <p className="text-lg font-medium">Start a new conversation</p>
                <p className="text-sm">
                  Type below to start chatting.{" "}
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                  >
                    Configure connections
                  </button>{" "}
                  to get started.
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <ChatMessage key={i} role={m.role} content={m.content} />
            ))}
            {loading && (
              <div className="flex justify-start mb-6 animate-pulse">
                <div className="bg-slate-800 rounded-2xl px-5 py-4 text-slate-400 text-sm">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={scrollAnchorRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur shrink-0">
          <div className="max-w-3xl mx-auto">
            <form onSubmit={sendMessage} className="flex gap-3 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  // Auto-resize
                  const ta = e.target;
                  ta.style.height = "auto";
                  ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
                }}
                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (input.trim() && !loading) {
                      sendMessage(e as unknown as React.FormEvent);
                    }
                  }
                }}
                placeholder="Ask me anything…"
                disabled={loading}
                rows={1}
                className="flex-1 bg-slate-800 text-slate-200 rounded-xl px-4 py-3 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-lg resize-none overflow-y-auto leading-relaxed"
                style={{ maxHeight: "160px" }}
              />
              <button
                disabled={loading}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-md hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                Send
              </button>
            </form>
            <div className="text-center mt-2">
              <p className="text-[10px] text-slate-600">
                Enter to send · Shift+Enter for new line · AI responses can be inaccurate
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          checkDbConnection();
        }}
      />
    </div>
  );
}
