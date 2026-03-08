import { StatusBar } from '../components/StatusBar';
import { PortfolioHeader } from '../components/PortfolioHeader';
import { PortfolioChart } from '../components/PortfolioChart';
import { TimeFilter } from '../components/TimeFilter';
import { StatCards } from '../components/StatCards';
import { AssetList } from '../components/AssetList';
import { BottomNav } from '../components/BottomNav';

export function Dashboard() {
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      {/* Mobile Container */}
      <div className="w-[375px] h-[812px] bg-[#0A0A0F] overflow-y-auto scrollbar-hide relative">
        <StatusBar />
        <PortfolioHeader />
        <PortfolioChart />
        <TimeFilter />
        <StatCards />
        <AssetList />
        <div className="h-24" /> {/* Spacer for bottom nav */}
        <BottomNav />
      </div>
    </div>
  );
}
