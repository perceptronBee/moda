import Image from 'next/image';
import type { AffiliateProduct } from '@/types/affiliate';

interface ProductCardProps {
  product: AffiliateProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <div className="flex flex-col h-full bg-[#161616] border border-white/5 p-4 rounded-none group">
      {/* Edge-to-edge high-resolution image at the top */}
      <div className="relative w-full aspect-[3/4] overflow-hidden rounded-none mb-4 bg-[#0D0D0D]">
        <Image 
          src={product.image_url} 
          alt={product.title} 
          fill 
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
      </div>
      
      {/* Content below image */}
      <div className="flex flex-col flex-grow">
        <span className="text-[10px] uppercase tracking-widest text-[#808080] mb-1">
          {product.brand}
        </span>
        <h3 className="text-sm font-medium text-white tracking-wide mb-2 line-clamp-1">
          {product.title}
        </h3>
        <p className="text-sm font-bold text-white mt-auto">
          {product.price.toLocaleString('tr-TR')} TL
        </p>
      </div>

      {/* Minimalist "SHOP THE LOOK" button */}
      <a 
        href={product.product_url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="mt-4 w-full flex items-center justify-center bg-white text-black h-10 text-xs font-semibold tracking-widest uppercase hover:bg-gray-200 transition-colors rounded-none"
      >
        SATIN AL
      </a>
    </div>
  );
}
