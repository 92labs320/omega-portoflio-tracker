import { ArrowLeft, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router';
import { StatusBar } from '../components/StatusBar';
import { BottomNav } from '../components/BottomNav';
import { PieChart, Pie, Cell } from 'recharts';

const allocationData = [
  { name: 'Bitcoin', value: 35, color: '#F7931A' },
  { name: 'Ethereum', value: 28, color: '#627EEA' },
  { name: 'Stocks', value: 22, color: '#A3AAAE' },
  { name: 'Solana', value: 15, color: '#14F195' },
];

const holdings = [
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    amount: '0.234 BTC',
    value: '$9,963.78',
    allocation: '35%',
    change24h: '+5.23%',
    isPositive: true,
    color: '#F7931A',
    icon: '₿',
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    amount: '2.45 ETH',
    value: '$8,021.21',
    allocation: '28%',
    change24h: '+2.89%',
    isPositive: true,
    color: '#627EEA',
    icon: '◆',
  },
  {
    id: 'aapl',
    name: 'Apple Inc.',
    symbol: 'AAPL',
    amount: '12 shares',
    value: '$6,302.04',
    allocation: '22%',
    change24h: '-1.24%',
    isPositive: false,
    color: '#A3AAAE',
    icon: '',
  },
  {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    amount: '45.2 SOL',
    value: '$4,360.03',
    allocation: '15%',
    change24h: '+8.12%',
    isPositive: true,
    color: '#14F195',
    icon: '◎',
  },
];

export function Portfolio() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-[375px] h-[812px] bg-[#0A0A0F] overflow-y-auto scrollbar-hide relative">
        <StatusBar />
        
        {/* Header */}
        <div className="px-5 pt-4 pb-6">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/')} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-white text-2xl font-bold">Portfolio</h1>
          </div>

          {/* Total Value Card */}
          <div className="bg-[#12121C] rounded-3xl p-5">
            <div className="text-white/60 text-sm mb-2">Total Value</div>
            <div className="flex items-end justify-between gap-3 mb-4">
              <div className="text-white text-3xl font-bold">$28,647.06</div>
              <div className="flex items-center gap-2 bg-[#00D964]/20 px-3 py-1.5 rounded-full">
                <TrendingUp className="w-4 h-4 text-[#00D964]" />
                <span className="text-[#00D964] text-sm font-semibold">+14.59%</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
              <div>
                <div className="text-white/60 text-xs mb-1">Total Invested</div>
                <div className="text-white font-semibold">$25,000.00</div>
              </div>
              <div>
                <div className="text-white/60 text-xs mb-1">Total P&L</div>
                <div className="text-[#00D964] font-semibold">+$3,647.06</div>
              </div>
            </div>
          </div>
        </div>

        {/* Asset Allocation */}
        <div className="px-6 pb-6">
          <h2 className="text-white text-lg font-bold mb-4">Asset Allocation</h2>
          <div className="bg-[#12121C] rounded-3xl p-6">
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 flex-shrink-0">
                <PieChart width={128} height={128}>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {allocationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </div>
              <div className="flex-1 space-y-2">
                {allocationData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-white/80 text-sm">{item.name}</span>
                    </div>
                    <span className="text-white font-semibold text-sm">{item.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* All Holdings */}
        <div className="px-6 pb-6">
          <h2 className="text-white text-lg font-bold mb-4">All Holdings</h2>
          <div className="space-y-[10px]">
            {holdings.map((holding) => (
              <button
                key={holding.id}
                onClick={() => navigate(`/asset/${holding.id}`)}
                className="w-full h-[72px] bg-[#12121C] rounded-2xl px-4 flex items-center gap-3 text-left"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
                  style={{ backgroundColor: `${holding.color}20`, color: holding.color }}
                >
                  {holding.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold">{holding.name}</div>
                  <div className="text-white/60 text-sm">{holding.amount}</div>
                </div>
                <div
                  className={`text-sm font-semibold flex-shrink-0 ${
                    holding.isPositive ? 'text-[#00D964]' : 'text-red-500'
                  }`}
                >
                  {holding.change24h}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="h-24" />
        <BottomNav />
      </div>
    </div>
  );
}