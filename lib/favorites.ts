import { useState, useEffect } from "react";

const STORAGE_PREFIX = "moda-favorites";
const MAX_ITEMS = 500;

function storageKey(): string {
  if (typeof document === "undefined") return `${STORAGE_PREFIX}:guest`;
  const m = document.cookie.match(/(?:^|;\s*)moda-uid=([^;]+)/);
  const uid = m ? decodeURIComponent(m[1]).slice(0, 64) : "guest";
  return `${STORAGE_PREFIX}:${uid}`;
}

function readSafe(): string[] {
  if (typeof window === "undefined") return [];
  const key = storageKey();
  try {
    const raw = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(raw)) {
      localStorage.removeItem(key);
      return [];
    }
    return raw
      .slice(0, MAX_ITEMS)
      .filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64);
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {}
    return [];
  }
}

function writeSafe(items: string[]) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {}
}

type Listener = () => void;
const listeners = new Set<Listener>();

export const favoritesStore = {
  getItems: (): string[] => readSafe(),
  toggleItem: (productId: string) => {
    if (typeof productId !== "string" || !productId || productId.length > 64)
      return;
    let items = readSafe();
    if (items.includes(productId)) {
      items = items.filter((id) => id !== productId);
    } else {
      items.push(productId);
    }
    writeSafe(items);
    favoritesStore.emit();
  },
  hasItem: (productId: string) => readSafe().includes(productId),
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit: () => {
    listeners.forEach((l) => l());
  },
};

export function useFavorites() {
  const [items, setItems] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(favoritesStore.getItems());

    const unsubscribe = favoritesStore.subscribe(() => {
      setItems(favoritesStore.getItems());
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(STORAGE_PREFIX)) {
        setItems(favoritesStore.getItems());
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return {
    items: mounted ? items : [],
    mounted,
    toggleItem: favoritesStore.toggleItem,
    hasItem: favoritesStore.hasItem,
  };
}
