"use client";

import { useEffect, useState } from 'react';
import type { AffiliateProduct } from '@/types/affiliate';
import { ProductCard } from './ProductCard';
import { ProductSkeleton } from './ProductSkeleton';

export function ProductGrid() {
  const [data, setData] = useState<AffiliateProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products');
        if (!res.ok) throw new Error('Failed to fetch products');
        const products: AffiliateProduct[] = await res.json();
        setData(products);
      } catch (err) {
        setError('Veriler çekilirken bir hata oluştu.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (error) {
    return (
      <div className="w-full py-20 text-center text-[#808080] border border-white/5 bg-[#161616]">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6 w-full">
      {isLoading 
        ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />)
        : data.map((product) => <ProductCard key={product.id} product={product} />)
      }
    </div>
  );
}
