import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router';
import { MiniChart } from './MiniChart';

const assets = [
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: 'BTC',
    amount: '0.234 BTC',
    price: '$42,580.20',
    change: '+5.23%',
    isPositive: true,
    icon: '₿',
    color: '#F7931A',
    chartData: [35, 38, 36, 40, 38, 42, 40, 43],
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'ETH',
    amount: '2.45 ETH',
    price: '$2,245.80',
    change: '+2.89%',
    isPositive: true,
    icon: '◆',
    color: '#627EEA',
    chartData: [32, 35, 33, 36, 38, 36, 39, 38],
  },
  {
    id: 'aapl',
    name: 'Apple',
    symbol: 'AAPL',
    amount: '12 shares',
    price: '$178.42',
    change: '-1.24%',
    isPositive: false,
    icon: '',
    color: '#A3AAAE',
    chartData: [42, 40, 41, 39, 38, 40, 39, 37],
  },
  {
    id: 'sol',
    name: 'Solana',
    symbol: 'SOL',
    amount: '45.2 SOL',
    price: '$98.65',
    change: '+8.12%',
    isPositive: true,
    icon: '◎',
    color: '#14F195',
    chartData: [28, 30, 32, 31, 35, 38, 36, 40],
  },
];

export function AssetList() {
  const navigate = useNavigate();

  return (
    <div className="px-5 py-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-white text-lg font-bold">My Assets</h2>
        <button onClick={() => navigate('/portfolio')} className="text-[#00D964] text-sm font-semibold flex items-center gap-1">
          See all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3">
        {assets.map((asset) => (
          <button
            key={asset.id}
            onClick={() => navigate(`/asset/${asset.id}`)}
            className="w-full bg-[#12121C] rounded-2xl px-5 py-4 flex items-center gap-2.5 h-[72px]"
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold shrink-0"
              style={{ backgroundColor: `${asset.color}20`, color: asset.color }}
            >
              {asset.icon}
            </div>
            <div className="flex-1 text-left mr-1 min-w-[80px]">
              <div className="text-white font-semibold text-sm">{asset.name}</div>
              <div className="text-white/60 text-[13px] whitespace-nowrap">{asset.amount}</div>
            </div>
            <div className="w-[50px] h-10 shrink-0 mr-1">
              <MiniChart data={asset.chartData} isPositive={asset.isPositive} />
            </div>
            <div className="text-right shrink-0 min-w-[80px]">
              <div className="text-white font-semibold text-[13px] whitespace-nowrap">{asset.price}</div>
              <div
                className={`text-[13px] font-semibold ${
                  asset.isPositive ? 'text-[#00D964]' : 'text-red-500'
                }`}
              >
                {asset.change}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}