import { X, ChevronRight, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useState } from 'react';
import { StatusBar } from '../components/StatusBar';

export function AddTransaction() {
  const navigate = useNavigate();
  const [transactionType, setTransactionType] = useState<'buy' | 'sell' | 'transfer'>('buy');
  const [exchange, setExchange] = useState('KuCoin');
  const [tradingPair, setTradingPair] = useState('BTC/USDT');
  const [dateTime, setDateTime] = useState('Sun, 8 Mar 2026, 9:41');
  const [buyPrice, setBuyPrice] = useState('');
  const [amountBought, setAmountBought] = useState('');
  const [fee, setFee] = useState('');
  const [deductFromHoldings, setDeductFromHoldings] = useState(false);
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    // Handle transaction submission
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-[375px] h-[812px] bg-black overflow-y-auto scrollbar-hide relative">
        <StatusBar />
        
        {/* Header */}
        <div className="px-5 pt-4 pb-4 flex items-center justify-between border-b border-white/10">
          <h1 className="text-white text-xl font-semibold">Add Transaction</h1>
          <button onClick={() => navigate(-1)} className="p-1">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Transaction Type Toggle */}
        <div className="border-b border-white/10">
          <div className="px-5 py-4 flex gap-2">
            <button
              onClick={() => setTransactionType('buy')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                transactionType === 'buy'
                  ? 'bg-[#00D964] text-black'
                  : 'bg-transparent text-white/40'
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTransactionType('sell')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                transactionType === 'sell'
                  ? 'bg-[#FF4757] text-white'
                  : 'bg-transparent text-white/40'
              }`}
            >
              Sell
            </button>
            <button
              onClick={() => setTransactionType('transfer')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                transactionType === 'transfer'
                  ? 'bg-[#00A8FF] text-white'
                  : 'bg-transparent text-white/40'
              }`}
            >
              Transfer
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div>
          {/* Exchange */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-white/50 text-xs mb-2">Exchange</div>
            <button className="w-full flex items-center justify-between">
              <span className="text-white">{exchange}</span>
              <ChevronRight className="w-5 h-5 text-white/40" />
            </button>
          </div>

          {/* Trading Pair */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-white/50 text-xs mb-2">Trading Pair</div>
            <button className="w-full flex items-center justify-between">
              <span className="text-white">{tradingPair}</span>
              <ChevronRight className="w-5 h-5 text-white/40" />
            </button>
          </div>

          {/* Date & Time */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-white/50 text-xs mb-2">Date & Time</div>
            <div className="text-white">{dateTime}</div>
          </div>

          {/* Buy Price in USD */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-white/50 text-xs mb-2">Buy Price in USD</div>
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-white/30"
              />
              <button className="flex items-center gap-1 text-white/50 text-sm ml-4">
                per coin
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Amount Bought */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-white/50 text-xs mb-2">Amount Bought</div>
            <input
              type="number"
              value={amountBought}
              onChange={(e) => setAmountBought(e.target.value)}
              placeholder=""
              className="w-full bg-transparent text-white text-lg outline-none placeholder:text-white/30"
            />
          </div>

          {/* Exchange/Transaction Fee */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-white/50 text-xs mb-2">Exchange/Transaction Fee</div>
            <div className="flex items-center justify-between">
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-transparent text-white text-lg outline-none placeholder:text-white/30"
              />
              <button className="flex items-center gap-1 text-white/50 text-sm ml-4">
                USD
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Deduct from Holdings */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-white mb-1">Deduct from holdings</div>
                <div className="text-white/50 text-xs">Reduce your current holdings by this amount</div>
              </div>
              <button
                onClick={() => setDeductFromHoldings(!deductFromHoldings)}
                className={`w-12 h-7 rounded-full transition-colors relative ${
                  deductFromHoldings ? 'bg-[#00D964]' : 'bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white absolute top-1 transition-transform ${
                    deductFromHoldings ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="border-b border-white/10 px-5 py-4">
            <div className="text-white/50 text-xs mb-2">Notes</div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder=""
              rows={3}
              className="w-full bg-transparent text-white outline-none placeholder:text-white/30 resize-none"
            />
          </div>
        </div>

        {/* Bottom Button */}
        <div className="fixed bottom-0 left-0 right-0 flex justify-center">
          <div className="w-[375px] px-5 py-4 bg-black border-t border-white/10">
            <button
              onClick={handleSubmit}
              className="w-full h-[50px] rounded-lg font-semibold text-black bg-[#00D964] flex items-center justify-center"
            >
              Add Transaction
            </button>
          </div>
        </div>

        <div className="h-24" />
      </div>
    </div>
  );
}