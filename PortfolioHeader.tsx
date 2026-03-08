export function PortfolioHeader() {
  return (
    <div className="px-5 pt-[52px] pb-2">
      <div className="text-white/60 text-sm mb-1">Total Portfolio Value</div>
      <div className="flex items-center gap-3">
        <h1 className="text-white text-4xl font-bold">$28,647.06</h1>
        <div className="bg-[#00D964]/20 px-3 py-1 rounded-full">
          <span className="text-[#00D964] text-sm font-semibold">+3.24%</span>
        </div>
      </div>
    </div>
  );
}