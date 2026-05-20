"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { foldAgentReply } from "@hot-dev/sdk/agent";

import { type AgentTarget, replyLabelFor, streamFromAgent } from "@/lib/agent-client";

type ChatAttachment = {
  name: string;
  type: string;
  size: number;
  data?: string;
  text?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  status?: "ok" | "streaming" | "error";
  ts: number;
};

type Prompt = {
  label: string;
  text: string;
  send?: boolean;
};

const AGENT_INFO: Record<AgentTarget, {
  name: string;
  tagline: string;
  initials: string;
  accent: string;
  prompts: Prompt[];
  starterText: string;
}> = {
  "team-agent": {
    name: "TeamAgent",
    tagline: "Channel-scoped team memory",
    initials: "TB",
    accent: "#ff5a3d",
    starterText: "/ask launch readiness",
    prompts: [
      { label: "Record a decision", text: "We decided to ship docs before launch." },
      { label: "Ask the team", text: "/ask what did we decide about launch readiness?" },
      {
        label: "Summary",
        text: "/summary 24",
        send: true,
      },
      {
        label: "Decisions",
        text: "/decisions",
        send: true,
      },
      {
        label: "Memory",
        text: "/memory",
        send: true,
      },
      {
        label: "Identity",
        text: "/whoami",
        send: true,
      },
    ],
  },
  "personal-agent": {
    name: "PersonalAgent",
    tagline: "Identity-first personal memory",
    initials: "PA",
    accent: "#7c5cff",
    starterText: "/remember I prefer markdown briefs",
    prompts: [
      { label: "Remember a preference", text: "/remember I prefer launch updates that start with blockers." },
      { label: "Mark done", text: "/done " },
      { label: "Recall preferences", text: "/recall launch update preferences" },
      {
        label: "Daily brief",
        text: "/brief",
        send: true,
      },
      {
        label: "Open tasks",
        text: "/tasks",
        send: true,
      },
      {
        label: "Memory",
        text: "/memory",
        send: true,
      },
      {
        label: "Export",
        text: "/export",
        send: true,
      },
    ],
  },
};

const MAX_FILES = 4;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function stableId(key: string) {
  if (typeof window === "undefined") return "server";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = uuid();
  window.localStorage.setItem(key, created);
  return created;
}

function readableSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function attachmentIcon(type: string) {
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("audio/")) return "audio";
  if (type.startsWith("video/")) return "video";
  if (type.includes("pdf")) return "pdf";
  if (type.startsWith("text/") || type.includes("json") || type.includes("csv")) return "text";
  return "file";
}

function fileToAttachment(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Unexpected FileReader result"));
        return;
      }
      const isText = file.type.startsWith("text/") || file.type.includes("json") || file.type.includes("csv");
      if (isText) {
        resolve({
          name: file.name,
          type: file.type || "text/plain",
          size: file.size,
          text: result,
        });
        return;
      }
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        data: base64,
      });
    };
    if (file.type.startsWith("text/") || file.type.includes("json") || file.type.includes("csv")) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

