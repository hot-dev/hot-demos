// Hot Chat agent client — demo-specific command maps on top of @hot-dev/sdk.
//
// The browser POSTs `{eventType, eventData}` to /api/chat. The server route
// (see app/api/chat/route.ts) holds HOT_API_KEY and proxies via @hot-dev/sdk/proxy.

import {
  buildAgentEventData,
  buildWebMessageIds,
  parseSlashCommand,
  type CommandMap,
} from "@hot-dev/sdk/agent";
import type { AgentAttachment } from "@hot-dev/sdk";
import { consumeSseResponse, type StreamEvent } from "@hot-dev/sdk/streaming";

export type { AgentAttachment };
export type { StreamEvent };

export type AgentTarget = "team-agent" | "personal-agent";

export interface AgentChatRequest {
  target: AgentTarget;
  text: string;
  chatId: string;
  streamId?: string | null;
  userId: string;
  userName: string;
  attachments?: AgentAttachment[];
}

export interface AgentEvent {
  eventType: string;
  eventData: Record<string, unknown>;
}

const COMMANDS: Record<AgentTarget, CommandMap> = {
  "team-agent": {
    ask: { event: "team-agent:ask", argKey: "question" },
    summary: { event: "team-agent:summary" },
    decisions: { event: "team-agent:decisions" },
    inbox: { event: "team-agent:inbox" },
    memory: { event: "team-agent:memory" },
    audit: { event: "team-agent:audit" },
    guide: { event: "team-agent:guide" },
    whoami: { event: "team-agent:whoami" },
  },
  "personal-agent": {
    remember: { event: "personal-agent:remember", argKey: "text" },
    done: { event: "personal-agent:done", argKey: "text" },
    recall: { event: "personal-agent:recall", argKey: "query" },
    brief: { event: "personal-agent:brief" },
    tasks: { event: "personal-agent:tasks" },
    inbox: { event: "personal-agent:inbox" },
    memory: { event: "personal-agent:memory" },
    export: { event: "personal-agent:export" },
    privacy: { event: "personal-agent:privacy" },
    guide: { event: "personal-agent:guide" },
    whoami: { event: "personal-agent:whoami" },
  },
};

const FALLBACK_RECORD: Record<AgentTarget, string> = {
  "team-agent": "team-agent:record",
  "personal-agent": "personal-agent:remember",
};

const REPLY_LABEL: Record<AgentTarget, string> = {
  "team-agent": "team-agent",
  "personal-agent": "personal-agent",
};

export function defaultTarget(): AgentTarget {
  return parseTarget(process.env.HOT_AGENT_TARGET);
}

export function parseTarget(value: unknown): AgentTarget {
  return value === "team-agent" ? "team-agent" : "personal-agent";
}

export function replyLabelFor(target: AgentTarget): string {
  return REPLY_LABEL[target];
}

export function buildEvent(input: AgentChatRequest): AgentEvent {
  const ids = buildWebMessageIds({
    userId: input.userId,
    chatId: input.chatId,
    sessionMode: input.target === "team-agent" ? "chat" : "person",
  });

  const { event, payload } = parseSlashCommand(input.text, COMMANDS[input.target], {
    fallbackEvent: FALLBACK_RECORD[input.target],
  });

  const eventData = buildAgentEventData({
    session_id: ids.sessionId,
    user_id: `web:user:${ids.userBare}`,
    user_name: input.userName || "Demo User",
    message_id: ids.messageId,
    payload,
    attachments: input.attachments,
    metadata: {
      client: "hot-chat",
      target: input.target,
    },
  });

  return { eventType: event, eventData };
}

/** Stream an event through /api/chat and yield parsed Hot run-stream events. */
export async function* streamFromAgent(input: AgentChatRequest): AsyncGenerator<StreamEvent> {
  const event = buildEvent(input);

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      eventType: event.eventType,
      eventData: event.eventData,
      ...(input.streamId ? { streamId: input.streamId } : {}),
    }),
  });

  if (!response.ok || !response.body) {
    let errorText: string;
    try {
      errorText = await response.text();
    } catch {
      errorText = `Agent request failed (${response.status})`;
    }
    throw new Error(errorText || `Agent request failed (${response.status})`);
  }

  yield* consumeSseResponse(async () => response);
}
