import { ArrowLeft, ChevronRight, User, Bell, Shield, Palette, HelpCircle, Info, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router';
import { StatusBar } from '../components/StatusBar';
import { BottomNav } from '../components/BottomNav';

const settingsSections = [
  {
    title: 'Account',
    items: [
      { icon: User, label: 'Profile Settings', value: '' },
      { icon: Bell, label: 'Notifications', value: 'On' },
      { icon: Shield, label: 'Security & Privacy', value: '' },
    ],
  },
  {
    title: 'Preferences',
    items: [
      { icon: Palette, label: 'Appearance', value: 'Dark' },
      { icon: Info, label: 'Currency', value: 'USD' },
    ],
  },
  {
    title: 'Support',
    items: [
      { icon: HelpCircle, label: 'Help Center', value: '' },
      { icon: Info, label: 'About', value: 'v1.0.0' },
    ],
  },
];

export function Settings() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="w-[375px] h-[812px] bg-[#0A0A0F] overflow-y-auto scrollbar-hide relative">
        <StatusBar />
        
        {/* Header */}
        <div className="px-6 pt-4 pb-6">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => navigate('/')} className="p-2 -ml-2">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-white text-2xl font-bold">Settings</h1>
          </div>

          {/* Profile Card */}
          <div className="bg-[#12121C] rounded-3xl p-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#00D964] flex items-center justify-center">
              <span className="text-black text-2xl font-bold">JD</span>
            </div>
            <div className="flex-1">
              <div className="text-white font-bold text-lg">John Doe</div>
              <div className="text-white/60 text-sm">john.doe@email.com</div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </div>
        </div>

        {/* Settings Sections */}
        <div className="px-6 space-y-6 pb-6">
          {settingsSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-white/60 text-sm font-semibold mb-3 px-2">
                {section.title}
              </h2>
              <div className="bg-[#12121C] rounded-2xl overflow-hidden">
                {section.items.map((item, index) => (
                  <button
                    key={item.label}
                    className={`w-full px-5 py-4 flex items-center justify-between ${
                      index !== section.items.length - 1 ? 'border-b border-white/5' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon className="w-5 h-5 text-white/60" />
                      <span className="text-white font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.value && (
                        <span className="text-white/60 text-sm">{item.value}</span>
                      )}
                      <ChevronRight className="w-5 h-5 text-white/40" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Logout Button */}
          <button className="w-full bg-[#12121C] rounded-2xl px-5 py-4 flex items-center justify-center gap-3 text-red-500">
            <LogOut className="w-5 h-5" />
            <span className="font-semibold">Log Out</span>
          </button>

          {/* App Version */}
          <div className="text-center text-white/40 text-sm pt-4">
            Omega Portfolio Tracker v1.0.0
          </div>
        </div>

        <div className="h-24" />
        <BottomNav />
      </div>
    </div>
  );
}