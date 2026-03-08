const periods = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

export function TimeFilter() {
  return (
    <div className="px-5 py-4 flex gap-1.5 justify-center">
      {periods.map((period) => (
        <button
          key={period}
          className={`px-[10px] py-2 rounded-full text-[11px] font-semibold transition-colors ${
            period === '1M'
              ? 'bg-[#00D964] text-[#0A0A0F]'
              : 'bg-[#12121C] text-white/60 hover:text-white'
          }`}
        >
          {period}
        </button>
      ))}
    </div>
  );
}