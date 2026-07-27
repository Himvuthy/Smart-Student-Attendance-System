import React, { useState } from 'react';
import { Home, Calendar, BarChart2, Menu, Bell, Zap, Clock, ShieldCheck, Sun, Moon } from 'lucide-react';

const Dashboard = () => {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');

  const bg = darkMode ? 'bg-[#0F172A]' : 'bg-[#F3F4F6]';
  const card = darkMode ? 'bg-slate-800' : 'bg-white';
  const text = darkMode ? 'text-white' : 'text-gray-800';
  const muted = darkMode ? 'text-slate-400' : 'text-gray-400';
  const border = darkMode ? 'border-slate-700' : 'border-gray-100';

  const tabMap = { 'Home': 0, 'Calendar': 1, 'Reports': 2, 'Menu': 3 };

  return (
    <div className={`min-h-screen ${bg} transition-colors duration-500 pb-32 overflow-x-hidden`}>
      {/* HEADER */}
      <header className="flex justify-between items-center p-6 pt-10 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-full border-2 ${darkMode ? 'bg-slate-700 border-slate-600' : 'bg-gray-300 border-white'} shadow-sm overflow-hidden`}>
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Him" alt="Profile" className="w-full h-full object-cover" />
          </div>
          <div>
            <p className={`${muted} text-sm`}>Hello!</p>
            <h1 className={`text-2xl font-bold ${text}`}>Him Vuthy</h1>
          </div>
        </div>
        <div className={`p-3 ${card} rounded-full shadow-sm ${muted} transition-colors`}>
          <Bell size={24} />
        </div>
      </header>

      {/* SLIDING CONTENT CONTAINER */}
      <div 
        className="flex transition-transform duration-500 ease-out" 
        style={{ transform: `translateX(-${tabMap[activeTab] * 100}%)` }}
      >
        {/* PAGE 1: HOME - UPDATED WITH SINGLE BOX */}
        <div className="min-w-full px-6 space-y-6">
          <div className={`${card} p-5 rounded-3xl border ${border} flex items-center justify-between shadow-sm`}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <ShieldCheck className="text-green-500" size={24} />
              </div>
              <div>
                <p className={`font-bold text-lg ${text}`}>Latest Check-in</p>
                <p className={`text-xs ${muted}`}>Student ID: #042 • 09:12 AM</p>
              </div>
            </div>
            <span className="text-[10px] font-black bg-green-500/10 text-green-600 px-3 py-1.5 rounded-full uppercase">
              Success
            </span>
          </div>
        </div>
        
        {/* PAGE 2: CALENDAR */}
        <div className="min-w-full px-6 flex flex-col items-center justify-center py-20 opacity-40">
           <Calendar size={64} className={text} />
           <p className={`mt-4 font-black uppercase tracking-widest text-xs ${text}`}>Calendar Schedule</p>
        </div>

        {/* PAGE 3: REPORTS */}
        <div className="min-w-full px-6 flex flex-col items-center justify-center py-20 opacity-40">
           <BarChart2 size={64} className={text} />
           <p className={`mt-4 font-black uppercase tracking-widest text-xs ${text}`}>Attendance Reports</p>
        </div>

        {/* PAGE 4: MENU / SETTINGS */}
        <div className="min-w-full px-6 space-y-4">
           <h2 className={`text-2xl font-bold mb-4 ${text}`}>Settings</h2>
           <button 
             onClick={() => setDarkMode(!darkMode)}
             className={`w-full p-6 ${card} rounded-3xl flex justify-between items-center shadow-sm border ${border}`}
           >
             <div className="flex items-center gap-4">
               {darkMode ? <Moon className="text-blue-400" /> : <Sun className="text-yellow-500" />}
               <span className={text}>Dark Mode</span>
             </div>
             <div className={`w-12 h-6 rounded-full p-1 transition-colors ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
               <div className={`bg-white w-4 h-4 rounded-full transition-transform ${darkMode ? 'translate-x-6' : 'translate-x-0'}`} />
             </div>
           </button>
        </div>
      </div>

      {/* NAVIGATION BAR */}
      <nav className={`fixed bottom-0 left-0 right-0 ${card} border-t ${border} flex justify-around items-center py-5 shadow-2xl z-[100]`}>
        <div 
          className="absolute -top-1.5 h-1.5 bg-blue-600 transition-all duration-500 ease-out"
          style={{ width: '25%', left: `${tabMap[activeTab] * 25}%` }}
        />
        <NavItem icon={<Home />} label="Home" active={activeTab === 'Home'} onClick={() => setActiveTab('Home')} darkMode={darkMode} />
        <NavItem icon={<Calendar />} label="Calendar" active={activeTab === 'Calendar'} onClick={() => setActiveTab('Calendar')} darkMode={darkMode} />
        <NavItem icon={<BarChart2 />} label="Reports" active={activeTab === 'Reports'} onClick={() => setActiveTab('Reports')} darkMode={darkMode} />
        <NavItem icon={<Menu />} label="Menu" active={activeTab === 'Menu'} onClick={() => setActiveTab('Menu')} darkMode={darkMode} />
      </nav>
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, darkMode }) => (
  <button onClick={onClick} className="flex-1 flex flex-col items-center gap-1 outline-none transition-transform active:scale-90">
    <div className={active ? 'text-blue-500' : (darkMode ? 'text-slate-600' : 'text-gray-300')}>
      {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
    </div>
    <span className={`text-[9px] font-black uppercase ${active ? (darkMode ? 'text-white' : 'text-black') : (darkMode ? 'text-slate-600' : 'text-gray-300')}`}>
      {label}
    </span>
  </button>
);

export default Dashboard;