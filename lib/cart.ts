import { useState, useEffect } from "react";

export type CartItem = {
  productId: string;
  size?: string;
  quantity: number;
};

const STORAGE_KEY = "moda-cart";
const MAX_ITEMS = 100;
const MAX_QUANTITY = 99;

/**
 * Yerel storage'dan gelen veriyi doğrula. Saldırgan storage'a manuel
 * şey yazıp uygulamayı çökertmeye çalışabilir — defensive parse.
 */
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
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(raw)) {
      // Yanlış tip → temizle
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return raw
      .slice(0, MAX_ITEMS) // 100'den fazlasını at
      .map(sanitizeItem)
      .filter((x): x is CartItem => x !== null);
  } catch {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    return [];
  }
}

function writeSafe(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
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
    existing.quantity = Math.min(
      Math.floor(quantity),
      MAX_QUANTITY,
    );
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
      localStorage.removeItem(STORAGE_KEY);
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
      if (e.key === STORAGE_KEY) {
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
