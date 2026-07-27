import React, { useState, useEffect, useMemo } from 'react';
import {
  Fingerprint, Bell, LayoutDashboard, Database, BookOpen,
  Cpu, FileText, Terminal, Settings, LogOut,
  Users, CheckCircle, XCircle, BarChart3, LineChart, Sun, Moon,
  CalendarDays, Search, Pencil, Trash2, KeyRound, PieChart, Info,
  Plus, Download, Upload, MapPin, Clock, Filter
} from 'lucide-react';
// Overlays
import ProfileOverlay from '../components/overlays/ProfileOverlay';
import NotificationOverlay from '../components/overlays/NotificationOverlay';
import EditUserModal from '../components/overlays/EditUserModal';
import DeleteUserModal from '../components/overlays/DeleteUserModal';
import SettingsOverlay from '../components/overlays/SettingsOverlay';
// Charts
import AttendanceChart from '../components/dashboard/AttendanceChart';
import DailyBarChart from '../components/dashboard/DailyBarChart';
import RatioPieChart from '../components/dashboard/RatioPieChart';
const API_URL = "https://backend-testing-production-e05f.up.railway.app";
const AdminDashboard = ({ onLogout, currentUser }) => {
  // ─────────────────────────────────────────
  // UI STATES
  // ─────────────────────────────────────────
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('adminActiveView') || 'dashboard';
  });
  useEffect(() => {
    if (activeView) {
      localStorage.setItem('adminActiveView', activeView);
    }
  }, [activeView]);
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('appTheme') === 'dark';
  });
  useEffect(() => {
    localStorage.setItem('appTheme', isDark ? 'dark' : 'light');
  }, [isDark]);
  // ─────────────────────────────────────────
  // OVERLAY STATES
  // ─────────────────────────────────────────
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationsExpanded, setShowNotificationsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  // ─────────────────────────────────────────
  // DATA STATES
  // ─────────────────────────────────────────
  const [stats, setStats] = useState({
    totalStudents: '...',
    activeClasses: '...',
    presentToday: '...',
    absentToday: '...'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [classes, setClasses] = useState([]);
  const [isClassesLoading, setIsClassesLoading] = useState(false);
  const [devices, setDevices] = useState([]);
  const [isDevicesLoading, setIsDevicesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // Mock notifications (until backend endpoint exists)
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'alert', title: 'Malfunction Device', message: 'AS608-AI09 has reported not scanning.', time: '10min ago', isRead: false },
    { id: 2, type: 'backup', title: 'Backup', message: 'Successfully backup today data.', time: '13min ago', isRead: false },
    { id: 3, type: 'class', title: 'Next Classes', message: 'Calculus-1. Teach by Dr.Lee start in 1h at T307.', time: '4h ago', isRead: true },
    { id: 4, type: 'alert', title: 'Malfunction Device', message: 'AS608-T301 is not turning on.', time: '4h ago', isRead: true },
  ]);
  // Mock profile data (until backend endpoint exists)
  const profileData = {
    name: currentUser?.username ? currentUser.username.charAt(0).toUpperCase() + currentUser.username.slice(1) : 'System Admin',
    username: currentUser?.username || 'admin',
    email: 'admin@smartattendance.edu',
    phone: '(+855) 99118767',
    gender: 'Male',
    role: currentUser?.role || 'Admin',
    department: 'Stem-911',
    position: 'Smart Attendance System Administrator',
    bio: 'System administrator managing attendance records, user accounts, and daily operations.',
    userId: '6781167',
    createdAt: '23-09-2025',
    lastLogin: new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }),
    availableHours: '7:00AM - 9:00PM'
  };
  // ─────────────────────────────────────────
  // FETCH: Dashboard Stats
  // ─────────────────────────────────────────
  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        const response = await fetch(`${API_URL}/api/admin/stats`);
        const data = await response.json();
        if (data.success) {
          setStats({
            totalStudents: data.totalStudents,
            activeClasses: data.classes,
            presentToday: data.present,
            absentToday: data.absent
          });
        }
      } catch (error) {
        console.error("Failed to fetch admin stats:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdminStats();
  }, []);
  // ─────────────────────────────────────────
  // FETCH: Dynamic by active view
  // ─────────────────────────────────────────
  useEffect(() => {
    if (activeView === 'database') {
      fetchUsers('users');
    } else if (activeView === 'biometric') {
      fetchUsers('students');
    } else if (activeView === 'classes') {
      fetchClasses();
    } else if (activeView === 'hardware') {
      fetchDevices();
    }
  }, [activeView]);
  const fetchUsers = async (endpoint) => {
    setIsUsersLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/${endpoint}`);
      const data = await response.json();
      if (data.success) setUsers(data.users);
    } catch (error) {
      console.error(`Failed to fetch ${endpoint}:`, error);
    } finally {
      setIsUsersLoading(false);
    }
  };
  const fetchClasses = async () => {
    setIsClassesLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/classes`);
      const data = await response.json();
      if (data.success) setClasses(data.classes);
    } catch (error) {
      console.error("Failed to fetch classes:", error);
    } finally {
      setIsClassesLoading(false);
    }
  };
  const fetchDevices = async () => {
    setIsDevicesLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/devices`);
      const data = await response.json();
      if (data.success) setDevices(data.devices);
    } catch (error) {
      console.error("Failed to fetch devices:", error);
    } finally {
      setIsDevicesLoading(false);
    }
  };
  // ─────────────────────────────────────────
  // HANDLERS: Edit User (via modal)
  // ─────────────────────────────────────────
  const handleEditUserSave = async (updatedUser) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${updatedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: updatedUser.name, role: updatedUser.role })
      });
      const data = await response.json();
      if (data.success) {
        setUsers(users.map(u => u.id === updatedUser.id ? { ...u, name: updatedUser.name } : u));
        setEditingUser(null);
      } else {
        alert("Failed to save changes.");
      }
    } catch (error) {
      console.error("Edit error:", error);
      alert("Failed to save changes.");
    }
  };
  // ─────────────────────────────────────────
  // HANDLERS: Delete User (via modal)
  // ─────────────────────────────────────────
  const handleDeleteUserConfirm = async (userId) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setUsers(users.filter(u => u.id !== userId));
        setDeletingUser(null);
      } else {
        alert("Failed to delete user.");
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete user.");
    }
  };
  // ─────────────────────────────────────────
  // HANDLERS: Notifications
  // ─────────────────────────────────────────
  const handleMarkAllRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };
  // ─────────────────────────────────────────
  // HANDLERS: Export (client-side)
  // ─────────────────────────────────────────
  const handleExportCSV = () => {
    if (users.length === 0) return alert("No data to export.");
    const headers = ['ID', 'Name', 'Role', 'Email'];
    const rows = users.map(u => [u.id, u.name, u.role, u.email || '']);
    const csvContent = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const handleExportExcel = () => {
    handleExportCSV(); // CSV can be opened in Excel
  };
  const handleExportPDF = () => {
    window.print();
  };
  // ─────────────────────────────────────────
  // SEARCH FILTER
  // ─────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(u =>
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.id && String(u.id).includes(term)) ||
      (u.email && u.email.toLowerCase().includes(term))
    );
  }, [users, searchTerm]);
  // ─────────────────────────────────────────
  // MISC
  // ─────────────────────────────────────────
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'
  }).toUpperCase();
  const unreadCount = notifications.filter(n => !n.isRead).length;
  // ─────────────────────────────────────────
  // DYNAMIC THEME CLASSES
  // ─────────────────────────────────────────
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
  const cardStyle = `${surfaceBg} rounded-2xl border ${borderColor} p-6 flex flex-col ${isDark ? 'shadow-[0_0_15px_rgba(255,255,255,0.02)]' : 'shadow-sm'}`;
  const inputStyle = `w-full p-2.5 text-sm border rounded-lg focus:outline-none transition-colors ${isDark ? 'bg-[#111] border-white/20 text-white focus:border-cyan-400 [&>option]:bg-black [&>option]:text-white' : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-indigo-500 [&>option]:bg-white [&>option]:text-gray-800'}`;
  const getRoleBadgeColor = (role) => {
    const roleCheck = String(role).toLowerCase();
    if (roleCheck === 'admin' || roleCheck === '1') {
      return isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-700';
    }
    if (roleCheck === 'teacher' || roleCheck === 'lecturer' || roleCheck === '2') {
      return isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-700';
    }
    return isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-100 text-cyan-700';
  };
  const getDeviceStatus = (lastSeen) => {
    if (!lastSeen || lastSeen === 'None') return false;
    try {
      const lastSeenDate = new Date(lastSeen);
      const now = new Date();
      const diffMs = now - lastSeenDate;
      return diffMs < 5 * 60 * 1000; // Online if seen within 5 minutes
    } catch {
      return false;
    }
  };
  const viewTitles = {
    dashboard: 'Admin Dashboard',
    database: 'User Database',
    biometric: 'Biometric Enrollment',
    timetable: 'Schedule / Time Table Management',
    classes: 'Class Management',
    hardware: 'Hardware Scanners',
    reports: 'Reports & Backups',
    logs: 'System Logs',
  };
  // ─────────────────────────────────────────
  // NAV ITEMS
  // ─────────────────────────────────────────
  const mainNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'database', label: 'User Database', icon: Database },
    { id: 'biometric', label: 'Biometric Enrollment', icon: Fingerprint },
    { id: 'timetable', label: 'Time Table', icon: CalendarDays },
    { id: 'classes', label: 'Class Management', icon: BookOpen },
    { id: 'hardware', label: 'Hardware Scanners', icon: Cpu },
    { id: 'reports', label: 'Reports & Backup', icon: FileText },
    { id: 'logs', label: 'System Logs', icon: Terminal },
  ];
  return (
    <div className={`flex h-screen overflow-hidden ${appBg} ${textColor} font-sans transition-colors duration-500 animate-in`}>
      {/* ═══════════════════════════════════════
          SIDEBAR
          ═══════════════════════════════════════ */}
      <aside className={`w-64 ${surfaceBg} border-r ${borderColor} flex flex-col z-20 transition-colors duration-500 shrink-0`}>
        <div className={`h-20 flex items-center px-6 border-b ${borderColor}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-sm transition-all duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
              <Fingerprint className={`w-5 h-5 transition-colors duration-500 ${isDark ? 'text-cyan-400' : 'text-indigo-600'}`} />
            </div>
            <h1 className="text-lg font-black tracking-tight">Smart<span className={brandColor}>Attendance</span></h1>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-6 px-3 custom-scrollbar flex flex-col">
          <p className={`px-4 text-xs font-semibold ${mutedText} uppercase tracking-wider mb-2`}>Main Menu</p>
          <ul className="space-y-1 mb-8">
            {mainNavItems.map(item => (
              <li key={item.id}>
                <button
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === item.id ? navActiveBg : navInactiveBg}`}
                >
                  <item.icon className={`w-5 h-5 mr-3 ${activeView === item.id ? '' : 'opacity-70'}`} />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          {/* Bottom action buttons */}
          <div className={`flex items-center justify-between px-2 pt-4 border-t ${borderSubColor} mt-auto`}>
            <button onClick={onLogout} title="Log Out" className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
              <LogOut size={18} />
            </button>
            <button title="Info" className={`p-2 rounded-lg transition-colors ${navInactiveBg}`}>
              <Info size={18} />
            </button>
            <button onClick={() => setIsDark(!isDark)} title="Toggle Theme" className={`p-2 rounded-lg transition-colors ${navInactiveBg}`}>
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setShowSettings(true)} title="Settings" className={`p-2 rounded-lg transition-colors ${navInactiveBg}`}>
              <Settings size={18} />
            </button>
          </div>
        </nav>
      </aside>
      {/* ═══════════════════════════════════════
          MAIN AREA
          ═══════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* ─── HEADER ─── */}
        <header className={`h-20 ${surfaceBg} border-b ${borderColor} flex items-center justify-between px-8 z-10 transition-colors duration-500 shrink-0`}>
          <div className="flex items-center gap-4 text-sm font-medium">
            <span className={`${brandColor} font-bold text-lg`}>{viewTitles[activeView]}</span>
          </div>
          <div className="flex items-center gap-5">
            <span className={`${mutedText} uppercase tracking-wider text-xs font-semibold hidden md:block`}>{currentDate}</span>
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowNotificationsExpanded(false);
                }}
                className={`${mutedText} transition relative p-2 ml-2 rounded-lg ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className={`absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold border-2 ${isDark ? 'border-black' : 'border-white'}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
              {/* Notification Dropdown */}
              <NotificationOverlay
                isOpen={showNotifications && !showNotificationsExpanded}
                onClose={() => setShowNotifications(false)}
                isDark={isDark}
                isExpanded={false}
                onExpand={() => setShowNotificationsExpanded(true)}
                notifications={notifications}
                onMarkAllRead={handleMarkAllRead}
              />
            </div>
            <div className={`h-8 w-px ${borderColor} mx-2`}></div>
            {/* Profile Avatar (clickable) */}
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => setShowProfile(true)}
            >
              <img
                src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.name)}&background=6366f1&color=fff`}
                alt="Admin"
                className={`h-9 w-9 rounded-full shadow-sm border ${borderColor} group-hover:ring-2 ring-indigo-500/50 transition-all`}
              />
              <div className="hidden md:block text-sm">
                <p className="font-bold leading-none">{profileData.name}</p>
                <p className={`text-xs ${brandColor} mt-1 font-semibold uppercase tracking-wider`}>
                  {typeof profileData.role === 'number' ? (profileData.role === 1 ? 'ADMIN' : profileData.role === 2 ? 'TEACHER' : 'STUDENT') : String(profileData.role).toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </header>
        {/* ─── CONTENT ─── */}
        <div className={`flex-1 overflow-y-auto p-6 md:p-8 ${appBg} transition-colors duration-500 custom-scrollbar`}>
          <div className="max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-4">
            {/* ═══════════════════════════════════
                1. DASHBOARD VIEW
                ═══════════════════════════════════ */}
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6">
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className={`text-xs ${mutedText} font-bold uppercase tracking-wider`}>Total Students</p>
                      <Users className={`w-4 h-4 ${mutedText}`} />
                    </div>
                    <p className="text-3xl font-bold">{isLoading ? '...' : (stats.totalStudents || '0')}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className={`text-xs ${mutedText} font-bold uppercase tracking-wider`}>Active Classes</p>
                      <BookOpen className={`w-4 h-4 ${mutedText}`} />
                    </div>
                    <p className="text-3xl font-bold">{isLoading ? '...' : (stats.activeClasses || '0')}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className={`text-xs ${mutedText} font-bold uppercase tracking-wider`}>Enrollment</p>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <p className="text-3xl font-bold text-green-500">{isLoading ? '...' : (stats.presentToday || '0')}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className={`text-xs ${mutedText} font-bold uppercase tracking-wider`}>Pending Enrollment</p>
                      <XCircle className="w-4 h-4 text-red-500" />
                    </div>
                    <p className="text-3xl font-bold text-red-500">{isLoading ? '...' : (stats.absentToday || '0')}</p>
                  </div>
                </div>
                {/* 24-Week Attendance Chart */}
                <div className={`${cardStyle} mb-6`}>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="font-bold text-lg">24-Week Attendance History</h3>
                      <p className={`text-xs ${mutedText}`}>Overall attendance averages across all classes for the last 24 weeks.</p>
                    </div>
                  </div>
                  <div className="h-64 w-full">
                    <AttendanceChart isDark={isDark} stats={stats} />
                  </div>
                </div>
                {/* Bottom row: Daily, Weekly, Pie */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-bold text-lg">Daily Chart</h3>
                        <p className={`text-xs ${mutedText}`}>Today's check-ins.</p>
                      </div>
                    </div>
                    <div className="h-56 w-full">
                      <DailyBarChart isDark={isDark} stats={stats} />
                    </div>
                  </div>
                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-bold text-lg">Weekly Trend</h3>
                        <p className={`text-xs ${mutedText}`}>Last 5 days.</p>
                      </div>
                    </div>
                    <div className="h-56 w-full">
                      <AttendanceChart isDark={isDark} stats={stats} weeklyMode />
                    </div>
                  </div>
                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <h3 className="font-bold text-lg">Today's Ratio</h3>
                        <p className={`text-xs ${mutedText}`}>Enrolled vs. Pending</p>
                      </div>
                    </div>
                    <div className="h-56 w-full">
                      <RatioPieChart isDark={isDark} stats={stats} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* ═══════════════════════════════════
                2. USER DATABASE VIEW
                ═══════════════════════════════════ */}
            {activeView === 'database' && (
              <div className={`${cardStyle} !p-0 overflow-hidden`}>
                <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${borderColor}`}>
                  <div>
                    <h3 className="font-bold text-lg">User Management</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Manage roles, edit, and reset passwords.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                      <input
                        type="text"
                        placeholder="Search ID or Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`${inputStyle} pl-10 h-full w-full sm:w-60 bg-transparent`}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleExportCSV} className={`${subBg} ${textColor} text-xs px-4 py-2.5 rounded-lg font-semibold ${hoverBg} transition flex items-center gap-1.5`}>
                        <Download size={13} /> Export
                      </button>
                      <button className={`text-white text-xs px-5 py-2.5 rounded-lg shadow-sm font-semibold transition flex items-center gap-1.5 ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                        <Users size={14} /> Add User
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto p-6 pt-0 custom-scrollbar">
                  <table className="w-full text-sm text-left mt-4 whitespace-nowrap">
                    <thead className={`text-xs ${mutedText} uppercase tracking-wider ${subBg}`}>
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg font-semibold">User Details</th>
                        <th className="px-4 py-3 font-semibold">Role</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold rounded-tr-lg text-right">Management Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderSubColor}`}>
                      {isUsersLoading ? (
                        <tr><td colSpan="4" className={`text-center py-8 font-bold ${brandColor}`}>Loading Database...</td></tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan="4" className={`text-center py-8 font-bold ${mutedText}`}>{searchTerm ? 'No matching users found.' : 'No users found.'}</td></tr>
                      ) : (
                        filteredUsers.map((user) => (
                          <tr key={user.id} className={`${hoverBg} transition-colors group`}>
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=random`} alt={user.name} className="w-10 h-10 rounded-full" />
                                <div>
                                  <span className="block font-bold">{user.name}</span>
                                  <span className={`text-[11px] ${mutedText}`}>ID: {user.id}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`px-2.5 py-1 rounded-md text-[12px] font-bold tracking-wide uppercase ${getRoleBadgeColor(user.role)}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-[13px] font-medium">{user.email || '—'}</span>
                            </td>
                            <td className="px-4 py-4 text-right space-x-2">
                              <button title="Reset Password" className={`p-2 rounded-lg transition ${subBg} ${hoverBg} ${brandColor}`}>
                                <KeyRound size={16} />
                              </button>
                              <button
                                onClick={() => setEditingUser(user)}
                                title="Edit User"
                                className={`p-2 rounded-lg transition shadow-sm font-bold ${isDark ? 'bg-cyan-500 text-slate-900 hover:bg-cyan-400' : 'bg-indigo-500 text-white hover:bg-indigo-600'}`}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                onClick={() => setDeletingUser(user)}
                                title="Delete User"
                                className={`p-2 rounded-lg transition ${subBg} hover:bg-red-500/10 text-red-500`}
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* ═══════════════════════════════════
                3. BIOMETRIC ENROLLMENT VIEW
                ═══════════════════════════════════ */}
            {activeView === 'biometric' && (
              <div className={`${cardStyle} !p-0 overflow-hidden`}>
                <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${borderColor}`}>
                  <div>
                    <h3 className="font-bold text-lg">Biometric Enrollment</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Manage fingerprint data for registered students.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                      <input
                        type="text"
                        placeholder="Search ID or Name..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`${inputStyle} pl-10 h-full w-full sm:w-60 bg-transparent`}
                      />
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto p-6 pt-0 custom-scrollbar">
                  <table className="w-full text-sm text-left mt-4 whitespace-nowrap">
                    <thead className={`text-xs ${mutedText} uppercase tracking-wider ${subBg}`}>
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg font-semibold">User Details</th>
                        <th className="px-4 py-3 font-semibold">Sex</th>
                        <th className="px-4 py-3 font-semibold">Email</th>
                        <th className="px-4 py-3 font-semibold">Phone Number</th>
                        <th className="px-4 py-3 font-semibold">Fingerprint Status</th>
                        <th className="px-4 py-3 font-semibold rounded-tr-lg text-right">Management Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderSubColor}`}>
                      {isUsersLoading ? (
                        <tr><td colSpan="6" className={`text-center py-8 font-bold ${brandColor}`}>Loading Database...</td></tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan="6" className={`text-center py-8 font-bold ${mutedText}`}>{searchTerm ? 'No matching students found.' : 'No students found.'}</td></tr>
                      ) : (
                        filteredUsers.map((user) => {
                          const isRegistered = user.fingerprint_id !== null && user.fingerprint_id !== undefined && user.fingerprint_id !== '';
                          return (
                            <tr key={user.id} className={`${hoverBg} transition-colors group`}>
                              <td className="px-4 py-4">
                                <div>
                                  <span className="block font-bold text-[14px] mb-1">{user.name}</span>
                                  <span className={`text-[11px] ${mutedText} block`}>ID: {user.id}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-[13px] font-medium">
                                  {user.sex === 'M' ? 'Male' : user.sex === 'F' ? 'Female' : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-[13px] font-medium">{user.email || '—'}</span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-[13px] font-medium">{user.phone || '—'}</span>
                              </td>
                              <td className="px-4 py-4">
                                <div>
                                  <span className={`text-[12px] font-bold flex items-center gap-1.5 ${isRegistered ? 'text-green-500' : 'text-red-500'}`}>
                                    {isRegistered ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                    {isRegistered ? 'Registered' : 'Not Registered'}
                                  </span>
                                  <span className={`text-[11px] ${mutedText} block mt-1`}>
                                    {isRegistered ? `FP-${user.fingerprint_id}` : '—'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right space-x-2">
                                <button
                                  title="Add Fingerprint"
                                  className={`p-2 rounded-lg transition shadow-sm font-bold ${isDark ? 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-slate-900' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-500 hover:text-white'}`}
                                >
                                  <Fingerprint size={16} />
                                </button>
                                <button
                                  title="Delete Fingerprint"
                                  disabled={!isRegistered}
                                  className={`p-2 rounded-lg transition ${!isRegistered ? 'opacity-30 cursor-not-allowed' : `${subBg} hover:bg-red-500/10 text-red-500`}`}
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* ═══════════════════════════════════
                4. TIMETABLE VIEW
                ═══════════════════════════════════ */}
            {activeView === 'timetable' && (
              <div className={`${cardStyle}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Schedule / Timetable Management</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Define active learning periods and subject schedules.</p>
                  </div>
                  <button className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition flex items-center gap-1.5 ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                    <Plus size={14} /> Add Schedule
                  </button>
                </div>
                {/* Timetable Grid */}
                <div className={`border rounded-xl overflow-hidden ${borderColor}`}>
                  <div className={`grid grid-cols-6 text-xs font-bold uppercase tracking-wider ${subBg}`}>
                    <div className={`px-4 py-3 ${mutedText} border-r ${borderSubColor}`}>Time</div>
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                      <div key={day} className={`px-4 py-3 text-center ${mutedText} border-r last:border-r-0 ${borderSubColor}`}>{day}</div>
                    ))}
                  </div>
                  {['08:00 - 09:30', '09:45 - 11:15', '13:00 - 14:30', '14:45 - 16:15'].map((time, idx) => (
                    <div key={time} className={`grid grid-cols-6 border-t ${borderSubColor}`}>
                      <div className={`px-4 py-6 text-xs font-medium ${mutedText} border-r ${borderSubColor} flex items-center`}>{time}</div>
                      {[0,1,2,3,4].map(col => (
                        <div key={col} className={`px-2 py-3 border-r last:border-r-0 ${borderSubColor} flex items-center justify-center`}>
                          {(idx === 0 && col === 0) ? (
                            <div className={`text-xs p-2 rounded-lg w-full text-center ${isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-indigo-50 text-indigo-600'}`}>
                              <p className="font-bold">MAT-101</p>
                              <p className={`${mutedText} text-[10px] mt-0.5`}>Room T307</p>
                            </div>
                          ) : (idx === 1 && col === 2) ? (
                            <div className={`text-xs p-2 rounded-lg w-full text-center ${isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'}`}>
                              <p className="font-bold">PHY-201</p>
                              <p className={`${mutedText} text-[10px] mt-0.5`}>Lab A</p>
                            </div>
                          ) : (idx === 2 && col === 4) ? (
                            <div className={`text-xs p-2 rounded-lg w-full text-center ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
                              <p className="font-bold">CS-301</p>
                              <p className={`${mutedText} text-[10px] mt-0.5`}>Room B204</p>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className={`text-xs ${mutedText} mt-4 text-center`}>Timetable data will be loaded from the server when the <code className={brandColor}>/api/timetable</code> endpoint is available.</p>
              </div>
            )}
            {/* ═══════════════════════════════════
                5. CLASSES VIEW (REAL DATA)
                ═══════════════════════════════════ */}
            {activeView === 'classes' && (
              <div className={`${cardStyle}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Active Classes</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Manage rosters and class assignments.</p>
                  </div>
                  <button className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition flex items-center gap-1.5 ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                    <Plus size={14} /> Create Class
                  </button>
                </div>
                {isClassesLoading ? (
                  <div className={`text-center py-12 font-bold ${brandColor}`}>Loading Classes...</div>
                ) : classes.length === 0 ? (
                  <div className={`text-center py-12 ${mutedText}`}>
                    <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No classes found.</p>
                    <p className="text-xs mt-1">Create a class to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {classes.map(cls => (
                      <div key={cls.id} className={`border rounded-xl p-5 ${borderSubColor} ${subBg} hover:border-indigo-500/30 transition-colors`}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-bold text-lg">{cls.code}</p>
                            <p className={`text-xs ${brandColor} font-semibold uppercase tracking-wider`}>{cls.name}</p>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${isDark ? 'bg-black text-gray-300' : 'bg-white text-gray-600 shadow-sm border border-gray-100'}`}>
                            {cls.major}
                          </span>
                        </div>
                        <div className={`mt-4 pt-4 border-t ${borderSubColor} flex items-center justify-end`}>
                          <button className={`text-xs font-bold hover:underline ${brandColor}`}>Manage Roster</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* ═══════════════════════════════════
                6. HARDWARE / DEVICES VIEW (REAL DATA)
                ═══════════════════════════════════ */}
            {activeView === 'hardware' && (
              <div className={`${cardStyle}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Biometric Hardware Endpoints</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Monitor the connection status of physical fingerprint scanners.</p>
                  </div>
                  <button className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition flex items-center gap-1.5 ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                    <Plus size={14} /> Register Device
                  </button>
                </div>
                {isDevicesLoading ? (
                  <div className={`text-center py-12 font-bold ${brandColor}`}>Loading Devices...</div>
                ) : devices.length === 0 ? (
                  <div className={`text-center py-12 ${mutedText}`}>
                    <Cpu className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No devices registered.</p>
                    <p className="text-xs mt-1">Register a fingerprint scanner to get started.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {devices.map(device => {
                      const isOnline = getDeviceStatus(device.lastseen);
                      return (
                        <div key={device.id} className={`border rounded-xl p-5 flex flex-col justify-between ${borderSubColor} ${subBg}`}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <p className="font-bold text-lg">{device.name}</p>
                              <p className={`text-xs ${mutedText} mt-0.5 flex items-center gap-1`}>
                                <MapPin size={11} /> {device.location || 'Unknown'}
                              </p>
                            </div>
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1.5 ${isOnline
                              ? (isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700')
                              : (isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse-dot' : 'bg-red-500'}`}></span>
                              {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                          </div>
                          <div className={`pt-4 border-t ${borderSubColor} flex justify-between text-xs`}>
                            <span className={`${mutedText} flex items-center gap-1`}>
                              <Clock size={11} /> {device.lastseen && device.lastseen !== 'None' ? `Last: ${device.lastseen}` : 'Never connected'}
                            </span>
                            <button className={`font-bold hover:underline ${brandColor}`}>Configure</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* ═══════════════════════════════════
                7. REPORTS VIEW
                ═══════════════════════════════════ */}
            {activeView === 'reports' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={`${cardStyle}`}>
                  <div className="mb-6">
                    <h3 className="font-bold text-lg">Report Generation</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Export system-wide attendance data for administration.</p>
                  </div>
                  <div className="space-y-4 mb-6">
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Time Range</label>
                      <select className={inputStyle}>
                        <option>Daily</option><option>Weekly</option><option>Monthly</option><option>Semester</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Target Filter</label>
                      <select className={inputStyle}>
                        <option>All Classes</option><option>Specific Class</option><option>Specific Student</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-auto">
                    <button onClick={handleExportCSV} className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}>
                      <Download size={20} className={mutedText} /> CSV
                    </button>
                    <button onClick={handleExportExcel} className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}>
                      <Download size={20} className={mutedText} /> Excel
                    </button>
                    <button onClick={handleExportPDF} className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}>
                      <Download size={20} className={mutedText} /> PDF
                    </button>
                  </div>
                </div>
                <div className={`${cardStyle}`}>
                  <div className="mb-6">
                    <h3 className="font-bold text-lg">Database Management</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Configure thresholds and secure your SQL data.</p>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Late Threshold (Minutes)</label>
                      <input type="number" defaultValue="15" className={inputStyle} />
                      <p className={`text-[10px] ${mutedText} mt-1.5`}>Students arriving after this grace period are marked 'Late'.</p>
                    </div>
                    <div>
                      <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Automated SQL Backup</label>
                      <select className={inputStyle}>
                        <option>Daily (Midnight)</option>
                        <option>Weekly (Sunday)</option>
                        <option>Never</option>
                      </select>
                    </div>
                    <div className={`pt-6 border-t ${borderSubColor}`}>
                      <button className={`w-full py-3 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-800 hover:bg-gray-900 text-white'}`}>
                        <Database size={16} /> Force Manual Backup Now
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* ═══════════════════════════════════
                8. SYSTEM LOGS VIEW
                ═══════════════════════════════════ */}
            {activeView === 'logs' && (
              <div className={`${cardStyle} !p-0 overflow-hidden`}>
                <div className={`p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${borderColor}`}>
                  <div>
                    <h3 className="font-bold text-lg">System Event Logs</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Feeds of administrative changes and specific scanner check-ins.</p>
                  </div>
                  <button className={`text-xs px-4 py-2.5 rounded-lg font-semibold transition flex items-center gap-2 ${subBg} ${hoverBg}`}>
                    <Filter size={13} /> Filter Logs
                  </button>
                </div>
                <div className="overflow-x-auto p-6 pt-0 custom-scrollbar">
                  <table className="w-full text-sm text-left mt-4 whitespace-nowrap">
                    <thead className={`text-xs ${mutedText} uppercase tracking-wider ${subBg}`}>
                      <tr>
                        <th className="px-4 py-3 rounded-tl-lg font-semibold">Timestamp</th>
                        <th className="px-4 py-3 font-semibold">User</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 font-semibold rounded-tr-lg">Action Message / Changes</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y font-mono text-xs ${borderSubColor}`}>
                      <tr className={`${hoverBg} transition-colors`}>
                        <td className={`px-4 py-3 ${mutedText}`}>{new Date().toLocaleTimeString()}</td>
                        <td className="px-4 py-3 font-bold">System</td>
                        <td className="px-4 py-3"><span className="text-green-500 font-bold">SESSION</span></td>
                        <td className="px-4 py-3">Admin logged in successfully.</td>
                      </tr>
                      <tr className={`${hoverBg} transition-colors`}>
                        <td className={`px-4 py-3 ${mutedText}`}>11:15:30 AM</td>
                        <td className="px-4 py-3 font-bold">Admin User</td>
                        <td className="px-4 py-3"><span className="text-blue-500 font-bold">ADMIN_CHANGE</span></td>
                        <td className="px-4 py-3">Dashboard stats fetched. <span className={brandColor}>{stats.totalStudents}</span> students loaded.</td>
                      </tr>
                      <tr className={`${hoverBg} transition-colors`}>
                        <td className={`px-4 py-3 ${mutedText}`}>10:45:12 AM</td>
                        <td className="px-4 py-3 font-bold">System</td>
                        <td className="px-4 py-3"><span className="text-yellow-500 font-bold">BACKUP</span></td>
                        <td className="px-4 py-3">Automated daily backup completed successfully.</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className={`text-xs ${mutedText} mt-6 text-center`}>Full log history will be available when the <code className={brandColor}>/api/logs</code> endpoint is configured.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      {/* ═══════════════════════════════════════
          OVERLAYS
          ═══════════════════════════════════════ */}
      {/* Profile Overlay */}
      <ProfileOverlay
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
        isDark={isDark}
        userData={profileData}
      />
      {/* Notification Expanded Overlay */}
      <NotificationOverlay
        isOpen={showNotificationsExpanded}
        onClose={() => { setShowNotificationsExpanded(false); setShowNotifications(false); }}
        isDark={isDark}
        isExpanded={true}
        onExpand={() => {}}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
      />
      {/* Edit User Modal */}
      <EditUserModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        isDark={isDark}
        user={editingUser}
        onSave={handleEditUserSave}
      />
      {/* Delete User Modal */}
      <DeleteUserModal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        isDark={isDark}
        user={deletingUser}
        onConfirm={() => deletingUser && handleDeleteUserConfirm(deletingUser.id)}
      />
      {/* Settings Overlay */}
      <SettingsOverlay
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        isDark={isDark}
        setIsDark={setIsDark}
        onLogout={onLogout}
      />
    </div>
  );
};
export default AdminDashboard;