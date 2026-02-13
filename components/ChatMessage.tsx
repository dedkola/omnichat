import { User, Bot } from "lucide-react";

export default function ChatMessage({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-6`}
    >
      <div
        className={`flex max-w-[85%] md:max-w-[75%] gap-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      >
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            isUser ? "bg-blue-600" : "bg-emerald-600"
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
          className={`relative group min-w-[120px] rounded-2xl px-5 py-4 ${
            isUser
              ? "bg-blue-600/10 border border-blue-500/20 text-slate-100 rounded-tr-sm"
              : "bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-sm shadow-sm"
          }`}
        >
          <div className="prose prose-invert prose-sm max-w-none break-words">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
