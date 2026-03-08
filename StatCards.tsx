export function StatCards() {
  const stats = [
    { label: 'Invested', value: '$25,000.00', color: 'text-white' },
    { label: 'P&L', value: '+$3,647.06', color: 'text-[#00D964]' },
    { label: 'Return', value: '+14.59%', color: 'text-[#00D964]' },
  ];

  return (
    <div className="px-5 py-4 flex gap-2">
      {stats.map((stat) => (
        <div key={stat.label} className="flex-1 bg-[#12121C] rounded-2xl px-[10px] py-3">
          <div className="text-white/60 text-[11px] mb-1">{stat.label}</div>
          <div className={`${stat.color} text-base font-bold`}>{stat.value}</div>
        </div>
      ))}
    </div>
  );
}