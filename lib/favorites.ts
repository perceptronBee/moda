import { useState, useEffect } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();

export const favoritesStore = {
  getItems: (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('moda-favorites') || '[]');
    } catch {
      return [];
    }
  },
  toggleItem: (productId: string) => {
    let items = favoritesStore.getItems();
    if (items.includes(productId)) {
      items = items.filter(id => id !== productId);
    } else {
      items.push(productId);
    }
    localStorage.setItem('moda-favorites', JSON.stringify(items));
    favoritesStore.emit();
  },
  hasItem: (productId: string) => {
    return favoritesStore.getItems().includes(productId);
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  emit: () => {
    listeners.forEach(l => l());
  }
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
      if (e.key === 'moda-favorites') {
        setItems(favoritesStore.getItems());
      }
    };
    window.addEventListener('storage', handleStorage);
    
    return () => {
      unsubscribe();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return { 
    items: mounted ? items : [], 
    mounted, 
    toggleItem: favoritesStore.toggleItem,
    hasItem: favoritesStore.hasItem
  };
}
