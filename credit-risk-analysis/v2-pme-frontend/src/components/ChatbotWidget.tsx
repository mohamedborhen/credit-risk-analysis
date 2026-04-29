"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Loader2, Send, X } from "lucide-react";
import apiClient from "@/lib/api/axios";

type ChatRole = "user" | "assistant";

interface ChatMessage {
  role: ChatRole;
  content: string;
  timestamp: number;
}

interface ChatResponse {
  answer: string;
  data: Record<string, unknown>;
}

interface StoredUser {
  id?: string;
  email?: string;
  role?: string;
}

const CHAT_STORAGE_KEY = "finscore_chat_history";

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawUser = localStorage.getItem("finscore_user");
    const rawHistory = localStorage.getItem(CHAT_STORAGE_KEY);

    if (rawUser) {
      try {
        const parsed = JSON.parse(rawUser) as StoredUser;
        if (parsed?.id) {
          setUserId(parsed.id);
        }
      } catch {
        setUserId(null);
      }
    }

    if (rawHistory) {
      try {
        const parsed = JSON.parse(rawHistory) as ChatMessage[];
        if (Array.isArray(parsed)) {
          setMessages(parsed.slice(-20));
        }
      } catch {
        setMessages([]);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-20)));
  }, [messages]);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const pushMessage = (role: ChatRole, content: string) => {
    setMessages((prev) => [...prev, { role, content, timestamp: Date.now() }].slice(-20));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const message = input.trim();

    if (!message || loading) {
      return;
    }

    if (!userId) {
      setError("Please log in first so the assistant can fetch your score data.");
      return;
    }

    setInput("");
    setError(null);
    pushMessage("user", message);
    setLoading(true);

    try {
      const response = await apiClient.post<ChatResponse>("/chat", {
        user_id: userId,
        message,
      });

      pushMessage("assistant", response.data.answer || "No response returned by assistant.");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : "Assistant request failed. Please try again.";
      setError(msg);
      pushMessage("assistant", `I could not complete your request: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    }
  };

  return (
    <>
      <button
        aria-label="Open AI assistant"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-indigo-500 text-slate-950 shadow-[0_0_30px_rgba(45,212,191,0.35)] transition hover:scale-105"
      >
        <Bot className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 right-6 z-50 w-[92vw] max-w-md overflow-hidden rounded-2xl border border-white/15 bg-slate-950/95 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-white">FinScore AI Assistant</h3>
                <p className="text-xs text-gray-400">Ask about score, profile, and risk drivers</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-gray-400 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="h-80 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-gray-300">
                  Try: "Why is my score medium risk?" or "Show my top weaknesses".
                </div>
              ) : null}

              {messages.map((message) => (
                <div
                  key={`${message.timestamp}-${message.role}`}
                  className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "ml-auto bg-indigo-500/20 text-indigo-100"
                      : "mr-auto border border-white/10 bg-white/5 text-gray-200"
                  }`}
                >
                  {message.content}
                </div>
              ))}

              {loading ? (
                <div className="mr-auto inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking...
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/10 p-3">
              {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}

              <form onSubmit={onSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask your AI assistant..."
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-teal-500"
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-slate-950 transition hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                <span>{userId ? "Connected" : "Not logged in"}</span>
                <button onClick={clearChat} className="transition hover:text-gray-300">
                  Clear
                </button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
