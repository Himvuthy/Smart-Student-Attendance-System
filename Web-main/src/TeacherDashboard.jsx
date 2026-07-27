import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, Bell, LayoutDashboard, BookOpen, 
  FileText, Settings, LogOut, Users, CheckCircle, XCircle, 
  BarChart3, LineChart, Sun, Moon, CalendarDays, 
  Search, PieChart, User, Clock, MapPin
} from 'lucide-react';

const TeacherDashboard = ({ onLogout }) => {
  // --- UI STATES ---
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('teacherActiveView') || 'dashboard';
  });

  useEffect(() => {
    if (activeView) {
      localStorage.setItem('teacherActiveView', activeView);
    }
  }, [activeView]);

  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('appTheme') === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('appTheme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' 
  }).toUpperCase();

  // --- DYNAMIC THEME CLASSES ---
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

  const viewTitles = {
    dashboard: 'Teacher Dashboard',
    attendance: 'Class Attendance',
    classes: 'My Classes',
    reports: 'Attendance Reports',
    settings: 'Settings'
  };

  // --- MOCK DATA ---
  const attendanceRecords = [
    { name: 'Sok Dara', id: 'ST-001', date: '2026-07-16', time: '07:45 AM', status: 'Present' },
    { name: 'Chan Malis', id: 'ST-002', date: '2026-07-16', time: '07:52 AM', status: 'Present' },
    { name: 'Heng Sophal', id: 'ST-003', date: '2026-07-16', time: '08:12 AM', status: 'Late' },
    { name: 'Nget Sreymom', id: 'ST-004', date: '2026-07-16', time: '—', status: 'Absent' },
    { name: 'Keo Veasna', id: 'ST-005', date: '2026-07-16', time: '07:48 AM', status: 'Present' },
    { name: 'Phan Borey', id: 'ST-006', date: '2026-07-16', time: '08:05 AM', status: 'Late' },
    { name: 'Ly Chanreaksmey', id: 'ST-007', date: '2026-07-16', time: '07:40 AM', status: 'Present' },
    { name: 'Yim Raksa', id: 'ST-008', date: '2026-07-16', time: '—', status: 'Absent' },
    { name: 'Chea Pisey', id: 'ST-009', date: '2026-07-16', time: '07:55 AM', status: 'Present' },
    { name: 'Mao Kunthea', id: 'ST-010', date: '2026-07-16', time: '07:38 AM', status: 'Present' },
  ];

  const getStatusBadge = (status) => {
    if (status === 'Present') {
      return isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-700';
    }
    if (status === 'Late') {
      return isDark ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-700';
    }
    return isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-700';
  };

  return (
    <div className={`flex h-screen overflow-hidden ${appBg} ${textColor} font-sans transition-colors duration-500 animate-in fade-in duration-500`}>
      
      <aside className={`w-64 ${surfaceBg} border-r ${borderColor} flex flex-col z-20 transition-colors duration-500 shrink-0`}>
        <div className={`h-20 flex items-center px-6 border-b ${borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
               <Fingerprint className={`w-5 h-5 transition-colors duration-500 ${isDark ? 'text-cyan-400' : 'text-indigo-600'}`} />
            </div>
            <h1 className="text-lg font-black tracking-tight">Smart<span className={brandColor}>Attendance</span></h1>
          </div>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar">
          <p className={`px-4 text-xs font-semibold ${mutedText} uppercase tracking-wider mb-2`}>Main Menu</p>
          <ul className="space-y-1 mb-8">
            <li>
              <button onClick={() => setActiveView('dashboard')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'dashboard' ? navActiveBg : navInactiveBg}`}>
                <LayoutDashboard className={`w-5 h-5 mr-3 ${activeView === 'dashboard' ? '' : 'opacity-70'}`} /> Dashboard
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('attendance')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'attendance' ? navActiveBg : navInactiveBg}`}>
                <CalendarDays className={`w-5 h-5 mr-3 ${activeView === 'attendance' ? '' : 'opacity-70'}`} /> Class Attendance
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('classes')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'classes' ? navActiveBg : navInactiveBg}`}>
                <BookOpen className={`w-5 h-5 mr-3 ${activeView === 'classes' ? '' : 'opacity-70'}`} /> My Classes
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('reports')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'reports' ? navActiveBg : navInactiveBg}`}>
                <FileText className={`w-5 h-5 mr-3 ${activeView === 'reports' ? '' : 'opacity-70'}`} /> Attendance Reports
              </button>
            </li>
          </ul>

          <p className={`px-4 text-xs font-semibold ${mutedText} uppercase tracking-wider mb-2`}>System</p>
          <ul className="space-y-1">
            <li>
              <button onClick={() => setActiveView('settings')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'settings' ? navActiveBg : navInactiveBg}`}>
                <Settings className={`w-5 h-5 mr-3 ${activeView === 'settings' ? '' : 'opacity-70'}`} /> Settings
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className={`h-20 ${surfaceBg} border-b ${borderColor} flex items-center justify-between px-8 z-10 transition-colors duration-500 shrink-0`}>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className={`${brandColor} font-bold text-lg`}>{viewTitles[activeView]}</span>
          </div>
          
          <div className="flex items-center gap-5">
            <span className={`${mutedText} uppercase tracking-wider text-xs font-semibold hidden md:block`}>{currentDate}</span>
            <button className={`${mutedText} ${buttonHoverText} transition relative p-2 ml-2`}>
              <Bell size={20} />
              <span className={`absolute top-1.5 right-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 border-2 ${isDark ? 'border-black' : 'border-white'}`}></span>
            </button>
            <div className={`h-8 w-px ${borderColor} mx-2`}></div>
            <div className="flex items-center gap-3 cursor-pointer">
              <img src="https://ui-avatars.com/api/?name=Mr.+Vuthy&background=6366f1&color=fff" alt="Teacher" className={`h-9 w-9 rounded-full shadow-sm border ${borderColor}`} />
              <div className="hidden md:block text-sm">
                <p className="font-bold leading-none">Mr. Vuthy</p>
                <p className={`text-xs ${brandColor} mt-1 font-semibold uppercase tracking-wider`}>TEACHER</p>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-6 md:p-8 ${appBg} transition-colors duration-500`}>
          <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* --- 1. DASHBOARD VIEW --- */}
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className={`text-xs ${mutedText} font-bold uppercase tracking-wider`}>My Students</p>
                      <Users className={`w-4 h-4 ${mutedText}`} />
                    </div>
                    <p className="text-3xl font-bold">156</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-2"><p className={`text-xs ${mutedText} font-bold uppercase tracking-wider`}>Classes Today</p><BookOpen className={`w-4 h-4 ${mutedText}`} /></div>
                    <p className="text-3xl font-bold">5</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-2"><p className={`text-xs ${mutedText} font-bold uppercase tracking-wider`}>Present Today</p><CheckCircle className="w-4 h-4 text-green-500" /></div>
                    <p className="text-3xl font-bold text-green-500">142</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-2"><p className={`text-xs ${mutedText} font-bold uppercase tracking-wider`}>Absent Today</p><XCircle className="w-4 h-4 text-red-500" /></div>
                    <p className="text-3xl font-bold text-red-500">14</p>
                  </div>
                </div>

                <div className={`${cardStyle} mb-6`}>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-bold text-lg">Weekly Attendance Trend</h3>
                      <p className={`text-xs ${mutedText}`}>Attendance averages across your classes for the past week.</p>
                    </div>
                  </div>
                  <div className="relative h-64 w-full flex-1 rounded-xl overflow-hidden">
                    <div className="absolute inset-0 flex items-end gap-1.5 px-2 pb-6 pt-2">
                      {[91,88,94,86,93,90,95].map((val, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-bold ${mutedText}`}>{val}%</span>
                          <div
                            className={`w-full rounded-t-md transition-all duration-500 ${isDark ? 'bg-cyan-500/60 hover:bg-cyan-400' : 'bg-indigo-400/60 hover:bg-indigo-500'}`}
                            style={{ height: `${val}%` }}
                            title={`Day ${i + 1}: ${val}%`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className={`absolute bottom-0 left-0 right-0 flex justify-between px-3 py-1.5 text-[9px] font-bold ${mutedText}`}>
                      <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-bold text-lg">Daily Check-ins</h3>
                        <p className={`text-xs ${mutedText}`}>Today's check-ins.</p>
                      </div>
                    </div>
                    <div className="relative h-56 w-full flex-1 rounded-xl overflow-hidden">
                      <div className="absolute inset-0 flex items-end gap-2 px-3 pb-6 pt-2">
                        {[{l:'8AM',v:52},{l:'9AM',v:85},{l:'10AM',v:70},{l:'11AM',v:40},{l:'12PM',v:15},{l:'1PM',v:60},{l:'2PM',v:75},{l:'3PM',v:45}].map((d, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1">
                            <div
                              className={`w-full rounded-t-md ${isDark ? 'bg-cyan-500/50 hover:bg-cyan-400' : 'bg-indigo-400/50 hover:bg-indigo-500'} transition-all`}
                              style={{ height: `${d.v}%` }}
                              title={`${d.l}: ${d.v} check-ins`}
                            />
                          </div>
                        ))}
                      </div>
                      <div className={`absolute bottom-0 left-0 right-0 flex justify-between px-3 py-1 text-[9px] font-bold ${mutedText}`}>
                        <span>8AM</span><span>12PM</span><span>3PM</span>
                      </div>
                    </div>
                  </div>

                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-bold text-lg">Weekly Trend</h3>
                        <p className={`text-xs ${mutedText}`}>Last 5 days.</p>
                      </div>
                    </div>
                    <div className="relative h-56 w-full flex-1 rounded-xl overflow-hidden px-3 pb-6 pt-4">
                      <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
                        <polyline
                          points="0,30 40,20 80,35 120,15 160,25 200,10"
                          fill="none"
                          className={isDark ? 'stroke-cyan-400' : 'stroke-indigo-500'}
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <polyline
                          points="0,30 40,20 80,35 120,15 160,25 200,10 200,100 0,100"
                          fill={isDark ? 'rgba(34,211,238,0.1)' : 'rgba(99,102,241,0.1)'}
                          stroke="none"
                        />
                        {[[0,30],[40,20],[80,35],[120,15],[160,25],[200,10]].map(([x,y],i) => (
                          <circle key={i} cx={x} cy={y} r="4" className={isDark ? 'fill-cyan-400' : 'fill-indigo-500'} />
                        ))}
                      </svg>
                      <div className={`absolute bottom-0 left-0 right-0 flex justify-between px-3 py-1 text-[9px] font-bold ${mutedText}`}>
                        <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span>
                      </div>
                    </div>
                  </div>

                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-bold text-lg">Present vs Absent Ratio</h3>
                        <p className={`text-xs ${mutedText}`}>Today's breakdown.</p>
                      </div>
                    </div>
                    <div className="relative h-56 w-full flex-1 rounded-xl flex items-center justify-center">
                      <div className="relative w-36 h-36">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" className={isDark ? 'stroke-white/5' : 'stroke-gray-100'} strokeWidth="3.5" />
                          <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-green-500" strokeWidth="3.5" strokeDasharray="91 9" strokeLinecap="round" />
                          <circle cx="18" cy="18" r="15.9" fill="none" className="stroke-red-500" strokeWidth="3.5" strokeDasharray="0 91 9 0" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-2xl font-black">91%</span>
                          <span className={`text-[10px] font-semibold ${mutedText}`}>Present</span>
                        </div>
                      </div>
                      <div className="ml-5 space-y-2">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span><span className={`text-xs font-semibold ${mutedText}`}>Present (142)</span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className={`text-xs font-semibold ${mutedText}`}>Absent (14)</span></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- 2. CLASS ATTENDANCE VIEW --- */}
            {activeView === 'attendance' && (
              <div className={`${cardStyle} !p-0 overflow-hidden`}>
                <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${borderColor}`}>
                  <div>
                    <h3 className="font-bold text-lg">Class Attendance</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>View and manage student attendance for your classes.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                    <select className={`${inputStyle} sm:w-56`}>
                      <option>CS-101 - Intro to Programming</option>
                      <option>CS-201 - Data Structures</option>
                      <option>CS-301 - Database Systems</option>
                      <option>MAT-101 - Calculus</option>
                    </select>
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                        <input type="text" placeholder="Search student..." className={`${inputStyle} pl-10 h-full w-full sm:w-60 bg-transparent`} />
                    </div>
                  </div>
                </div>
                
                <div className="overflow-x-auto p-6 pt-0 custom-scrollbar">
                  <table className="w-full text-sm text-left mt-4 whitespace-nowrap">
                    <thead className={`text-xs ${mutedText} uppercase tracking-wider ${subBg}`}>
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg font-semibold">Student Name</th>
                        <th className="px-4 py-3 font-semibold">Student ID</th>
                        <th className="px-4 py-3 font-semibold">Date</th>
                        <th className="px-4 py-3 font-semibold">Check-in Time</th>
                        <th className="px-4 py-3 font-semibold rounded-tr-lg">Status</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderSubColor}`}>
                      {attendanceRecords.map((record) => (
                        <tr key={record.id} className={`${hoverBg} transition-colors group`}>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(record.name)}&background=random`} alt={record.name} className="w-10 h-10 rounded-full" />
                              <span className="block font-bold">{record.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`text-[13px] font-medium ${mutedText}`}>{record.id}</span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="text-[13px] font-medium">{record.date}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1.5">
                              <Clock className={`w-3.5 h-3.5 ${mutedText}`} />
                              <span className="text-[13px] font-medium">{record.time}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-2.5 py-1 rounded-md text-[12px] font-bold tracking-wide uppercase ${getStatusBadge(record.status)}`}>
                              {record.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* --- 3. MY CLASSES VIEW --- */}
            {activeView === 'classes' && (
              <div className={`${cardStyle}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg">My Classes</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>View your assigned classes and student rosters.</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    { code: 'CS-101', name: 'Intro to Programming', students: 45, room: 'A201' },
                    { code: 'CS-201', name: 'Data Structures', students: 38, room: 'B102' },
                    { code: 'CS-301', name: 'Database Systems', students: 42, room: 'C305' },
                    { code: 'MAT-101', name: 'Calculus', students: 31, room: 'A105' },
                  ].map((cls) => (
                    <div key={cls.code} className={`border rounded-xl p-5 ${borderSubColor} ${subBg}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-lg">{cls.code}</p>
                          <p className={`text-xs ${brandColor} font-semibold uppercase tracking-wider`}>{cls.name}</p>
                        </div>
                        <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${isDark ? 'bg-black text-gray-300' : 'bg-white text-gray-600 shadow-sm border border-gray-100'}`}>{cls.students} Students</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-3">
                        <MapPin className={`w-3.5 h-3.5 ${mutedText}`} />
                        <p className={`text-xs font-medium ${mutedText}`}>Room {cls.room}</p>
                      </div>
                      <div className={`mt-4 pt-4 border-t ${borderSubColor} flex items-center justify-between`}>
                        <div className="flex items-center gap-2">
                          <img src="https://ui-avatars.com/api/?name=Mr.+Vuthy&background=eef2ff&color=6366f1" className="w-6 h-6 rounded-full" alt="Mr. Vuthy" />
                          <p className={`text-xs font-medium ${mutedText}`}>Mr. Vuthy</p>
                        </div>
                        <button className={`text-xs font-bold hover:underline ${brandColor}`}>View Attendance</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* --- 4. ATTENDANCE REPORTS VIEW --- */}
            {activeView === 'reports' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`${cardStyle}`}>
                  <div className="mb-6">
                    <h3 className="font-bold text-lg">Report Generation</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Export attendance data for your classes.</p>
                  </div>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Time Range</label>
                      <select className={inputStyle}>
                        <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Semester</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Class Filter</label>
                      <select className={inputStyle}>
                        <option>All My Classes</option>
                        <option>CS-101 - Intro to Programming</option>
                        <option>CS-201 - Data Structures</option>
                        <option>CS-301 - Database Systems</option>
                        <option>MAT-101 - Calculus</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-auto">
                    <button className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-csv text-xl"></i> CSV</button>
                    <button className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-excel text-xl"></i> Excel</button>
                    <button className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-pdf text-xl"></i> PDF</button>
                  </div>
                </div>

                <div className={`${cardStyle}`}>
                  <div className="mb-6">
                    <h3 className="font-bold text-lg">Attendance Summary</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Quick overview of your attendance metrics.</p>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Average Attendance Rate</label>
                      <p className="text-3xl font-bold text-green-500">91.2%</p>
                      <p className={`text-[10px] ${mutedText} mt-1.5`}>Across all your classes this semester.</p>
                    </div>
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Most Absent Class</label>
                      <p className="text-lg font-bold text-red-500">CS-301</p>
                      <p className={`text-[10px] ${mutedText} mt-1.5`}>Database Systems — 82.4% attendance rate.</p>
                    </div>
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Best Attendance</label>
                      <p className="text-lg font-bold text-green-500">CS-101</p>
                      <p className={`text-[10px] ${mutedText} mt-1.5`}>Intro to Programming — 96.8% attendance rate.</p>
                    </div>
                    <div className={`pt-6 border-t ${borderSubColor}`}>
                      <div className={`rounded-xl p-4 border ${borderSubColor} ${subBg}`}>
                        <p className={`text-xs font-bold ${mutedText} uppercase tracking-wider mb-2`}>Semester Summary</p>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-lg font-bold">156</p>
                            <p className={`text-[10px] ${mutedText} font-medium`}>Total Students</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">4</p>
                            <p className={`text-[10px] ${mutedText} font-medium`}>Active Classes</p>
                          </div>
                          <div>
                            <p className="text-lg font-bold">2,340</p>
                            <p className={`text-[10px] ${mutedText} font-medium`}>Total Check-ins</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- 5. SETTINGS VIEW --- */}
            {activeView === 'settings' && (
              <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className={`${cardStyle} p-8`}>
                  <h3 className={`font-bold mb-6 text-lg border-b ${borderColor} pb-4`}>System Preferences</h3>
                  <div className="space-y-8 max-w-lg">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold">Theme Preference</p>
                        <p className={`text-xs ${mutedText} mt-1`}>Select your default dashboard theme.</p>
                      </div>
                      <div className={`flex rounded-lg p-1 border transition-colors ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
                        <button 
                          onClick={() => setIsDark(false)} 
                          className={`px-4 py-1.5 text-sm rounded-md font-bold transition-all flex items-center gap-2 ${!isDark ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-400 hover:text-white'}`}
                        >
                          <Sun size={14} /> Light
                        </button>
                        <button 
                          onClick={() => setIsDark(true)} 
                          className={`px-4 py-1.5 text-sm rounded-md font-bold transition-all flex items-center gap-2 ${isDark ? 'bg-black shadow-[0_0_10px_rgba(255,255,255,0.1)] text-cyan-400 border border-white/10' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          <Moon size={14} /> Dark
                        </button>
                      </div>
                    </div>
                    <div className={`pt-8 border-t ${borderColor}`}>
                       <p className="font-semibold text-red-500">Session Management</p>
                       <p className={`text-xs ${mutedText} mt-1 mb-4`}>Securely end your current session.</p>
                       <button onClick={onLogout} className="px-6 py-2.5 rounded-lg font-bold text-sm transition-colors bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white flex items-center gap-2">
                         <LogOut size={16} /> Log Out
                       </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default TeacherDashboard;