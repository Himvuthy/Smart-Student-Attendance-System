import React, { useState, useEffect } from 'react';
import {
  Fingerprint, Bell, LayoutDashboard, BookOpen,
  Settings, LogOut, Users, CheckCircle, XCircle,
  BarChart3, LineChart, Sun, Moon, CalendarDays,
  Search, User, Clock, MapPin, GraduationCap, TrendingUp
} from 'lucide-react';

const StudentDashboard = ({ onLogout }) => {
  const [activeView, setActiveView] = useState(() => localStorage.getItem('studentActiveView') || 'dashboard');
  const [isDark, setIsDark] = useState(() => localStorage.getItem('appTheme') === 'dark');

  useEffect(() => {
    localStorage.setItem('studentActiveView', activeView);
  }, [activeView]);

  useEffect(() => {
    localStorage.setItem('appTheme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // ── Theme tokens (exact match with Admin) ──
  const appBg = isDark ? "bg-black" : "bg-[#f8fafc]";
  const surfaceBg = isDark ? "bg-black" : "bg-white";
  const borderColor = isDark ? "border-white/10" : "border-[#f1f5f9]";
  const borderSubColor = isDark ? "border-white/5" : "border-gray-100";
  const textColor = isDark ? "text-white" : "text-gray-800";
  const mutedText = isDark ? "text-gray-400" : "text-slate-500";
  const subBg = isDark ? "bg-white/5" : "bg-gray-50";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";
  const navActiveBg = isDark ? "bg-white/10 text-cyan-400" : "bg-indigo-50 text-indigo-600";
  const navInactiveBg = isDark ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-gray-50 hover:text-indigo-600";
  const brandColor = isDark ? "text-cyan-400" : "text-indigo-600";
  const buttonHoverText = isDark ? 'hover:text-cyan-400' : 'hover:text-indigo-600';
  const cardStyle = `${surfaceBg} rounded-2xl border ${borderColor} p-6 flex flex-col ${isDark ? 'shadow-[0_0_15px_rgba(255,255,255,0.02)]' : 'shadow-sm'}`;
  const inputStyle = `w-full p-2.5 text-sm border rounded-lg focus:outline-none transition-colors ${isDark ? 'bg-[#111] border-white/20 text-white focus:border-cyan-400 [&>option]:bg-black [&>option]:text-white' : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-indigo-500 [&>option]:bg-white [&>option]:text-gray-800'}`;

  // ── View titles ──
  const viewTitles = {
    dashboard: 'Dashboard',
    attendance: 'My Attendance',
    schedule: 'My Schedule',
    profile: 'My Profile',
    settings: 'Settings',
  };

  // ── Sidebar nav items ──
  const mainMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'My Attendance', icon: CalendarDays },
    { id: 'schedule', label: 'My Schedule', icon: BookOpen },
    { id: 'profile', label: 'My Profile', icon: User },
  ];
  const systemItems = [
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  // ── Current date ──
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // ── Mock data ──
  const todaySchedule = [
    { time: '08:00 – 09:30', subject: 'Data Structures & Algorithms', room: 'Room A201', status: 'Completed' },
    { time: '10:00 – 11:30', subject: 'Database Management Systems', room: 'Room B105', status: 'Completed' },
    { time: '13:00 – 14:30', subject: 'Web Development', room: 'Lab C302', status: 'In Progress' },
    { time: '15:00 – 16:30', subject: 'Software Engineering', room: 'Room A108', status: 'Upcoming' },
  ];

  const attendanceRecords = [
    { date: '2026-07-16', class: 'Data Structures & Algorithms', checkIn: '07:58 AM', status: 'Present' },
    { date: '2026-07-15', class: 'Web Development', checkIn: '13:12 PM', status: 'Late' },
    { date: '2026-07-15', class: 'Database Management Systems', checkIn: '09:59 AM', status: 'Present' },
    { date: '2026-07-14', class: 'Software Engineering', checkIn: '—', status: 'Absent' },
    { date: '2026-07-14', class: 'Data Structures & Algorithms', checkIn: '07:55 AM', status: 'Present' },
    { date: '2026-07-13', class: 'Web Development', checkIn: '12:58 PM', status: 'Present' },
    { date: '2026-07-13', class: 'Database Management Systems', checkIn: '10:07 AM', status: 'Late' },
    { date: '2026-07-12', class: 'Software Engineering', checkIn: '14:59 PM', status: 'Present' },
    { date: '2026-07-12', class: 'Data Structures & Algorithms', checkIn: '08:15 AM', status: 'Late' },
    { date: '2026-07-11', class: 'Web Development', checkIn: '12:55 PM', status: 'Present' },
  ];

  const weeklyTimetable = {
    Monday: [
      { time: '08:00 – 09:30', subject: 'Data Structures & Algorithms', room: 'Room A201' },
      { time: '10:00 – 11:30', subject: 'Database Management Systems', room: 'Room B105' },
      { time: '13:00 – 14:30', subject: 'Calculus II', room: 'Room D410' },
    ],
    Tuesday: [
      { time: '08:00 – 09:30', subject: 'Web Development', room: 'Lab C302' },
      { time: '10:00 – 11:30', subject: 'Software Engineering', room: 'Room A108' },
      { time: '14:00 – 15:30', subject: 'Computer Networks', room: 'Room B203' },
    ],
    Wednesday: [
      { time: '08:00 – 09:30', subject: 'Data Structures & Algorithms', room: 'Room A201' },
      { time: '10:00 – 11:30', subject: 'Database Management Systems', room: 'Room B105' },
      { time: '13:00 – 14:30', subject: 'Web Development', room: 'Lab C302' },
      { time: '15:00 – 16:30', subject: 'Software Engineering', room: 'Room A108' },
    ],
    Thursday: [
      { time: '08:00 – 09:30', subject: 'Calculus II', room: 'Room D410' },
      { time: '10:00 – 11:30', subject: 'Computer Networks', room: 'Room B203' },
      { time: '13:00 – 14:30', subject: 'Software Engineering', room: 'Room A108' },
    ],
    Friday: [
      { time: '08:00 – 09:30', subject: 'Data Structures & Algorithms', room: 'Room A201' },
      { time: '10:00 – 11:30', subject: 'Web Development', room: 'Lab C302' },
      { time: '14:00 – 15:30', subject: 'Database Management Systems', room: 'Room B105' },
    ],
  };

  // ── Status badge helper ──
  const statusBadge = (status) => {
    const map = {
      Present: 'bg-emerald-500/10 text-emerald-500',
      Late: 'bg-amber-500/10 text-amber-500',
      Absent: 'bg-red-500/10 text-red-500',
      Completed: 'bg-emerald-500/10 text-emerald-500',
      'In Progress': 'bg-cyan-500/10 text-cyan-500',
      Upcoming: isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || ''}`}>
        {status}
      </span>
    );
  };

  // ══════════════════════════════════════════
  //  VIEW RENDERERS
  // ══════════════════════════════════════════

  // ── Dashboard View ──
  const renderDashboard = () => {
    const stats = [
      { label: 'Attendance Rate', value: '94.5%', icon: TrendingUp, accent: 'text-emerald-500' },
      { label: 'Classes Today', value: '4', icon: BookOpen, accent: brandColor },
      { label: 'Late Count', value: '3', icon: Clock, accent: 'text-amber-500' },
      { label: 'Total Sessions', value: '128', icon: BarChart3, accent: brandColor },
    ];

    return (
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {stats.map((s, i) => (
            <div key={i} className={cardStyle}>
              <div className="flex items-center justify-between mb-4">
                <span className={`text-xs font-medium uppercase tracking-wider ${mutedText}`}>{s.label}</span>
                <div className={`p-2 rounded-lg ${subBg}`}>
                  <s.icon size={18} className={s.accent} />
                </div>
              </div>
              <span className={`text-3xl font-bold tracking-tight ${s.accent}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Weekly chart placeholder + Today's schedule */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {/* Weekly Attendance Chart */}
          <div className={cardStyle}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg">Last 7 Days Attendance</h3>
              <LineChart size={20} className={mutedText} />
            </div>
            <div className="flex-1 rounded-xl overflow-hidden">
              <div className="relative h-[220px] w-full">
                <div className="absolute inset-0 flex items-end gap-2 px-3 pb-6 pt-2">
                  {[{l:'Mon',v:95},{l:'Tue',v:88},{l:'Wed',v:100},{l:'Thu',v:75},{l:'Fri',v:92},{l:'Mon',v:100},{l:'Tue',v:85}].map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className={`text-[10px] font-bold ${mutedText}`}>{d.v}%</span>
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          d.v === 100
                            ? (isDark ? 'bg-green-500/70' : 'bg-green-400/70')
                            : d.v >= 90
                              ? (isDark ? 'bg-cyan-500/60' : 'bg-indigo-400/60')
                              : (isDark ? 'bg-amber-500/60' : 'bg-amber-400/60')
                        }`}
                        style={{ height: `${d.v * 0.85}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className={`absolute bottom-0 left-0 right-0 flex justify-between px-4 py-1 text-[9px] font-bold ${mutedText}`}>
                  <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Mon</span><span>Tue</span>
                </div>
              </div>
            </div>
          </div>

          {/* Today's Schedule */}
          <div className={cardStyle}>
            <h3 className="font-semibold text-lg mb-5">Today's Schedule</h3>
            <div className="space-y-3 flex-1">
              {todaySchedule.map((cls, i) => (
                <div key={i} className={`flex items-center justify-between p-3.5 rounded-xl ${subBg} border ${borderSubColor}`}>
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${isDark ? 'bg-white/5' : 'bg-white'} border ${borderSubColor}`}>
                      <Clock size={16} className={mutedText} />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{cls.subject}</p>
                      <div className={`flex items-center gap-3 mt-0.5 text-xs ${mutedText}`}>
                        <span className="flex items-center gap-1"><Clock size={11} />{cls.time}</span>
                        <span className="flex items-center gap-1"><MapPin size={11} />{cls.room}</span>
                      </div>
                    </div>
                  </div>
                  {statusBadge(cls.status)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── My Attendance View ──
  const renderAttendance = () => (
    <div className={cardStyle}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h3 className="font-semibold text-lg">Attendance Records</h3>
        <div className="flex items-center gap-3">
          <input type="date" defaultValue="2026-07-01" className={inputStyle} style={{ width: 160 }} />
          <span className={mutedText}>to</span>
          <input type="date" defaultValue="2026-07-16" className={inputStyle} style={{ width: 160 }} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={`${subBg} border-b ${borderColor}`}>
              <th className={`text-left p-3 font-semibold text-xs uppercase tracking-wider ${mutedText}`}>Date</th>
              <th className={`text-left p-3 font-semibold text-xs uppercase tracking-wider ${mutedText}`}>Class</th>
              <th className={`text-left p-3 font-semibold text-xs uppercase tracking-wider ${mutedText}`}>Check-in Time</th>
              <th className={`text-left p-3 font-semibold text-xs uppercase tracking-wider ${mutedText}`}>Status</th>
            </tr>
          </thead>
          <tbody>
            {attendanceRecords.map((r, i) => (
              <tr key={i} className={`border-b ${borderSubColor} ${hoverBg} transition-colors`}>
                <td className="p-3 font-medium">{r.date}</td>
                <td className={`p-3 ${mutedText}`}>{r.class}</td>
                <td className={`p-3 ${mutedText}`}>{r.checkIn}</td>
                <td className="p-3">{statusBadge(r.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── My Schedule View ──
  const renderSchedule = () => (
    <div className={cardStyle}>
      <h3 className="font-semibold text-lg mb-6">Weekly Class Schedule</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {Object.entries(weeklyTimetable).map(([day, classes]) => (
          <div key={day} className="flex flex-col">
            <h4 className={`text-sm font-bold uppercase tracking-wider mb-3 ${brandColor}`}>{day}</h4>
            <div className="space-y-2.5 flex-1">
              {classes.map((cls, i) => (
                <div key={i} className={`p-3 rounded-xl ${subBg} border ${borderSubColor}`}>
                  <p className="text-sm font-medium mb-1.5">{cls.subject}</p>
                  <div className={`flex flex-col gap-1 text-xs ${mutedText}`}>
                    <span className="flex items-center gap-1.5"><Clock size={11} />{cls.time}</span>
                    <span className="flex items-center gap-1.5"><MapPin size={11} />{cls.room}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── My Profile View ──
  const renderProfile = () => (
    <div className="flex justify-center">
      <div className={`${cardStyle} w-full max-w-3xl`}>
        {/* Avatar + name */}
        <div className="flex flex-col items-center mb-8">
          <img
            src="https://ui-avatars.com/api/?name=Sok+Dara&background=6366f1&color=fff&size=96&font-size=0.4&bold=true"
            alt="Sok Dara"
            className="w-24 h-24 rounded-full mb-4 ring-4 ring-offset-2 ring-offset-transparent"
            style={{ ringColor: isDark ? '#22d3ee' : '#6366f1' }}
          />
          <h2 className="text-xl font-bold">Sok Dara</h2>
          <span className={`mt-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-indigo-50 text-indigo-600'}`}>Student</span>
        </div>

        {/* Info rows */}
        <div className="space-y-0 divide-y divide-inherit">
          {[
            { label: 'Student ID', value: 'STU-2026-00142' },
            { label: 'Email', value: 'sok.dara@university.edu.kh' },
            { label: 'Phone', value: '+855 12 345 678' },
            { label: 'Department', value: 'Computer Science' },
            { label: 'Year', value: 'Year 3 — Semester 2' },
          ].map((row, i) => (
            <div key={i} className={`flex items-center justify-between py-4 border-b ${borderSubColor}`}>
              <span className={`text-sm font-medium ${mutedText}`}>{row.label}</span>
              <span className="text-sm font-semibold">{row.value}</span>
            </div>
          ))}
        </div>

        {/* Fingerprint status */}
        <div className={`mt-6 p-4 rounded-xl ${subBg} border ${borderSubColor} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <Fingerprint size={22} className={brandColor} />
            <div>
              <p className="text-sm font-semibold">Fingerprint Status</p>
              <p className={`text-xs ${mutedText}`}>Biometric authentication for attendance</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-emerald-500 text-sm font-semibold">
            <CheckCircle size={16} /> Enrolled
          </span>
        </div>
      </div>
    </div>
  );

  // ── Settings View ──
  const renderSettings = () => (
    <div className="flex justify-center">
      <div className={`${cardStyle} w-full max-w-3xl`}>
        <h3 className="font-semibold text-lg mb-6">Settings</h3>

        {/* Theme toggle */}
        <div className={`p-5 rounded-xl ${subBg} border ${borderSubColor} mb-5`}>
          <p className="text-sm font-semibold mb-1">Appearance</p>
          <p className={`text-xs ${mutedText} mb-4`}>Choose your preferred theme</p>
          <div className="flex gap-3">
            <button
              onClick={() => setIsDark(false)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${!isDark ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : `${surfaceBg} ${mutedText} border-white/10 hover:border-white/20`}`}
            >
              <Sun size={16} /> Light
            </button>
            <button
              onClick={() => setIsDark(true)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${isDark ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : `${surfaceBg} ${mutedText} border-gray-200 hover:border-gray-300`}`}
            >
              <Moon size={16} /> Dark
            </button>
          </div>
        </div>

        {/* Session management */}
        <div className={`p-5 rounded-xl ${subBg} border ${borderSubColor}`}>
          <p className="text-sm font-semibold mb-1">Session</p>
          <p className={`text-xs ${mutedText} mb-4`}>Manage your current session</p>
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
    </div>
  );

  // ── View dispatcher ──
  const renderContent = () => {
    switch (activeView) {
      case 'dashboard': return renderDashboard();
      case 'attendance': return renderAttendance();
      case 'schedule': return renderSchedule();
      case 'profile': return renderProfile();
      case 'settings': return renderSettings();
      default: return renderDashboard();
    }
  };

  // ══════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════
  return (
    <div className={`flex h-screen overflow-hidden ${appBg} ${textColor} font-sans transition-colors duration-500 animate-in fade-in duration-500`}>
      {/* ── Sidebar ── */}
      <aside className={`w-64 ${surfaceBg} border-r ${borderColor} flex flex-col z-20 transition-colors duration-500 shrink-0`}>
        {/* Logo header */}
        <div className={`h-20 flex items-center px-6 border-b ${borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
               <Fingerprint className={`w-5 h-5 transition-colors duration-500 ${isDark ? 'text-cyan-400' : 'text-indigo-600'}`} />
            </div>
            <h1 className="text-lg font-black tracking-tight">Smart<span className={brandColor}>Attendance</span></h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* Main Menu */}
          <p className={`text-[10px] font-bold uppercase tracking-widest px-3 mb-2 ${mutedText}`}>Main Menu</p>
          {mainMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeView === item.id ? navActiveBg : navInactiveBg}`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}

          {/* System */}
          <p className={`text-[10px] font-bold uppercase tracking-widest px-3 mt-6 mb-2 ${mutedText}`}>System</p>
          {systemItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeView === item.id ? navActiveBg : navInactiveBg}`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Header */}
        <header className={`h-20 flex items-center justify-between px-6 md:px-8 border-b ${borderColor} ${surfaceBg} transition-colors duration-500 shrink-0`}>
          <h1 className="text-lg font-bold tracking-tight">{viewTitles[activeView]}</h1>
          <div className="flex items-center gap-5">
            <span className={`text-sm hidden md:block ${mutedText}`}>{currentDate}</span>
            {/* Bell */}
            <button className={`relative p-2 rounded-lg ${hoverBg} transition-colors ${mutedText} ${buttonHoverText}`}>
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-black" />
            </button>
            {/* Avatar */}
            <div className="flex items-center gap-3">
              <img
                src="https://ui-avatars.com/api/?name=Sok+Dara&background=6366f1&color=fff&size=36&font-size=0.4&bold=true"
                alt="Sok Dara"
                className="w-9 h-9 rounded-full"
              />
              <div className="hidden md:flex flex-col leading-tight">
                <span className="text-sm font-semibold">Sok Dara</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${brandColor}`}>Student</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={`flex-1 overflow-y-auto p-6 md:p-8 ${appBg}`}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default StudentDashboard;