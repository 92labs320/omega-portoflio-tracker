import { Wifi, Battery } from 'lucide-react';

export function StatusBar() {
  return (
    <div className="flex justify-between items-center px-6 pt-3 pb-2">
      <span className="text-white text-sm font-semibold">9:41</span>
      <div className="flex items-center gap-1">
        <Wifi className="w-4 h-4 text-white" />
        <Battery className="w-5 h-5 text-white fill-white" />
      </div>
    </div>
  );
}
