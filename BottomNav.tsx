import { Home, PieChart, Plus, Clock, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#12121C] border-t border-white/5">
      <div className="max-w-[375px] mx-auto flex items-center justify-around px-6 py-3">
        <button onClick={() => navigate('/')} className="p-2">
          <Home className={`w-6 h-6 ${location.pathname === '/' ? 'text-[#00D964]' : 'text-white/40'}`} />
        </button>
        <button onClick={() => navigate('/portfolio')} className="p-2">
          <PieChart className={`w-6 h-6 ${location.pathname === '/portfolio' ? 'text-[#00D964]' : 'text-white/40'}`} />
        </button>
        <button onClick={() => navigate('/add-transaction')} className="relative -mt-8">
          <div className="w-14 h-14 rounded-full bg-[#00D964] flex items-center justify-center shadow-lg shadow-[#00D964]/30">
            <Plus className="w-7 h-7 text-black" strokeWidth={3} />
          </div>
        </button>
        <button className="p-2">
          <Clock className="w-6 h-6 text-white/40" />
        </button>
        <button onClick={() => navigate('/settings')} className="p-2">
          <User className={`w-6 h-6 ${location.pathname === '/settings' ? 'text-[#00D964]' : 'text-white/40'}`} />
        </button>
      </div>
    </div>
  );
}