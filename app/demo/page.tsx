import { ProductGrid } from "@/components/luxury/ProductGrid";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#0D0D0D] text-white p-6 lg:p-10 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10 border-b border-white/10 pb-6">
          <h1 className="text-xs tracking-widest uppercase text-[#808080] mb-2">Simülasyon Ortamı</h1>
          <h2 className="text-3xl font-light tracking-wide">API & XML Veri Çekme Demosu</h2>
          <p className="text-[#808080] mt-2 text-sm max-w-2xl">
            Bu sayfa, ana siteyi etkilemeden jüri sunumu için hazırlanmıştır. 
            Arkada gerçek bir API endpoint'i (<code>/api/products</code>) çalışır ve XML/Partner verilerinin çekilmesi anındaki 1.5 saniyelik Skeleton yükleme ekranını (Luxury Minimalist) simüle eder.
          </p>
        </div>
        
        {/* Render the grid simulation */}
        <ProductGrid />
      </div>
    </div>
  );
}
