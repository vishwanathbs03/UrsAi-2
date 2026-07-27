"use client";

/**
 * Frontend service for the Sprint 7 Part 3 conversation
 * persistence endpoints.
 *
 * Five calls map 1:1 to the backend routes:
 *
 *   POST   /api/v1/chat                  createSession
 *   GET    /api/v1/chat                  listSessions
 *   GET    /api/v1/chat/{id}             getSession
 *   DELETE /api/v1/chat/{id}             deleteSession
 *   POST   /api/v1/chat/{id}/message     appendMessage
 *
 * Every call goes through the shared `apiClient` so the
 * cookie-based auth and JSON encoding stay in one place.
 *
 * The service is intentionally thin — it does no caching,
 * no retry, no optimistic update. The Sprint 7 Part 1
 * assistant's component-local Conversation stays the
 * default rendering path; the new server-side session
 * is an opt-in layered on top of it.
 */

import { apiClient, ApiError } from "./api-client";

export interface ChatSource {
  topic: string;
  detail: string;
}

export interface ChatMessageOut {
  id: number;
  role: "user" | "assistant";
  kind: string;
  content: string;
  sources: ChatSource[];
  created_at: string;
}

export interface ChatSessionSummary {
  id: number;
  title: string;
  summary: string;
  message_count: number;
  last_model: string;
  fallback_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatSessionDetail extends ChatSessionSummary {
  messages: ChatMessageOut[];
}

export interface ChatMessageAppendResponse {
  user_message: ChatMessageOut;
  assistant_message: ChatMessageOut;
  session: ChatSessionDetail;
}

export const chatService = {
  async listSessions(): Promise<ChatSessionSummary[]> {
    const payload = await apiClient.get<{ sessions: ChatSessionSummary[]; count: number }>(
      "/api/v1/chat"
    );
    return payload.sessions;
  },

  async getSession(sessionId: number): Promise<ChatSessionDetail> {
    return apiClient.get<ChatSessionDetail>(`/api/v1/chat/${sessionId}`);
  },

  async createSession(title = ""): Promise<ChatSessionDetail> {
    return apiClient.post<ChatSessionDetail>("/api/v1/chat", { title });
  },

  async deleteSession(sessionId: number): Promise<{ deleted: boolean; id: number }> {
    return apiClient.delete<{ deleted: boolean; id: number }>(`/api/v1/chat/${sessionId}`);
  },

  async appendMessage(
    sessionId: number,
    content: string,
  ): Promise<ChatMessageAppendResponse> {
    return apiClient.post<ChatMessageAppendResponse>(
      `/api/v1/chat/${sessionId}/message`,
      { content },
    );
  },
};

export { ApiError };