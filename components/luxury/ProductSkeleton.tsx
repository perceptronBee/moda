export function ProductSkeleton() {
  return (
    <div className="flex flex-col gap-3 bg-[#161616] border border-white/5 p-4 rounded-none animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]">
      {/* Tall block for the image placeholder */}
      <div className="w-full aspect-[3/4] bg-white/5 rounded-none" />
      
      {/* Thin horizontal blocks for brand, title, and price */}
      <div className="space-y-2 mt-2">
        <div className="h-3 w-1/3 bg-white/10 rounded-none" />
        <div className="h-4 w-3/4 bg-white/10 rounded-none" />
        <div className="h-4 w-1/4 bg-white/10 rounded-none" />
      </div>

      {/* Button placeholder */}
      <div className="h-10 w-full bg-white/5 rounded-none mt-4" />
    </div>
  );
}
