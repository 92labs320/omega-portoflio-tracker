import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

const chartData = [
  { value: 24000 },
  { value: 25200 },
  { value: 24800 },
  { value: 26500 },
  { value: 25900 },
  { value: 27200 },
  { value: 26800 },
  { value: 28100 },
  { value: 27500 },
  { value: 28647 },
];

export function PortfolioChart() {
  return (
    <div className="px-5 pt-4 pb-2 h-[200px]">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D964" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#00D964" stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#00D964"
            strokeWidth={2}
            fill="url(#colorValue)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}