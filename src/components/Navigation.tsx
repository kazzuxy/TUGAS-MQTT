import React from 'react';
import { ActiveTab, MqttBrokerConfig } from '../types';
import { 
  Menu, X, LogOut, Radio, Thermometer, Droplets, Sliders, 
  Settings2, FileBarChart, History, Activity, Wifi, WifiOff, Cpu, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface NavigationProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  user: { email: string | null } | null;
  brokers: MqttBrokerConfig[];
  onLogout: () => void;
}

export function Topbar({ 
  sidebarOpen, 
  setSidebarOpen, 
  user, 
  brokers, 
  onLogout 
}: Omit<NavigationProps, 'activeTab' | 'setActiveTab'>) {
  const connectedCount = brokers.filter(b => b.isConnected).length;

  return (
    <header className="h-16 w-full bg-[#111827]/80 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40 font-sans">
      <div className="flex items-center gap-3">
        <button
          id="sidebar-toggle-button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 hover:bg-slate-800/80 rounded-lg text-slate-300 hover:text-white transition-all cursor-pointer"
          aria-label="Toggle Sidebar"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-500 animate-pulse" />
          <h2 className="text-sm md:text-base font-bold text-white tracking-tight leading-none uppercase">
            IOT SYSTEM
          </h2>
        </div>
      </div>

      {/* Topbar Center status or details */}
      <div className="hidden lg:flex items-center gap-3 bg-slate-950/60 pl-3 pr-4 py-1.5 rounded-full border border-slate-800/80 text-[11px] font-mono">
        <span className="text-slate-400">Broker Terkoneksi:</span>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connectedCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
          <span className={connectedCount > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
            {connectedCount} / {brokers.length} ACTIVE
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Quick User summary */}
        <div className="text-right hidden sm:block">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest leading-none">Login email</p>
          <p className="text-xs text-slate-300 font-medium font-sans mt-0.5 max-w-[180px] truncate">
            {user?.email || 'user@example.com'}
          </p>
        </div>

        <button
          id="topbar-logout-button"
          onClick={onLogout}
          className="p-1.5 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-lg transition-all cursor-pointer border border-transparent hover:border-red-900/30"
          title="Keluar dari akun"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

export function Sidebar({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  user,
  brokers,
  onLogout
}: NavigationProps) {
  
  // Categorized Sidebar Menus definition
  const menuGroups = [
    {
      title: 'DASHBOARD MONITOR',
      items: [
        { name: 'Voice Command', tab: 'voice' as ActiveTab, icon: Radio, desc: 'Perintah Suara id-ID' },
        { name: 'Monitoring Suhu', tab: 'suhu' as ActiveTab, icon: Thermometer, desc: 'Data Suhu Realtime 3D' },
        { name: 'Monitoring Kelembapan', tab: 'kelembapan' as ActiveTab, icon: Droplets, desc: 'Aktivitas Kelembapan 3D' },
      ]
    },
    {
      title: 'KENDALI & STRUKTUR',
      items: [
        { name: 'Kontrol Relay', tab: 'kontrol-relay' as ActiveTab, icon: Sliders, desc: 'Saklar Relay Multi-Broker' },
      ]
    },
    {
      title: 'RIWAYAT TELEMETRI',
      items: [
        { name: 'Data Riwayat Suhu', tab: 'data-suhu' as ActiveTab, icon: FileBarChart, desc: 'Tabel Log Suhu' },
        { name: 'Data Riwayat Lembap', tab: 'data-kelembapan' as ActiveTab, icon: History, desc: 'Tabel Log Kelembapan' },
        { name: 'Log Transmisi MQTT', tab: 'log-mqtt' as ActiveTab, icon: Activity, desc: 'Console Aktivitas' },
      ]
    },
    {
      title: 'PENGATURAN',
      items: [
        { name: 'Konfigurasi MQTT', tab: 'mqtt-config' as ActiveTab, icon: Settings2, desc: 'Kredensial Multi-Broker' },
      ]
    }
  ];

  const handleTabClick = (tab: ActiveTab) => {
    setActiveTab(tab);
    // Auto-close on mobile viewports
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          {/* Backdrop on mobile */}
          <div 
            className="fixed inset-0 bg-[#020617]/70 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />

          <motion.aside 
            initial={{ x: -280, opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0.8 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="fixed md:sticky top-0 left-0 h-screen w-[260px] bg-[#0c1220] border-r border-slate-800/80 z-50 flex flex-col justify-between select-none"
            id="sidebar-container"
          >
            {/* Header profile info */}
            <div>
              <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-[0_0_12px_rgba(37,99,235,0.4)]">
                    IoT
                  </div>
                  <span className="font-sans font-bold text-xs tracking-wider uppercase text-white">System Panel</span>
                </div>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  className="p-1 hover:bg-slate-800 rounded-md md:hidden text-slate-400 hover:text-white transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Connected Active Profile info */}
              <div className="p-4 bg-slate-900/40 border-b border-slate-800/40 font-sans">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-blue-400">
                    {user?.email ? user.email[0].toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-mono tracking-widest text-blue-400 font-bold uppercase leading-none">Aktif Akun</p>
                    <p className="text-xs text-slate-200 truncate mt-0.5 font-medium">
                      {user?.email || 'user@example.com'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Nav Menu Lists */}
              <div className="px-3.5 py-4 overflow-y-auto max-h-[calc(100vh-230px)] space-y-5 custom-scrollbar">
                {menuGroups.map((group, gIdx) => (
                  <div key={gIdx} className="space-y-1">
                    <h3 className="px-2.5 text-[9px] font-mono tracking-widest text-slate-500 font-bold uppercase mb-2">
                      {group.title}
                    </h3>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isSelected = activeTab === item.tab;
                        return (
                          <button
                            key={item.tab}
                            id={`sidebar-tab-${item.tab}`}
                            onClick={() => handleTabClick(item.tab)}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl transition-all font-sans cursor-pointer group text-left ${
                              isSelected 
                                ? 'bg-gradient-to-r from-blue-600/10 to-indigo-600/10 border-l-[3px] border-blue-500 text-blue-400 bg-slate-900/60 font-medium' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30 border-l-[3px] border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                                isSelected ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-300'
                              }`} />
                              <div className="min-w-0">
                                <p className="text-xs leading-tight truncate">{item.name}</p>
                              </div>
                            </div>
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-600 shrink-0 transition-transform ${
                              isSelected ? 'text-blue-400/80 translate-x-0.5' : 'group-hover:translate-x-0.5 opacity-40 group-hover:opacity-100'
                            }`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Logout Action Footer */}
            <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
              <button
                id="sidebar-logout-button"
                onClick={onLogout}
                className="w-full py-2.5 px-3 rounded-xl hover:bg-red-950/30 text-[#fca5a5] hover:text-[#f87171] border border-red-900/20 hover:border-red-900/40 font-sans text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer focus:outline-none"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout dari Sesi</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
