"use client";

import { X, Save, Cpu, Database } from "lucide-react";
import { useEffect, useState } from "react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"llm" | "database">("llm");

  // LLM settings state
  type LlmProvider = "openai" | "lmstudio" | "copilot";
  const [llmProvider, setLlmProvider] = useState<LlmProvider>("openai");
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-3.5-turbo");
  const [lmstudioUrl, setLmstudioUrl] = useState("http://localhost:1234");
  const [lmstudioModel, setLmstudioModel] = useState("");
  const [copilotToken, setCopilotToken] = useState("");
  const [copilotModel, setCopilotModel] = useState("gpt-4.1");

  // Database settings state
  const [mongoUri, setMongoUri] = useState("");
  const [mongoDb, setMongoDb] = useState("");
  const [dbTestStatus, setDbTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [dbTestMessage, setDbTestMessage] = useState("");

  // System instruction
  const [systemInstruction, setSystemInstruction] = useState("");

  // Load saved settings when the modal is opened
  useEffect(() => {
    if (!isOpen) return;

    try {
      const savedSettings = localStorage.getItem("settings");
      if (!savedSettings) return;

      const parsed = JSON.parse(savedSettings);

      // Load LLM settings
      if (parsed.llm) {
        const llm = parsed.llm;

        // Infer provider if missing (backward compatibility)
        let provider: LlmProvider = "openai";
        if (
          llm.provider === "lmstudio" ||
          llm.provider === "openai" ||
          llm.provider === "copilot"
        ) {
          provider = llm.provider;
        } else if (llm.selectedModel === "local-model") {
          provider = "lmstudio";
        }
        setLlmProvider(provider);

        // OpenAI settings (new structured shape with legacy fallbacks)
        setOpenaiApiKey(llm.openai?.apiKey || llm.openaiApiKey || "");

        let inferredOpenaiModel =
          llm.openai?.model || llm.openaiModel || "gpt-3.5-turbo";

        if (
          !llm.openai?.model &&
          llm.selectedModel &&
          llm.selectedModel !== "local-model"
        ) {
          inferredOpenaiModel = llm.selectedModel;
        }

        setOpenaiModel(inferredOpenaiModel);

        // LM Studio settings (new structured shape with legacy fallbacks)
        setLmstudioUrl(
          llm.lmstudio?.url || llm.lmstudioUrl || "http://localhost:1234",
        );
        setLmstudioModel(llm.lmstudio?.model || llm.lmstudioModel || "");

        // Copilot settings
        setCopilotToken(llm.copilot?.githubToken || "");
        setCopilotModel(llm.copilot?.model || "gpt-4.1");
      }

      // Load Database settings
      if (parsed.database) {
        setMongoUri(parsed.database.mongoUri || "");
        setMongoDb(parsed.database.mongoDb || "");
      }

      // Load system instruction
      setSystemInstruction(parsed.systemInstruction || "");
    } catch (error) {
      console.error("Failed to load saved settings from localStorage", error);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem(
      "settings",
      JSON.stringify({
        llm: {
          provider: llmProvider,
          openai: {
            apiKey: openaiApiKey,
            model: openaiModel,
          },
          lmstudio: {
            url: lmstudioUrl,
            model: lmstudioModel,
          },
          copilot: {
            githubToken: copilotToken,
            model: copilotModel,
          },
        },
        database: {
          mongoUri,
          mongoDb,
        },
        systemInstruction,
      }),
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col h-[600px] max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800">
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${activeTab === "llm"
                ? "text-blue-400 border-b-2 border-blue-400 bg-slate-800/50"
                : "text-slate-400 hover:text-slate-200"
              }`}
            onClick={() => setActiveTab("llm")}
          >
            <Cpu size={16} />
            LLM Connections
          </button>
          <button
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-medium transition-colors ${activeTab === "database"
                ? "text-emerald-400 border-b-2 border-emerald-400 bg-slate-800/50"
                : "text-slate-400 hover:text-slate-200"
              }`}
            onClick={() => setActiveTab("database")}
          >
            <Database size={16} />
            Database
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "llm" && (
            <div className="space-y-6">
              {/* Provider Selector */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-400">
                  LLM Provider
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setLlmProvider("openai")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${llmProvider === "openai"
                        ? "bg-blue-600/20 border-blue-500 text-blue-400"
                        : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
                      }`}
                  >
                    OpenAI
                  </button>
                  <button
                    type="button"
                    onClick={() => setLlmProvider("copilot")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${llmProvider === "copilot"
                        ? "bg-blue-600/20 border-blue-500 text-blue-400"
                        : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
                      }`}
                  >
                    Copilot
                  </button>
                  <button
                    type="button"
                    onClick={() => setLlmProvider("lmstudio")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${llmProvider === "lmstudio"
                        ? "bg-blue-600/20 border-blue-500 text-blue-400"
                        : "bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500"
                      }`}
                  >
                    LM Studio
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  The selected provider will be used for all chats.
                </p>
              </div>

              {/* Provider-specific settings */}
              {llmProvider === "openai" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    OpenAI settings
                  </h3>

                  {/* OpenAI API Key */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-slate-500">
                      Get your API key from:
                      https://platform.openai.com/api-keys
                    </p>
                  </div>

                  {/* OpenAI Default Model */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400">
                      Default model
                    </label>
                    <select
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                      <option value="gpt-4">GPT-4</option>
                      <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    </select>
                    <p className="text-xs text-slate-500">
                      This model will be used for all conversations when OpenAI
                      is selected.
                    </p>
                  </div>
                </div>
              )}

              {llmProvider === "copilot" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    GitHub Copilot settings
                  </h3>

                  {/* GitHub Token */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400">
                      GitHub Token
                    </label>
                    <input
                      type="password"
                      value={copilotToken}
                      onChange={(e) => setCopilotToken(e.target.value)}
                      placeholder="ghp_... or gho_..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-slate-500">
                      A GitHub PAT with Copilot access, or leave empty to use{" "}
                      <code className="text-slate-400">gh auth token</code> from
                      CLI.
                    </p>
                  </div>

                  {/* Copilot Model */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400">
                      Model
                    </label>
                    <select
                      value={copilotModel}
                      onChange={(e) => setCopilotModel(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="gpt-4.1">GPT-4.1</option>
                      <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                      <option value="gpt-5">GPT-5</option>
                      <option value="claude-sonnet-4">Claude Sonnet 4</option>
                    </select>
                    <p className="text-xs text-slate-500">
                      Model to use via GitHub Copilot. Available models depend
                      on your Copilot plan.
                    </p>
                  </div>
                </div>
              )}

              {llmProvider === "lmstudio" && (
                <div className="space-y-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    LM Studio settings
                  </h3>

                  {/* LM Studio Connection */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400">
                      LM Studio URL
                    </label>
                    <input
                      type="text"
                      value={lmstudioUrl}
                      onChange={(e) => setLmstudioUrl(e.target.value)}
                      placeholder="http://localhost:1234"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-slate-500">
                      URL of the LM Studio OpenAI-compatible server.
                    </p>
                  </div>

                  {/* LM Studio Model ID */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-400">
                      LM Studio Model ID
                    </label>
                    <input
                      type="text"
                      value={lmstudioModel}
                      onChange={(e) => setLmstudioModel(e.target.value)}
                      placeholder="e.g. qwen/qwen3-4b-2507"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-slate-500">
                      Exact model identifier shown in LM Studio when you start
                      the server.
                    </p>
                  </div>
                </div>
              )}

              {/* System Instruction */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  System Instruction
                </label>
                <textarea
                  value={systemInstruction}
                  onChange={(e) => setSystemInstruction(e.target.value)}
                  placeholder="e.g. You are a helpful coding assistant..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Default system instruction applied to all conversations.
                </p>
              </div>
            </div>
          )}

          {activeTab === "database" && (
            <div className="space-y-6">
              {/* MongoDB URI */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-400">
                  MongoDB Connection String
                </label>
                <input
                  type="password"
                  value={mongoUri}
                  onChange={(e) => setMongoUri(e.target.value)}
                  placeholder="mongodb+srv://username:password@cluster.mongodb.net/"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-xs text-slate-500">
                  Connection string for your MongoDB database
                </p>
              </div>

              {/* Database Name */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-400">
                  Database Name
                </label>
                <input
                  type="text"
                  value={mongoDb}
                  onChange={(e) => setMongoDb(e.target.value)}
                  placeholder="myapp"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <p className="text-xs text-slate-500">
                  Name of the database to store chat logs
                </p>
              </div>

              {/* Test Connection */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={async () => {
                    if (!mongoUri) return;
                    setDbTestStatus("testing");
                    setDbTestMessage("");
                    try {
                      const res = await fetch("/api/test-db", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          mongoUri,
                          mongoDb,
                        }),
                      });
                      const data = await res.json();
                      if (res.ok && data.ok) {
                        setDbTestStatus("success");
                        setDbTestMessage("Connected successfully.");
                      } else {
                        setDbTestStatus("error");
                        setDbTestMessage(data.error || "Connection failed.");
                      }
                    } catch (error: unknown) {
                      setDbTestStatus("error");
                      setDbTestMessage(
                        error instanceof Error
                          ? error.message
                          : "Connection failed.",
                      );
                    }
                  }}
                  disabled={!mongoUri || dbTestStatus === "testing"}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
                >
                  {dbTestStatus === "testing"
                    ? "Testing..."
                    : "Test connection"}
                </button>
                {dbTestStatus === "success" && (
                  <p className="text-xs text-emerald-400">{dbTestMessage}</p>
                )}
                {dbTestStatus === "error" && (
                  <p className="text-xs text-red-400">{dbTestMessage}</p>
                )}
              </div>

              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                <h3 className="font-medium text-slate-300 mb-2">
                  Connection Status
                </h3>
                <p className="text-sm text-slate-400">
                  Current status:{" "}
                  <span className="text-emerald-400">
                    {dbTestStatus === "success"
                      ? "Connected (last test)"
                      : dbTestStatus === "testing"
                        ? "Testing..."
                        : "Not tested"}
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  The app will use these MongoDB settings when logging chats and
                  loading history. Environment variables (<code>MONGO_URI</code>
                  , <code>MONGO_DB</code>) are only used as a fallback.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Save size={18} />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
