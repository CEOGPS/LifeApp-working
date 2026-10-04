import { useCallback, useEffect, useState } from "react";

export type Conversation = {
  id: string;
  contact_name: string;
  contact_initials?: string;
  contact_email?: string;
  contact_phone?: string;
  is_group?: boolean;
  platforms?: string[];
  unread_count?: number;
  lastMessage?: string;
  lastTime?: number;
};

export type ChatMessage = {
  id?: string;
  sender_type: "me" | "them";
  content: string;
  time?: string;
  date?: string;
  platform?: string;
};

type Store = {
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
};

const KEY = "lifeos_live_chats";

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { conversations: [], messages: {} };
    const parsed = JSON.parse(raw) as Store;
    return {
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      messages: parsed.messages && typeof parsed.messages === "object" ? parsed.messages : {},
    };
  } catch {
    return { conversations: [], messages: {} };
  }
}

function save(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function useMessaging(_uid?: string) {
  const [store, setStore] = useState<Store>(() => load());

  useEffect(() => {
    save(store);
  }, [store]);

  const sendMessage = useCallback(async (convId: string, platform: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      sender_type: "me",
      content: trimmed,
      platform,
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setStore((prev) => {
      const existing = prev.conversations.find((c) => c.id === convId);
      const conversations = existing
        ? prev.conversations.map((c) =>
            c.id === convId
              ? { ...c, lastMessage: trimmed, lastTime: Date.now(), platforms: c.platforms?.length ? c.platforms : [platform] }
              : c,
          )
        : [
            {
              id: convId,
              contact_name: convId,
              platforms: [platform],
              lastMessage: trimmed,
              lastTime: Date.now(),
              unread_count: 0,
            },
            ...prev.conversations,
          ];
      return {
        conversations,
        messages: { ...prev.messages, [convId]: [...(prev.messages[convId] || []), msg] },
      };
    });
  }, []);

  const fetchConversationMessages = useCallback(async (_convId?: string) => {
    setStore(load());
  }, []);

  const syncPlatform = useCallback(async (platform: string) => {
    throw new Error(`${platform} is not connected`);
  }, []);

  const startChat = useCallback(async (name: string, platform: string) => {
    const id = crypto.randomUUID();
    const conversation: Conversation = {
      id,
      contact_name: name.trim() || "New chat",
      contact_initials: (name.trim() || "?").slice(0, 2).toUpperCase(),
      platforms: [platform],
      unread_count: 0,
      lastMessage: "",
      lastTime: Date.now(),
    };
    setStore((prev) => ({
      conversations: [conversation, ...prev.conversations],
      messages: { ...prev.messages, [id]: [] },
    }));
    return id;
  }, []);

  return {
    conversations: store.conversations,
    messages: store.messages,
    loading: false,
    sendMessage,
    fetchConversationMessages,
    syncPlatform,
    startChat,
  };
}
