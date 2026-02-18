"use client";

import { useState } from "react";
import { User, Bot, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatMessage({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-6`}
    >
      <div
        className={`flex max-w-[85%] md:max-w-[75%] gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      >
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isUser ? "bg-blue-600" : "bg-emerald-600"
            }`}
        >
          {isUser ? (
            <User size={16} className="text-white" />
          ) : (
            <Bot size={16} className="text-white" />
          )}
        </div>

        {/* Content */}
        <div
          className={`relative group min-w-[120px] rounded-2xl px-5 py-4 ${isUser
              ? "bg-blue-600/10 border border-blue-500/20 text-slate-100 rounded-tr-sm"
              : "bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm shadow-sm"
            }`}
        >
          {/* Copy button for assistant messages */}
          {!isUser && (
            <button
              type="button"
              onClick={handleCopy}
              className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-600 transition-all opacity-0 group-hover:opacity-100"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check size={14} className="text-emerald-400" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}

          <div className="prose prose-invert prose-sm max-w-none break-words">
            {isUser ? (
              <p className="whitespace-pre-wrap m-0">{content}</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
