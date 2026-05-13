import { useState, useEffect } from 'react';

export type CartItem = {
  productId: string;
  size?: string;
  quantity: number;
};

type Listener = () => void;
const listeners = new Set<Listener>();

export const cartStore = {
  getItems: (): CartItem[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('moda-cart') || '[]');
    } catch {
      return [];
    }
  },
  addItem: (productId: string, size?: string) => {
    const items = cartStore.getItems();
    const existing = items.find(i => i.productId === productId && i.size === size);
    if (existing) {
      existing.quantity += 1;
    } else {
      items.push({ productId, size, quantity: 1 });
    }
    localStorage.setItem('moda-cart', JSON.stringify(items));
    cartStore.emit();
  },
  updateQuantity: (productId: string, size: string | undefined, quantity: number) => {
    const items = cartStore.getItems();
    const existing = items.find(i => i.productId === productId && i.size === size);
    if (existing) {
      if (quantity <= 0) {
        cartStore.removeItem(productId, size);
        return;
      }
      existing.quantity = quantity;
      localStorage.setItem('moda-cart', JSON.stringify(items));
      cartStore.emit();
    }
  },
  removeItem: (productId: string, size?: string) => {
    const items = cartStore.getItems().filter(i => !(i.productId === productId && i.size === size));
    localStorage.setItem('moda-cart', JSON.stringify(items));
    cartStore.emit();
  },
  clear: () => {
    localStorage.removeItem('moda-cart');
    cartStore.emit();
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit: () => {
    listeners.forEach(l => l());
  }
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
      if (e.key === 'moda-cart') {
        setItems(cartStore.getItems());
      }
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return { items: mounted ? items : [], mounted, ...cartStore };
}
