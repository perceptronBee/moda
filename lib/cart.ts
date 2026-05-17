import { useState, useEffect } from "react";

export type CartItem = {
  productId: string;
  size?: string;
  quantity: number;
};

const STORAGE_PREFIX = "moda-cart";
const GUEST_KEY = `${STORAGE_PREFIX}:guest`;
const MAX_ITEMS = 100;
const MAX_QUANTITY = 99;

/**
 * Aktif kullanıcının storage anahtarı.
 * Cookie'den Supabase user ID hash'i okunur — paylaşılan cihazlarda
 * iki farklı kullanıcı birbirinin sepetini görmesin.
 */
function storageKey(): string {
  if (typeof document === "undefined") return GUEST_KEY;
  // Basit bir kullanıcı parmak izi: Supabase auth cookie'sinin tag'ini al
  // Bu cookie HttpOnly olmayan kısa bir parmak izi olabilir (örn. moda-uid)
  // Yoksa guest'e düş
  const m = document.cookie.match(/(?:^|;\s*)moda-uid=([^;]+)/);
  const uid = m ? decodeURIComponent(m[1]).slice(0, 64) : "guest";
  return `${STORAGE_PREFIX}:${uid}`;
}

function sanitizeItem(raw: unknown): CartItem | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const productId = typeof obj.productId === "string" ? obj.productId.slice(0, 64) : null;
  if (!productId) return null;
  const size = typeof obj.size === "string" ? obj.size.slice(0, 16) : undefined;
  const qRaw = Number(obj.quantity);
  const quantity = Number.isFinite(qRaw) && qRaw > 0
    ? Math.min(Math.floor(qRaw), MAX_QUANTITY)
    : 1;
  return { productId, size, quantity };
}

function readSafe(): CartItem[] {
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
      .map(sanitizeItem)
      .filter((x): x is CartItem => x !== null);
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {}
    return [];
  }
}

function writeSafe(items: CartItem[]) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {}
}

type Listener = () => void;
const listeners = new Set<Listener>();

export const cartStore = {
  getItems: (): CartItem[] => readSafe(),
  addItem: (productId: string, size?: string) => {
    if (typeof productId !== "string" || !productId) return;
    const items = readSafe();
    const existing = items.find(
      (i) => i.productId === productId && i.size === size,
    );
    if (existing) {
      existing.quantity = Math.min(existing.quantity + 1, MAX_QUANTITY);
    } else {
      items.push({ productId: productId.slice(0, 64), size: size?.slice(0, 16), quantity: 1 });
    }
    writeSafe(items);
    cartStore.emit();
  },
  updateQuantity: (
    productId: string,
    size: string | undefined,
    quantity: number,
  ) => {
    const items = readSafe();
    const existing = items.find(
      (i) => i.productId === productId && i.size === size,
    );
    if (!existing) return;
    if (quantity <= 0) {
      cartStore.removeItem(productId, size);
      return;
    }
    existing.quantity = Math.min(Math.floor(quantity), MAX_QUANTITY);
    writeSafe(items);
    cartStore.emit();
  },
  removeItem: (productId: string, size?: string) => {
    const items = readSafe().filter(
      (i) => !(i.productId === productId && i.size === size),
    );
    writeSafe(items);
    cartStore.emit();
  },
  clear: () => {
    try {
      localStorage.removeItem(storageKey());
    } catch {}
    cartStore.emit();
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit: () => {
    listeners.forEach((l) => l());
  },
};

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setItems(cartStore.getItems());

    const unsubscribe = cartStore.subscribe(() => {
      setItems(cartStore.getItems());
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(STORAGE_PREFIX)) {
        setItems(cartStore.getItems());
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      unsubscribe();
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return { items: mounted ? items : [], mounted, ...cartStore };
}
