// Text and calls for the Communications panel. CRM contacts do not belong here.
import { useCallback, useEffect, useState } from "react";

export interface CommsConversation {
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
}

export interface CommsMessage {
  id?: string;
  sender_type: "me" | "them";
  content: string;
  time?: string;
  date?: string;
  platform?: string;
}

interface Store {
  conversations: CommsConversation[];
  messages: Record<string, CommsMessage[]>;
}

const KEY = "lifeos_comms";

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

export function useMessaging() {
  const [store, setStore] = useState<Store>(() => load());

  useEffect(() => {
    save(store);
  }, [store]);

  const sendMessage = useCallback(async (convId: string, platform: string, text: string) => {
    const msg: CommsMessage = {
      id: crypto.randomUUID(),
      sender_type: "me",
      content: text,
      platform,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date().toISOString(),
    };
    setStore((prev) => ({
      conversations: prev.conversations.map((c) =>
        c.id === convId ? { ...c, lastMessage: text, lastTime: Date.now(), platforms: c.platforms?.length ? c.platforms : [platform] } : c,
      ),
      messages: { ...prev.messages, [convId]: [...(prev.messages[convId] ?? []), msg] },
    }));
  }, []);

  const fetchConversationMessages = useCallback(async (_convId?: string) => {
    setStore(load());
  }, []);

  const startChat = useCallback(async (name: string, platform: string) => {
    const clean = name.trim();
    if (!clean) return;
    const id = crypto.randomUUID();
    const conv: CommsConversation = {
      id,
      contact_name: clean,
      contact_initials: clean.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(),
      platforms: [platform],
      unread_count: 0,
      lastMessage: "",
      lastTime: Date.now(),
    };
    setStore((prev) => ({ ...prev, conversations: [conv, ...prev.conversations] }));
    return id;
  }, []);

  const syncPlatform = useCallback(async (_platform: string) => {
    setStore(load());
  }, []);

  return {
    conversations: store.conversations,
    messages: store.messages,
    loading: false,
    sendMessage,
    fetchConversationMessages,
    startChat,
    syncPlatform,
  };
}
