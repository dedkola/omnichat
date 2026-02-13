"use client";

import { Database, Cpu, Zap, Clock, Activity } from "lucide-react";

export interface ChatStats {
  provider: string;
  model: string;
  llmMs: number;
  dbMs: number | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokensPerSecond: number | null;
}

interface StatusBarProps {
  dbConnected: boolean | null; // null = unknown/not tested
  stats: ChatStats | null;
}

export default function StatusBar({ dbConnected, stats }: StatusBarProps) {
  return (
    <div className="h-7 border-b border-slate-800 bg-slate-900/80 flex items-center px-4 gap-4 text-[11px] font-mono text-slate-500 shrink-0 overflow-x-auto">
      {/* DB status */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Database size={11} />
        <span>DB:</span>
        {dbConnected === null && <span className="text-slate-600">--</span>}
        {dbConnected === true && (
          <span className="text-emerald-400">connected</span>
        )}
        {dbConnected === false && (
          <span className="text-red-400">disconnected</span>
        )}
      </div>

      <div className="w-px h-3 bg-slate-700 shrink-0" />

      {/* LLM provider + model */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Cpu size={11} />
        {stats ? (
          <span className="text-slate-400">
            {stats.provider === "copilot"
              ? "Copilot"
              : stats.provider === "lmstudio"
                ? "LM Studio"
                : "OpenAI"}{" "}
            <span className="text-slate-300">{stats.model}</span>
          </span>
        ) : (
          <span className="text-slate-600">--</span>
        )}
      </div>

      {stats && (
        <>
          <div className="w-px h-3 bg-slate-700 shrink-0" />

          {/* Tokens/sec */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Zap size={11} />
            <span>
              {stats.tokensPerSecond !== null ? (
                <span className="text-amber-400">
                  {stats.tokensPerSecond} tok/s
                </span>
              ) : (
                <span className="text-slate-600">-- tok/s</span>
              )}
            </span>
          </div>

          <div className="w-px h-3 bg-slate-700 shrink-0" />

          {/* LLM response time */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Clock size={11} />
            <span>
              LLM <span className="text-sky-400">{formatMs(stats.llmMs)}</span>
            </span>
          </div>

          <div className="w-px h-3 bg-slate-700 shrink-0" />

          {/* DB query time */}
          <div className="flex items-center gap-1.5 shrink-0">
            <Activity size={11} />
            <span>
              DB{" "}
              {stats.dbMs !== null ? (
                <span className="text-emerald-400">{formatMs(stats.dbMs)}</span>
              ) : (
                <span className="text-slate-600">--</span>
              )}
            </span>
          </div>

          <div className="w-px h-3 bg-slate-700 shrink-0" />

          {/* Token counts */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-500">
              {stats.totalTokens > 0
                ? `${stats.promptTokens}+${stats.completionTokens}=${stats.totalTokens} tok`
                : "-- tok"}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
