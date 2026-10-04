// localStorage utilities with error handling and type safety

export function loadLocal<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

export function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`[localStorage] Failed to save ${key}:`, e);
  }
}

export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[localStorage] Failed to remove ${key}:`, e);
  }
}

export function clearLocal(): void {
  try {
    localStorage.clear();
  } catch (e) {
    console.warn("[localStorage] Failed to clear:", e);
  }
}

// Namespaced localStorage for LifeOS1
const NAMESPACE = "lifeos1:";

export const localStorageDB = {
  get: <T>(key: string, defaultValue: T): T => loadLocal(`${NAMESPACE}${key}`, defaultValue),
  set: <T>(key: string, value: T): void => saveLocal(`${NAMESPACE}${key}`, value),
  remove: (key: string): void => removeLocal(`${NAMESPACE}${key}`),
  clear: (): void => {
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(NAMESPACE)) localStorage.removeItem(k);
      });
    } catch (e) {
      console.warn("[localStorageDB] Failed to clear namespace:", e);
    }
  },
  keys: (): string[] => {
    try {
      return Object.keys(localStorage).filter(k => k.startsWith(NAMESPACE)).map(k => k.slice(NAMESPACE.length));
    } catch {
      return [];
    }
  },
};