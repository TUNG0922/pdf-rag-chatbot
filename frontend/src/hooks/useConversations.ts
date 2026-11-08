import { useState, useEffect, useCallback } from "react";

export interface ChatSource {
  filename: string;
  page_number: number;
  chunk_id: string;
  distance: number;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

function storageKey(username: string) {
  return `chat_conversations:${username}`;
}

function load(username: string): Conversation[] {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(username: string, conversations: Conversation[]) {
  localStorage.setItem(storageKey(username), JSON.stringify(conversations));
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Derive a short conversation title from the first user message.
 */
export function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 40 ? `${text.slice(0, 40)}...` : text || "New chat";
}

/**
 * Manage a per-user list of conversations, persisted to localStorage.
 */
export function useConversations(username: string) {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    load(username)
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  // Reload when the user changes (e.g. after login as a different account).
  useEffect(() => {
    const loaded = load(username);
    setConversations(loaded);
    setActiveId(loaded.length > 0 ? loaded[0].id : null);
  }, [username]);

  // Persist whenever conversations change.
  useEffect(() => {
    save(username, conversations);
  }, [username, conversations]);

  const createConversation = useCallback(() => {
    let createdId = "";
    setConversations((prev) => {
      // If there is already an empty conversation, reuse it instead of
      // creating another one.
      const existingEmpty = prev.find((c) => c.messages.length === 0);
      if (existingEmpty) {
        createdId = existingEmpty.id;
        return prev;
      }
      const convo: Conversation = {
        id: newId(),
        title: "New chat",
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      createdId = convo.id;
      return [convo, ...prev];
    });
    setActiveId(createdId);
    return createdId;
  }, []);

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id);
        setActiveId((current) => {
          if (current !== id) return current;
          return next.length > 0 ? next[0].id : null;
        });
        return next;
      });
    },
    []
  );

  const updateMessages = useCallback(
    (id: string, messages: ChatMessage[]) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, messages, updatedAt: Date.now() }
            : c
        )
      );
    },
    []
  );

  // Set an explicit title (e.g. an LLM-generated summary). Only replaces a
  // placeholder title so we don't clobber something already meaningful.
  const setTitle = useCallback((id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id &&
        (c.title === "New chat" || c.title === "" || c.title === undefined)
          ? { ...c, title: clean }
          : c
      )
    );
  }, []);

  const activeConversation =
    conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    createConversation,
    deleteConversation,
    updateMessages,
    setTitle,
  };
}
