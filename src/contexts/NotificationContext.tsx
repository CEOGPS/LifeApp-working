import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type NotificationPriority = "info" | "warning" | "error" | "success";

export interface AppNotification {
  id: number;
  message: string;
  priority: NotificationPriority;
  timestamp: Date;
  read: boolean;
}

export interface NotificationContextValue {
  notifications: AppNotification[];
  addNotification: (message: string, priority?: NotificationPriority) => number;
  markRead: (id: number) => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider = ({
  children,
}: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const addNotification = useCallback(
    (message: string, priority: NotificationPriority = "info") => {
      const id = Date.now();
      setNotifications((prev) => [
        { id, message, priority, timestamp: new Date(), read: false },
        ...prev,
      ]);
      return id;
    },
    [],
  );

  const markRead = useCallback((id: number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, addNotification, markRead, clearAll, unreadCount }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextValue => {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a NotificationProvider",
    );
  }
  return ctx;
};