export default function Home() {
  const [target, setTarget] = useState<AgentTarget>("personal-agent");
  const [chatId, setChatId] = useState("demo-chat");
  const [userId, setUserId] = useState("demo-user");
  const [userName, setUserName] = useState("Demo User");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const dragDepthRef = useRef(0);

  const agent = AGENT_INFO[target];

  const sessionLabel = useMemo(
    () => (target === "team-agent" ? `web:chat:${chatId}` : `person:${userId}`),
    [target, chatId, userId],
  );

  useEffect(() => {
    setChatId(stableId("hot-chat-id"));
    setUserId(stableId("hot-user-id"));
    const storedName = window.localStorage.getItem("hot-user-name");
    if (storedName) setUserName(storedName);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("hot-user-name", userName);
    }
  }, [userName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isLoading]);

  useEffect(() => {
    const textarea = composerRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  // The composer textarea is disabled while a request is in flight, which
  // causes the browser to drop focus. Restore focus on the loading→idle
  // transition so the user can keep typing without reaching for the mouse.
  const wasLoadingRef = useRef(false);
  useEffect(() => {
    if (wasLoadingRef.current && !isLoading) {
      composerRef.current?.focus();
    }
    wasLoadingRef.current = isLoading;
  }, [isLoading]);

  const switchTarget = useCallback((nextTarget: AgentTarget) => {
    setTarget(nextTarget);
    setMessages([]);
    setAttachments([]);
    setInput("");
    setErrorBanner(null);
  }, []);

  const sendMessage = useCallback(async (text: string, sentAttachments: ChatAttachment[]) => {
    if (isLoading) return;
    const trimmed = text.trim();
    if (!trimmed && sentAttachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed || (sentAttachments.length > 0 ? "(sent attachments)" : ""),
      attachments: sentAttachments.length > 0 ? sentAttachments : undefined,
      ts: Date.now(),
    };

    const assistantId = `assistant-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMessage,
      { id: assistantId, role: "assistant", content: "", status: "streaming", ts: Date.now() },
    ]);
    setInput("");
    setAttachments([]);
    setIsLoading(true);

    let acc = "";
    let failed: string | null = null;

    const finishMessage = (status: "ok" | "error", finalText: string) => {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? { ...message, content: finalText, status }
            : message,
        ),
      );
    };

    try {
      const replyStream = foldAgentReply(
        streamFromAgent({
          target,
          text: trimmed,
          chatId,
          userId,
          userName,
          attachments: sentAttachments,
        }),
        { label: replyLabelFor(target) },
      );

      let finalText: string | null = null;

      for await (const chunk of replyStream) {
        if (chunk.type === "delta") {
          acc += chunk.text;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: acc } : message,
            ),
          );
        } else if (chunk.type === "end") {
          finalText = chunk.text ?? acc;
          break;
        } else if (chunk.type === "error") {
          failed = chunk.message;
          break;
        }
      }

      if (failed) {
        finishMessage("error", failed);
      } else {
        finishMessage("ok", (finalText ?? acc) || "(no response text)");
      }
    } catch (error) {
      finishMessage("error", error instanceof Error ? error.message : "Agent request failed");
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, target, chatId, userId, userName]);

  const addAttachments = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const existingTotal = attachments.reduce((sum, att) => sum + att.size, 0);
    const incomingTotal = list.reduce((sum, file) => sum + file.size, 0);
    if (existingTotal + incomingTotal > MAX_TOTAL_BYTES) {
      setErrorBanner(`Files must total under ${(MAX_TOTAL_BYTES / (1024 * 1024)).toFixed(0)} MB.`);
      return;
    }

    try {
      const ready = await Promise.all(list.slice(0, MAX_FILES).map(fileToAttachment));
      setAttachments((existing) => [...existing, ...ready].slice(0, MAX_FILES));
      setErrorBanner(null);
    } catch (error) {
      setErrorBanner(error instanceof Error ? error.message : "Could not read file");
    }
  }, [attachments]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    addAttachments(event.target.files);
    event.target.value = "";
  }, [addAttachments]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((existing) => existing.filter((_, i) => i !== index));
  }, []);

  const handlePromptClick = useCallback((prompt: Prompt) => {
    if (prompt.send) {
      sendMessage(prompt.text, attachments);
      return;
    }
    setInput(prompt.text);
    composerRef.current?.focus();
  }, [attachments, sendMessage]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendMessage(input, attachments);
  }, [input, attachments, sendMessage]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input, attachments);
    }
  }, [input, attachments, sendMessage]);

  const handleDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (event.dataTransfer.files.length > 0) {
      addAttachments(event.dataTransfer.files);
    }
  }, [addAttachments]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setAttachments([]);
    setInput("");
    setErrorBanner(null);
  }, []);

  const accentStyle = { "--accent": agent.accent } as React.CSSProperties;

  return (
    <main
      className={`shell ${isDragging ? "dragging" : ""}`}
      style={accentStyle}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span className="brand-dot" />
            <strong>Hot Chat</strong>
          </div>
          <span className="brand-tag">Reference chat client for Hot agents</span>
        </div>

        <div className="agent-switch" role="tablist" aria-label="Active agent">
          {(Object.keys(AGENT_INFO) as AgentTarget[]).map((id) => {
            const info = AGENT_INFO[id];
            return (
              <button
                key={id}
                role="tab"
                type="button"
                aria-selected={target === id}
                className={`agent-pill ${target === id ? "active" : ""}`}
                style={target === id ? { borderColor: info.accent, color: info.accent } : undefined}
                onClick={() => switchTarget(id)}
              >
                <span className="agent-initials" style={{ background: info.accent }}>{info.initials}</span>
                <span className="agent-meta">
                  <span className="agent-name">{info.name}</span>
                  <span className="agent-sub">{info.tagline}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="toolbar">
          <button type="button" className="ghost" onClick={() => setShowIdentity((v) => !v)}>
            {showIdentity ? "Hide identity" : "Identity"}
          </button>
          <button type="button" className="ghost" onClick={clearChat} disabled={messages.length === 0}>
            New chat
          </button>
        </div>
      </header>

      {showIdentity && (
        <section className="identity-card">
          <div className="identity-row">
            <label>
              Display name
              <input value={userName} onChange={(event) => setUserName(event.target.value)} />
            </label>
            <div className="identity-meta">
              <div>
                <span>Session</span>
                <code>{sessionLabel}</code>
              </div>
              <div>
                <span>User identity</span>
                <code>web:user:{userId}</code>
              </div>
            </div>
          </div>
          <p className="identity-note">
            Hot agents see your messages keyed by these IDs. TeamAgent treats <code>session</code>{" "}
            as a channel; PersonalAgent treats your <code>user</code> as the durable memory owner.
          </p>
        </section>
      )}

      <section className="conversation">
        {messages.length === 0 ? (
          <div className="welcome">
            <div className="welcome-card">
              <h1>Chat with {agent.name}</h1>
              <p>{agent.tagline}. Pick a starter or write your own.</p>
              <div className="suggestions">
                {agent.prompts.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    className="suggestion"
                    onClick={() => handlePromptClick(prompt)}
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
              <p className="welcome-hint">
                Slash commands and free text both work. Drag a file in to attach it. Try{" "}
                <code>{agent.starterText}</code>.
              </p>
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map((message) => (
              <article key={message.id} className={`bubble ${message.role} ${message.status || ""}`}>
                <div className="avatar">
                  {message.role === "user"
                    ? (userName?.trim()?.[0]?.toUpperCase() || "U")
                    : agent.initials}
                </div>
                <div className="bubble-body">
                  <div className="bubble-meta">
                    <span className="who">{message.role === "user" ? userName : agent.name}</span>
                    {message.status === "streaming" && <span className="status-pill streaming">streaming</span>}
                    {message.status === "error" && <span className="status-pill error">error</span>}
                  </div>
                  {message.content
                    ? <pre className="content">{message.content}</pre>
                    : message.status === "streaming" && (
                        <div className="typing">
                          <span /> <span /> <span />
                        </div>
                      )}
                  {message.attachments && message.attachments.length > 0 && (
                    <ul className="attachments-inline">
                      {message.attachments.map((att, idx) => (
                        <li key={`${att.name}-${idx}`} className="attachment-chip">
                          <span className={`att-icon ${attachmentIcon(att.type)}`} aria-hidden />
                          <span className="att-name">{att.name}</span>
                          <span className="att-size">{readableSize(att.size)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </article>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </section>

      <form className="composer" onSubmit={handleSubmit}>
        {errorBanner && <div className="error-banner">{errorBanner}</div>}

        {attachments.length > 0 && (
          <ul className="composer-attachments">
            {attachments.map((att, idx) => (
              <li key={`${att.name}-${idx}`} className="attachment-chip removable">
                <span className={`att-icon ${attachmentIcon(att.type)}`} aria-hidden />
                <span className="att-name">{att.name}</span>
                <span className="att-size">{readableSize(att.size)}</span>
                <button type="button" aria-label={`Remove ${att.name}`} onClick={() => removeAttachment(idx)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="composer-row">
          <button
            type="button"
            className="icon-btn"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach files"
            title="Attach files"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M21 12.5L13 20.5C10.79 22.71 7.21 22.71 5 20.5C2.79 18.29 2.79 14.71 5 12.5L13.5 4C14.88 2.62 17.12 2.62 18.5 4C19.88 5.38 19.88 7.62 18.5 9L10.41 17.09C9.92 17.58 9.13 17.58 8.64 17.09C8.15 16.6 8.15 15.81 8.64 15.32L16 7.95"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            onChange={handleFileChange}
          />
          <textarea
            ref={composerRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${agent.name}…  (↵ to send, ⇧↵ for newline, drag files to attach)`}
            rows={1}
            disabled={isLoading}
          />
          <button type="submit" className="send" disabled={isLoading || (!input.trim() && attachments.length === 0)}>
            {isLoading ? "Sending…" : "Send"}
          </button>
        </div>

        <div className="composer-hints">
          <span>Quick:</span>
          {agent.prompts.map((prompt) => (
            <button
              key={prompt.label}
              type="button"
              className="hint-chip"
              onClick={() => handlePromptClick(prompt)}
            >
              {prompt.label}
            </button>
          ))}
        </div>
      </form>

      {isDragging && (
        <div className="drop-overlay" aria-hidden>
          <div className="drop-card">Drop files to attach</div>
        </div>
      )}
    </main>
  );
}
