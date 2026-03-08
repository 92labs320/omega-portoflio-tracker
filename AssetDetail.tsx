import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { useState } from 'react';
import { StatusBar } from '../components/StatusBar';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

const assetData: Record<string, any> = {
  btc: {
    name: 'Bitcoin',
    symbol: 'BTC',
    price: '$42,580.20',
    change: '+5.23%',
    change24h: '+$2,115.40',
    isPositive: true,
    color: '#F7931A',
    icon: '₿',
    holdings: '0.234 BTC',
    value: '$9,963.78',
    avgBuyPrice: '$38,200.00',
    profitLoss: '+$1,025.05',
    returnPercent: '+10.24%',
    portfolioPercent: '34.8%',
  },
  eth: {
    name: 'Ethereum',
    symbol: 'ETH',
    price: '$2,245.80',
    change: '+2.89%',
    change24h: '+$63.12',
    isPositive: true,
    color: '#627EEA',
    icon: '◆',
    holdings: '2.45 ETH',
    value: '$8,021.21',
    avgBuyPrice: '$2,100.00',
    profitLoss: '+$357.21',
    returnPercent: '+6.94%',
    portfolioPercent: '28.0%',
  },
  aapl: {
    name: 'Apple Inc.',
    symbol: 'AAPL',
    price: '$178.42',
    change: '-1.24%',
    change24h: '-$2.24',
    isPositive: false,
    color: '#A3AAAE',
    icon: '',
    holdings: '12 shares',
    value: '$6,302.04',
    avgBuyPrice: '$182.50',
    profitLoss: '-$48.96',
    returnPercent: '-2.24%',
    portfolioPercent: '22.0%',
  },
  sol: {
    name: 'Solana',
    symbol: 'SOL',
    price: '$98.65',
    change: '+8.12%',
    change24h: '+$7.41',
    isPositive: true,
    color: '#14F195',
    icon: '◎',
    holdings: '45.2 SOL',
    value: '$4,360.03',
    avgBuyPrice: '$85.00',
    profitLoss: '+$617.03',
    returnPercent: '+16.06%',
    portfolioPercent: '15.2%',
  },
};

const chartData = [
  { value: 38000 },
  { value: 39500 },
  { value: 38800 },
  { value: 40200 },
  { value: 39900 },
  { value: 41500 },
  { value: 40800 },
  { value: 42100 },
  { value: 41500 },
  { value: 42580 },
];

const transactions = [
  { type: 'Buy', amount: '0.134 BTC', price: '$38,200.00', date: 'Mar 5, 2026', total: '$5,118.80' },
  { type: 'Buy', amount: '0.100 BTC', price: '$38,200.00', date: 'Feb 20, 2026', total: '$3,820.00' },
];

export function AssetDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedPeriod, setSelectedPeriod] = useState('1M');
  const periods = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];

  const asset = assetData[id || 'btc'];

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-[375px] h-[812px] bg-[#0A0A0F] overflow-y-auto scrollbar-hide relative">
        <StatusBar />
        
        {/* Header */}
        <div className="px-6 pt-4 pb-4">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
                style={{ backgroundColor: `${asset.color}20`, color: asset.color }}
              >
                {asset.icon}
              </div>
              <div>
                <div className="text-white font-bold">{asset.name}</div>
                <div className="text-white/60 text-sm">{asset.symbol}</div>
              </div>
            </div>
            <div className="w-10" />
          </div>

          {/* Price */}
          <div className="mb-2">
            <div className="text-white text-4xl font-bold mb-2">{asset.price}</div>
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-1 ${
                  asset.isPositive ? 'text-[#00D964]' : 'text-red-500'
                }`}
              >
                {asset.isPositive ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="font-semibold">{asset.change}</span>
              </div>
              <span className="text-white/60 text-sm">{asset.change24h} today</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="px-6 pb-4 h-[220px]">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={asset.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={asset.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Area
                type="monotone"
                dataKey="value"
                stroke={asset.color}
                strokeWidth={2}
                fill={`url(#gradient-${id})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Time Filter */}
        <div className="px-6 pb-6 flex justify-center gap-2">
          {periods.map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-[10px] py-2 rounded-full text-sm font-semibold transition-colors ${
                period === selectedPeriod
                  ? 'bg-[#00D964] text-[#0A0A0F]'
                  : 'bg-[#12121C] text-white/60 hover:text-white'
              }`}
            >
              {period}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button className="flex-1 bg-[#00D964] text-black py-4 rounded-2xl font-bold">
            Buy
          </button>
          <button className="flex-1 bg-[#12121C] text-white py-4 rounded-2xl font-bold">
            Sell
          </button>
        </div>

        {/* Your Position */}
        <div className="px-6 pb-6">
          <h2 className="text-white text-lg font-bold mb-4">Your Position</h2>
          <div className="bg-[#12121C] rounded-2xl p-[18px]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <div className="text-white/60 text-[11px] mb-1">Current Value</div>
                <div className="text-white text-[15px] font-bold">{asset.value}</div>
              </div>
              <div>
                <div className="text-white/60 text-[11px] mb-1">Total P&L</div>
                <div className={`text-[15px] font-bold ${
                  asset.profitLoss.startsWith('+') ? 'text-[#00D964]' : 'text-red-500'
                }`}>
                  {asset.profitLoss}
                </div>
              </div>
              <div>
                <div className="text-white/60 text-[11px] mb-1">Quantity</div>
                <div className="text-white text-[15px] font-bold">{asset.holdings}</div>
              </div>
              <div>
                <div className="text-white/60 text-[11px] mb-1">Return %</div>
                <div className={`text-[15px] font-bold ${
                  asset.returnPercent.startsWith('+') ? 'text-[#00D964]' : 'text-red-500'
                }`}>
                  {asset.returnPercent}
                </div>
              </div>
              <div>
                <div className="text-white/60 text-[11px] mb-1">Avg Buy Price</div>
                <div className="text-white text-[15px] font-bold">{asset.avgBuyPrice}</div>
              </div>
              <div>
                <div className="text-white/60 text-[11px] mb-1">Portfolio %</div>
                <div className="text-white text-[15px] font-bold">{asset.portfolioPercent}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-lg font-bold">Transaction History</h2>
            <button className="text-[#00D964] text-sm font-semibold">See all</button>
          </div>
          <div className="space-y-3">
            {transactions.map((tx, index) => (
              <div key={index} className="bg-[#12121C] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#00D964]/20 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-[#00D964]" />
                    </div>
                    <div>
                      <div className="text-white font-semibold">{tx.type}</div>
                      <div className="text-white/60 text-xs">{tx.date}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-white font-semibold">{tx.amount}</div>
                    <div className="text-white/60 text-xs">{tx.total}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-6" />
      </div>
    </div>
  );
}