import React, { useState, useEffect } from 'react';
import { 
  Fingerprint, Bell, LayoutDashboard, Database, BookOpen, 
  Cpu, FileText, Terminal, Settings, LogOut, 
  Users, CheckCircle, XCircle, BarChart3, Sun, Moon,
  CalendarDays, Search, Pencil, Trash2, KeyRound, PieChart as PieChartIcon, MoreHorizontal,
  Copy, Maximize, Clock, Filter, Plus, MoreVertical, Download, UserPlus, Save, X
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AdminDashboard = ({ onLogout }) => {
  // --- UI STATES ---
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('adminActiveView') || 'dashboard';
  });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

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

  // --- CACHE & OPTIMISTIC RENDERING ---
  const dataCache = React.useRef({
    users: null,
    classes: null,
    schedules: {},
    attendance: {}
  });

  // --- MOCK DATA (no database) ---
  const stats = {
    totalStudents: '1430',
    activeClasses: '32',
    presentToday: '1144',
    absentToday: '286'
  };
  const isLoading = false;
  const [isUsersLoading, setIsUsersLoading] = useState(false);

  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ fullname: '', username: '', email: '', password: '', roleid: 3 });

  const fetchUsers = async () => {
    if (dataCache.current.users) {
      setUsers(dataCache.current.users);
    } else {
      setIsUsersLoading(true);
    }
    try {
      const res = await fetch('http://localhost:3000/api/users');
      const data = await res.json();
      const formatted = data.map(u => ({
        id: u.userid,
        username: u.username,
        name: u.fullname,
        role: u.roleid === 1 ? 'Admin' : u.roleid === 2 ? 'Teacher' : 'Student',
        email: u.email,
        createdat: u.createdat ? new Date(u.createdat).toLocaleDateString() : '-',
        lastlogin: u.lastlogin ? new Date(u.lastlogin).toLocaleString() : '-'
      }));
      setUsers(formatted);
      dataCache.current.users = formatted;
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
    setIsUsersLoading(false);
    setIsUsersLoading(false);
  };

  // Entity Database State
  const [entities, setEntities] = useState([]);
  const [isEntitiesLoading, setIsEntitiesLoading] = useState(false);
  const [showEntityModal, setShowEntityModal] = useState(false);
  const [entitySearchQuery, setEntitySearchQuery] = useState('');
  const [editingEntity, setEditingEntity] = useState(null);
  const [newEntity, setNewEntity] = useState({
    fullname: '', username: '', email: '', password: '', roleid: 3, gender: 'Male', dateofbirth: '', phonenumber: ''
  });

  const fetchEntities = async () => {
    setIsEntitiesLoading(true);
    try {
      const res = await fetch('http://localhost:3000/api/entities');
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
      }
    } catch (e) {
      console.error(e);
    }
    setIsEntitiesLoading(false);
  };

  useEffect(() => {
    if (activeView === 'database') fetchUsers();
    else if (activeView === 'attendance') fetchClasses();
    else if (activeView === 'entities') fetchEntities();
  }, [activeView]);

  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    
    // OPTIMISTIC RENDERING: Instantly update the UI before the network request
    const tempId = Date.now();
    const optimisticUser = {
      id: tempId,
      username: newUser.username || newUser.fullname.toLowerCase().replace(' ', ''),
      name: newUser.fullname,
      role: newUser.roleid === 1 ? 'Admin' : newUser.roleid === 2 ? 'Teacher' : 'Student',
      email: newUser.email,
      createdat: new Date().toLocaleDateString(),
      lastlogin: '-'
    };
    
    setUsers(prev => [optimisticUser, ...prev]);
    // Mock implementation for demo...
    setUsers([optimisticUser, ...users]);
    setShowAddUser(false);
    setNewUser({ fullname: '', username: '', email: '', password: '', roleid: 3 });
  };

  const handleSaveEntity = async (e) => {
    e.preventDefault();
    try {
      const url = editingEntity ? `http://localhost:3000/api/entities/${editingEntity.eid}` : 'http://localhost:3000/api/entities';
      const method = editingEntity ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntity)
      });
      if (res.ok) {
        await fetchEntities();
        setShowEntityModal(false);
        setEditingEntity(null);
        setNewEntity({ fullname: '', username: '', email: '', password: '', roleid: 3, gender: 'Male', dateofbirth: '', phonenumber: '' });
      } else {
        const err = await res.json();
        alert('Failed: ' + err.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error saving entity');
    }
  };

  const handleDeleteEntity = async (eid) => {
    if (!confirm('Are you sure you want to delete this entity?')) return;
    try {
      const res = await fetch(`http://localhost:3000/api/entities/${eid}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchEntities();
      } else {
        alert('Failed to delete entity');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting entity');
    }
  };

  const handleUserSubmission = async (userToSubmit) => {
    try {
      const res = await fetch('http://localhost:3000/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userToSubmit)
      });
      if (!res.ok) {
        // Rollback on failure
        setUsers(prev => prev.filter(u => u.id !== tempId));
        const errorData = await res.json();
        alert(errorData.error || 'Failed to create user');
        return;
      }
      
      // Revalidate cache in background
      const res2 = await fetch('http://localhost:3000/api/users');
      const data = await res2.json();
      const formatted = data.map(u => ({
        id: u.userid,
        username: u.username,
        name: u.fullname,
        role: u.roleid === 1 ? 'Admin' : u.roleid === 2 ? 'Teacher' : 'Student',
        email: u.email,
        createdat: u.createdat ? new Date(u.createdat).toLocaleDateString() : '-',
        lastlogin: u.lastlogin ? new Date(u.lastlogin).toLocaleString() : '-'
      }));
      setUsers(formatted);
      dataCache.current.users = formatted;
    } catch (error) {
      // Rollback on failure
      setUsers(prev => prev.filter(u => u.id !== tempId));
      console.error('Add user error', error);
      alert('Error creating user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (user.student_id && user.student_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          user.id.toString().includes(searchQuery);
    const matchesRole = roleFilter === 'All' || user.role.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  const handleDeleteUser = (userId, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${userName}?`)) return;
    setUsers(users.filter(user => user.id !== userId));
  };

  const handleEditUser = (userId, currentName, currentRole) => {
    const newName = window.prompt("Enter new name for this user:", currentName);
    if (!newName || newName === currentName) return;
    setUsers(users.map(user => user.id === userId ? { ...user, name: newName } : user));
  };

  // --- CLASS & ATTENDANCE DATA ---
  const [classes, setClasses] = useState([]);
  const [isClassesLoading, setIsClassesLoading] = useState(false);
  
  const [selectedClass, setSelectedClass] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(false);
  
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  
  // Edit & Enroll State
  const [isEditingAttendance, setIsEditingAttendance] = useState(false);
  const [editedAttendance, setEditedAttendance] = useState({});
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [unenrolledStudents, setUnenrolledStudents] = useState([]);
  const [enrollSearchQuery, setEnrollSearchQuery] = useState('');
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  const fetchClasses = async () => {
    if (dataCache.current.classes) {
      setClasses(dataCache.current.classes);
    } else {
      setIsClassesLoading(true);
    }
    try {
      const res = await fetch('http://localhost:3000/api/classes');
      const data = await res.json();
      setClasses(data);
      dataCache.current.classes = data;
    } catch (error) {
      console.error('Failed to fetch classes', error);
    }
    setIsClassesLoading(false);
  };

  useEffect(() => {
    if (activeView === 'classes') {
      fetchClasses();
    }
  }, [activeView]);

  const handleClassClick = async (cls) => {
    setSelectedClass(cls);
    if (dataCache.current.schedules[cls.classid]) {
      setSchedules(dataCache.current.schedules[cls.classid]);
    } else {
      setIsSchedulesLoading(true);
    }
    try {
      const res = await fetch(`http://localhost:3000/api/classes/${cls.classid}/schedules`);
      const data = await res.json();
      setSchedules(data);
      dataCache.current.schedules[cls.classid] = data;
    } catch (error) {
      console.error('Failed to fetch schedules', error);
    }
    setIsSchedulesLoading(false);
  };

  const handleScheduleClick = async (sched) => {
    setSelectedSchedule(sched);
    if (dataCache.current.attendance[sched.scheduleid]) {
      setAttendanceData(dataCache.current.attendance[sched.scheduleid]);
    } else {
      setIsAttendanceLoading(true);
    }
    try {
      const res = await fetch(`http://localhost:3000/api/schedules/${sched.scheduleid}/attendance`);
      const data = await res.json();
      setAttendanceData(data);
      dataCache.current.attendance[sched.scheduleid] = data;
    } catch (error) {
      console.error('Failed to fetch attendance', error);
    }
    setIsAttendanceLoading(false);
  };

  const goBackToClasses = () => {
    setSelectedClass(null);
    setSchedules([]);
  };

  const goBackToSchedules = () => {
    setSelectedSchedule(null);
    setAttendanceData(null);
    setIsEditingAttendance(false);
    setEditedAttendance({});
  };

  const exportToCSV = () => {
    if (!attendanceData) return;

    // Headers
    const headers = ['Student Name', ...attendanceData.sessions.map(s => new Date(s.sessiondate).toLocaleDateString('en-US', { month: 'short', day: 'numeric'}))];
    
    // Rows
    const rows = attendanceData.students.map(student => {
      const row = [student.fullname];
      attendanceData.sessions.forEach(session => {
        const record = attendanceData.attendance.find(a => a.studentid === student.studentid && a.sessionid === session.sessionid);
        row.push(record ? record.status.charAt(0) : '-');
      });
      return row;
    });

    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.map(item => `"${item}"`).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${selectedClass.classname}_${selectedSchedule.subject}_Attendance.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleEditAttendanceToggle = () => {
    if (isEditingAttendance) {
      setIsEditingAttendance(false);
      setEditedAttendance({});
    } else {
      setIsEditingAttendance(true);
      setEditedAttendance({});
    }
  };

  const cycleAttendanceStatus = (studentId, sessionId, currentStatus) => {
    // Deprecated, handled inline now
  };

  const saveAttendanceChanges = async () => {
    const updates = Object.values(editedAttendance);
    if (updates.length === 0) {
      setIsEditingAttendance(false);
      return;
    }
    
    setIsSavingAttendance(true);
    try {
      const res = await fetch('/api/attendance/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      if (res.ok) {
        const newData = { ...attendanceData };
        newData.attendance = [...newData.attendance];
        
        updates.forEach(update => {
          const idx = newData.attendance.findIndex(a => a.studentid === update.studentid && a.sessionid === update.sessionid);
          if (idx !== -1) {
            newData.attendance[idx] = { ...newData.attendance[idx], status: update.status };
          } else {
            newData.attendance.push({ studentid: update.studentid, sessionid: update.sessionid, status: update.status, minutelate: 0 });
          }
        });
        
        setAttendanceData(newData);
        if (dataCache.current.attendance[selectedSchedule.scheduleid]) {
           dataCache.current.attendance[selectedSchedule.scheduleid] = newData;
        }
        
        setIsEditingAttendance(false);
        setEditedAttendance({});
      } else {
        alert('Failed to save attendance');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to save attendance');
    }
    setIsSavingAttendance(false);
  };

  const openAddStudentModal = async () => {
    try {
      const res = await fetch(`/api/classes/${selectedClass.classid}/unenrolled-students`);
      const data = await res.json();
      setUnenrolledStudents(data);
      setShowAddStudentModal(true);
    } catch (e) {
      console.error(e);
      alert('Failed to fetch students');
    }
  };

  const enrollStudent = async (studentIdToEnroll) => {
    if (!studentIdToEnroll || studentIdToEnroll.trim() === '') return;
    
    try {
      const res = await fetch(`/api/classes/${selectedClass.classid}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentid: studentIdToEnroll })
      });
      
      const responseData = await res.json();
      
      if (res.ok) {
        // Use student data returned from server
        const student = responseData.student;
        const newData = { ...attendanceData };
        newData.students = [...newData.students, { studentid: student.studentid, fullname: student.fullname, profilepicture: student.profilepicture }];
        newData.students.sort((a,b) => a.fullname.localeCompare(b.fullname));
        setAttendanceData(newData);
        
        if (dataCache.current.attendance[selectedSchedule.scheduleid]) {
           dataCache.current.attendance[selectedSchedule.scheduleid] = newData;
        }
        
        setShowAddStudentModal(false);
        setEnrollSearchQuery(''); // reset
      } else {
        alert('Failed to enroll student: ' + (responseData.error || 'Unknown error'));
      }
    } catch (e) {
      console.error(e);
      alert('Failed to enroll student. Ensure backend is running.');
    }
  };


  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' 
  }).toUpperCase();

  // --- DYNAMIC THEME CLASSES ---
  const appBg = isDark ? "bg-black" : "bg-[#f4f6f8]";
  const surfaceBg = isDark ? "bg-black" : "bg-white";
  const borderColor = isDark ? "border-white/10" : "border-[#f1f5f9]";
  const borderSubColor = isDark ? "border-white/5 divide-white/5" : "border-gray-200 divide-gray-200";
  const textColor = isDark ? "text-white" : "text-gray-800";
  const mutedText = isDark ? "text-gray-400" : "text-slate-500";
  const subBg = isDark ? "bg-white/5" : "bg-gray-50";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";
  
  const navActiveBg = isDark ? "bg-white/10 text-cyan-400" : "bg-indigo-50 text-indigo-600";
  const navInactiveBg = isDark ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-gray-50 hover:text-indigo-600";
  const brandColor = isDark ? "text-cyan-400" : "text-indigo-600";
  const buttonHoverText = isDark ? 'hover:text-cyan-400' : 'hover:text-indigo-600';
  
  const cardStyle = `${surfaceBg} rounded-3xl p-8 flex flex-col ${isDark ? 'shadow-[0_0_15px_rgba(255,255,255,0.02)] border border-white/5' : 'shadow-sm'}`;
  const inputStyle = `w-full p-2.5 text-sm border rounded-lg focus:outline-none transition-colors ${isDark ? 'bg-[#111] border-white/20 text-white focus:border-cyan-400 [&>option]:bg-black [&>option]:text-white' : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-indigo-500 [&>option]:bg-white [&>option]:text-gray-800'}`;

  // --- SKELETON LOADERS ---
  const SkeletonRow = ({ cols = 6 }) => (
    <tr className="animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-4"><div className={`h-10 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded w-full`}></div></td>
      ))}
    </tr>
  );

  const SkeletonCard = () => (
    <div className={`border rounded-xl p-5 ${borderSubColor} ${subBg} animate-pulse`}>
      <div className="flex justify-between items-start mb-2">
        <div className="space-y-2 w-1/2">
          <div className={`h-5 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded w-3/4`}></div>
          <div className={`h-3 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded w-1/2`}></div>
        </div>
        <div className={`h-6 w-20 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded-full`}></div>
      </div>
      <div className={`mt-4 pt-4 border-t ${borderSubColor} flex items-center justify-between`}>
        <div className="flex items-center gap-2 w-1/2">
          <div className={`w-6 h-6 rounded-full ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
          <div className={`h-3 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded w-2/3`}></div>
        </div>
        <div className={`h-4 w-16 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded`}></div>
      </div>
    </div>
  );

  const getRoleBadgeColor = (role) => {
    const roleCheck = String(role).toLowerCase(); 
    if (roleCheck === 'admin' || roleCheck === '1') {
      return isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-700';
    } 
    if (roleCheck === 'teacher' || roleCheck === '2') {
      return isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-100 text-green-700';
    } 
    return isDark ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-100 text-cyan-700';
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
    settings: 'System Settings',
    attendance: 'Attendance Tracking'
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
              <button onClick={() => setActiveView('database')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'database' ? navActiveBg : navInactiveBg}`}>
                <Database className={`w-5 h-5 mr-3 ${activeView === 'database' ? '' : 'opacity-70'}`} /> User Database
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('entities')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'entities' ? navActiveBg : navInactiveBg}`}>
                <Users className={`w-5 h-5 mr-3 ${activeView === 'entities' ? '' : 'opacity-70'}`} /> Entity Database
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('attendance')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'attendance' ? navActiveBg : navInactiveBg}`}>
                <CheckCircle className={`w-5 h-5 mr-3 ${activeView === 'attendance' ? '' : 'opacity-70'}`} /> Attendance
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('biometric')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'biometric' ? navActiveBg : navInactiveBg}`}>
                <Fingerprint className={`w-5 h-5 mr-3 ${activeView === 'biometric' ? '' : 'opacity-70'}`} /> Biometric Enrollment
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('timetable')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'timetable' ? navActiveBg : navInactiveBg}`}>
                <CalendarDays className={`w-5 h-5 mr-3 ${activeView === 'timetable' ? '' : 'opacity-70'}`} /> Time Table
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('classes')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'classes' ? navActiveBg : navInactiveBg}`}>
                <BookOpen className={`w-5 h-5 mr-3 ${activeView === 'classes' ? '' : 'opacity-70'}`} /> Class Management
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('hardware')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'hardware' ? navActiveBg : navInactiveBg}`}>
                <Cpu className={`w-5 h-5 mr-3 ${activeView === 'hardware' ? '' : 'opacity-70'}`} /> Hardware Scanners
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('reports')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'reports' ? navActiveBg : navInactiveBg}`}>
                <FileText className={`w-5 h-5 mr-3 ${activeView === 'reports' ? '' : 'opacity-70'}`} /> Reports & Backup
              </button>
            </li>
            <li>
              <button onClick={() => setActiveView('logs')} className={`w-full flex items-center px-4 py-2.5 rounded-lg font-semibold transition-colors ${activeView === 'logs' ? navActiveBg : navInactiveBg}`}>
                <Terminal className={`w-5 h-5 mr-3 ${activeView === 'logs' ? '' : 'opacity-70'}`} /> System Logs
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
              <img src="https://ui-avatars.com/api/?name=System+Admin&background=6366f1&color=fff" alt="Admin" className={`h-9 w-9 rounded-full shadow-sm border ${borderColor}`} />
              <div className="hidden md:block text-sm">
                <p className="font-bold leading-none">System Admin</p>
                <p className={`text-xs ${brandColor} mt-1 font-semibold uppercase tracking-wider`}>ADMIN</p>
              </div>
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto p-6 ${appBg} transition-colors duration-500`}>
          <div className="w-full h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {activeView === 'dashboard' && (
              <div className="space-y-6 w-full">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-6">
                      <p className={`text-[10px] text-gray-500 font-bold uppercase tracking-widest`}>Total Students</p>
                      <Users className={`w-4 h-4 text-gray-400`} />
                    </div>
                    <p className="text-4xl font-extrabold text-gray-900">{stats.totalStudents}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-6">
                      <p className={`text-[10px] text-gray-500 font-bold uppercase tracking-widest`}>Active Classes</p>
                      <BookOpen className={`w-4 h-4 text-gray-400`} />
                    </div>
                    <p className="text-4xl font-extrabold text-gray-900">{stats.activeClasses}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-6">
                      <p className={`text-[10px] text-gray-500 font-bold uppercase tracking-widest`}>Enrollment</p>
                    </div>
                    <p className="text-4xl font-extrabold text-[#22c55e]">{stats.presentToday}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-6">
                      <p className={`text-[10px] text-gray-500 font-bold uppercase tracking-widest`}>Pending Enrollment</p>
                    </div>
                    <p className="text-4xl font-extrabold text-[#ef4444]">{stats.absentToday}</p>
                  </div>
                </div>

                <div className={`${cardStyle} mb-8`}>
                  <div className="flex justify-between items-center mb-8">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">24-Week Attendance History</h3>
                      <p className={`text-xs text-gray-500 mt-1`}>Overall attendance averages across all classes for the last 24 weeks.</p>
                    </div>
                  </div>
                  <div className="h-[240px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                          { name: '1', val: 500 }, { name: '2', val: 7800 }, { name: '3', val: 1800 }, { name: '4', val: 4500 }, { name: '5', val: 300 }, { name: '6', val: 4600 }, { name: '7', val: 1300 }, { name: '8', val: 4500 }, { name: '9', val: 3700 }, { name: '10', val: 100 }, { name: '11', val: 2600 }, { name: '12', val: 7100 }, { name: '13', val: 2100 }, { name: '14', val: 100 }, { name: '15', val: 3800 }, { name: '16', val: 1300 }, { name: '17', val: 4800 }, { name: '18', val: 6700 }, { name: '19', val: 1400 }, { name: '20', val: 1000 }, { name: '21', val: 6600 }, { name: '22', val: 7900 }, { name: '23', val: 2100 }, { name: '24', val: 5200 }
                      ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#e5e7eb" />
                        <XAxis dataKey="name" tick={{fontSize: 10, fill: '#6b7280'}} tickLine={true} axisLine={{stroke: '#e5e7eb'}} tickMargin={8} />
                        <YAxis tick={{fontSize: 10, fill: '#6b7280'}} tickLine={false} axisLine={false} ticks={[0, 2000, 4000, 6000, 8000]} domain={[0, 8000]} />
                        <Line type="linear" dataKey="val" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'white', stroke: '#8b5cf6' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-[10px] text-gray-500 uppercase tracking-widest">Daily Chart</h3>
                    </div>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                            { name: '0', val: 0 }, { name: '1', val: 7 }, { name: '2', val: 1 }, { name: '3', val: 8 }, { name: '4', val: 7.5 }, { name: '5', val: 1.5 }, { name: '6', val: 2.2 }, { name: '7', val: 1 }, { name: '8', val: 5.5 }, { name: '9', val: 6.2 }
                        ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{fontSize: 9, fill: '#6b7280'}} tickMargin={5} axisLine={{stroke: '#e5e7eb'}} />
                          <YAxis tick={{fontSize: 9, fill: '#6b7280'}} ticks={[0, 2, 4, 6, 8]} domain={[0, 8]} axisLine={false} tickLine={false} />
                          <Line type="linear" dataKey="val" stroke="#8b5cf6" strokeWidth={1.5} dot={{ r: 2.5, fill: '#8b5cf6' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-[10px] text-gray-500 uppercase tracking-widest">Weekly Trend</h3>
                    </div>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                            { name: '0', val: 5.5 }, { name: '1', val: 7.5 }, { name: '2', val: 8 }, { name: '3', val: 7.8 }, { name: '4', val: 3.2 }, { name: '5', val: 2.5 }, { name: '6', val: 9.5 }, { name: '7', val: 4.5 }, { name: '8', val: 10 }, { name: '9', val: 4.5 }
                        ]} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="name" tick={{fontSize: 9, fill: '#6b7280'}} tickMargin={5} axisLine={{stroke: '#e5e7eb'}} />
                          <YAxis tick={{fontSize: 9, fill: '#6b7280'}} ticks={[0, 3, 6, 9, 12]} domain={[0, 12]} axisLine={false} tickLine={false} />
                          <Line type="linear" dataKey="val" stroke="#86efac" strokeWidth={1.5} dot={{ r: 2.5, fill: '#86efac' }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`${cardStyle}`}>
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-[10px] text-gray-500 uppercase tracking-widest">Today's Ratio</h3>
                    </div>
                    <div className="h-[160px] w-full flex items-center justify-center relative">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[{ name: 'Present', value: 95 }, { name: 'Absent', value: 5 }]}
                            cx="50%"
                            cy="50%"
                            innerRadius={65}
                            outerRadius={90}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                          >
                            <Cell fill="#8b5cf6" />
                            <Cell fill="#e5e7eb" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex items-center justify-center flex-col pt-8">
                        <span className="text-3xl font-extrabold text-gray-900">95%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* --- NEW ATTENDANCE VIEW PLACEHOLDER --- */}
            {activeView === 'attendance' && (
              <div className={`${cardStyle} items-center justify-center min-h-[400px]`}>
                <CheckCircle className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-bold text-gray-700">Attendance Tracking</h2>
                <p className="text-gray-500 mt-2 text-center max-w-md">The attendance management interface will be displayed here.</p>
              </div>
            )}

            {activeView === 'entities' && (
              <div className={`${cardStyle} !p-0`}>
                <div className={`p-6 pb-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${borderColor}`}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[22px]">Entity Database</h3>
                    <span className={`text-[13px] font-semibold ${mutedText}`}>({entities.length} total)</span>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                      <input 
                        type="text" 
                        placeholder="Search entities..." 
                        value={entitySearchQuery}
                        onChange={(e) => setEntitySearchQuery(e.target.value)}
                        className={`pl-10 pr-4 py-2 text-[13px] font-semibold border-2 rounded-full focus:outline-none transition-colors w-full sm:w-64 ${isDark ? 'bg-black border-white/10 text-white focus:border-cyan-400' : 'bg-white border-gray-100 text-gray-800 focus:border-indigo-500'}`} 
                      />
                    </div>
                    <button onClick={() => { setEditingEntity(null); setNewEntity({ fullname: '', username: '', email: '', password: '', roleid: 3, gender: 'Male', dateofbirth: '', phonenumber: '' }); setShowEntityModal(true); }} className="px-4 py-2 rounded-full bg-indigo-500 text-white hover:bg-indigo-600 transition-colors shadow-sm font-bold text-sm inline-flex items-center gap-2">
                      <Plus size={16} /> Add Entity
                    </button>
                  </div>
                </div>
                <div className="custom-scrollbar pb-6 px-6 overflow-x-auto">
                  <table className="w-full text-[13px] text-left whitespace-nowrap">
                    <thead className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider border-b-2 ${borderSubColor}`}>
                      <tr>
                        <th className="px-4 py-4">Entity ID</th>
                        <th className="px-4 py-4">User ID</th>
                        <th className="px-4 py-4">Role ID</th>
                        <th className="px-4 py-4">Username</th>
                        <th className="px-4 py-4">Name</th>
                        <th className="px-4 py-4">Role</th>
                        <th className="px-4 py-4">Gender</th>
                        <th className="px-4 py-4">DOB</th>
                        <th className="px-4 py-4">Phone</th>
                        <th className="px-4 py-4">Email</th>
                        <th className="px-4 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y border-b ${borderSubColor}`}>
                      {isEntitiesLoading ? (
                        <tr><td colSpan="10" className="text-center py-4">Loading entities...</td></tr>
                      ) : (
                        entities.filter(e => {
                          const parts = entitySearchQuery.split(' ');
                          const filters = {};
                          let text = '';
                          parts.forEach(part => {
                            if (part.includes('=')) {
                              const [k, v] = part.split('=');
                              if (k && v) filters[k.toLowerCase()] = v.toLowerCase();
                            } else {
                              text += part + ' ';
                            }
                          });
                          text = text.trim().toLowerCase();

                          if (filters.eid && !String(e.eid).toLowerCase().includes(filters.eid)) return false;
                          if (filters.uid && !String(e.userid || '').toLowerCase().includes(filters.uid)) return false;
                          if (filters.role) {
                            const r = filters.role;
                            const isTShortcut = r === 't' || r === 'teacher' || r === 'lecturer';
                            const isSShortcut = r === 's' || r === 'student';
                            const isAShortcut = r === 'a' || r === 'admin';
                            
                            const isT = e.roleid === 2 || (e.rolename || '').toLowerCase().includes('teacher') || (e.rolename || '').toLowerCase().includes('lecturer');
                            const isS = e.roleid === 3 || (e.rolename || '').toLowerCase().includes('student');
                            const isA = e.roleid === 1 || (e.rolename || '').toLowerCase().includes('admin');

                            if (isTShortcut) {
                              if (!isT) return false;
                            } else if (isSShortcut) {
                              if (!isS) return false;
                            } else if (isAShortcut) {
                              if (!isA) return false;
                            } else {
                              if (!(e.rolename || '').toLowerCase().includes(r)) return false;
                            }
                          }
                          if (filters.gender && !(e.gender || '').toLowerCase().includes(filters.gender)) return false;
                          if (filters.phone && !(e.phonenumber || '').toLowerCase().includes(filters.phone)) return false;
                          if (filters.dob && !(e.dateofbirth || '').toLowerCase().includes(filters.dob)) return false;
                          if ((filters.uname || filters.username) && !(e.username || '').toLowerCase().includes(filters.uname || filters.username)) return false;
                          if (filters.email && !(e.email || '').toLowerCase().includes(filters.email)) return false;
                          
                          const roleSpecId = e.roleid === 1 || e.rolename?.toLowerCase() === 'admin' ? 'A' : e.roleid === 2 || e.rolename?.toLowerCase() === 'teacher' ? (e.lecturerid ? `T${String(e.lecturerid).padStart(4, '0')}` : 'T-') : (e.studentid ? `S${String(e.studentid).padStart(4, '0')}` : 'S-');
                          if (filters.id && !roleSpecId.toLowerCase().includes(filters.id)) return false;
                          
                          const accVal = filters.account !== undefined ? filters.account : filters.acc;
                          if (accVal !== undefined) {
                            const hasAccount = !!e.userid;
                            const wantsAccount = accVal === 'true' || accVal === '1' || accVal === 'yes';
                            if (hasAccount !== wantsAccount) return false;
                          }
                          
                          if (text) {
                            if (!(e.fullname || '').toLowerCase().includes(text) &&
                                !(e.username || '').toLowerCase().includes(text) &&
                                !(e.email || '').toLowerCase().includes(text)) {
                              return false;
                            }
                          }
                          return true;
                        }).map(e => (
                          <tr key={e.eid} className={`${hoverBg} transition-colors group`}>
                            <td className="px-4 py-3 font-mono text-xs">{e.eid}</td>
                            <td className="px-4 py-3 font-mono text-xs">{e.userid || '-'}</td>
                            <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400">{e.roleid === 1 || e.rolename?.toLowerCase() === 'admin' ? 'A' : e.roleid === 2 || e.rolename?.toLowerCase() === 'teacher' ? (e.lecturerid ? `T${String(e.lecturerid).padStart(4, '0')}` : 'T-') : (e.studentid ? `S${String(e.studentid).padStart(4, '0')}` : 'S-')}</td>
                            <td className="px-4 py-3 font-bold">{e.username || '-'}</td>
                            <td className="px-4 py-3">{e.fullname}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold ${e.roleid === 1 ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') : e.roleid === 2 ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700') : (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700')}`}>
                                {e.rolename}
                              </span>
                            </td>
                            <td className="px-4 py-3">{e.gender}</td>
                            <td className="px-4 py-3">{e.dateofbirth ? new Date(e.dateofbirth).toLocaleDateString() : '-'}</td>
                            <td className="px-4 py-3">{e.phonenumber || '-'}</td>
                            <td className="px-4 py-3">{e.email || '-'}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="relative inline-block text-left">
                                <button onClick={() => setOpenMenuId(openMenuId === `entity-${e.eid}` ? null : `entity-${e.eid}`)} className={`p-1 rounded-md transition ${mutedText} hover:text-black dark:hover:text-white`}>
                                  <MoreVertical size={16} />
                                </button>
                                {openMenuId === `entity-${e.eid}` && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                                    <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl z-50 py-1 border ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-100'}`}>
                                      <div className="flex flex-col">
                                        <button onClick={() => { 
                                          setEditingEntity(e);
                                          setNewEntity({
                                            fullname: e.fullname || '', username: e.username || '', email: e.email || '', password: '', roleid: e.roleid || 3, gender: e.gender || 'Male', dateofbirth: e.dateofbirth ? new Date(e.dateofbirth).toISOString().split('T')[0] : '', phonenumber: e.phonenumber || ''
                                          });
                                          setShowEntityModal(true);
                                          setOpenMenuId(null); 
                                        }} className={`w-full px-5 py-2.5 text-[13px] font-bold flex items-center justify-between transition-colors ${isDark ? 'text-gray-100 hover:bg-white/5' : 'text-gray-900 hover:bg-gray-50'}`}>
                                          Edit Entity <Pencil size={15} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                        </button>
                                        <div className={`h-[1px] my-1 ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}></div>
                                        <button onClick={() => { handleDeleteEntity(e.eid); setOpenMenuId(null); }} className={`w-full px-5 py-2.5 text-[13px] font-bold text-red-500 flex items-center justify-between transition-colors ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                                          Delete Entity <Trash2 size={15} className="text-red-500" />
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeView === 'database' && (
              <div className={`${cardStyle} !p-0`}>
                <div className={`p-6 pb-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${borderColor}`}>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-[22px]">Directory</h3>
                    <span className={`text-[13px] font-semibold ${mutedText}`}>({users.length} total)</span>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                      <input 
                        type="text" 
                        placeholder="Search user..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`pl-10 pr-4 py-2 text-[13px] font-semibold border-2 rounded-full focus:outline-none transition-colors w-full sm:w-64 ${isDark ? 'bg-black border-white/10 text-white focus:border-cyan-400' : 'bg-white border-gray-100 text-gray-800 focus:border-indigo-500'}`} 
                      />
                    </div>
                    <button className={`p-2 rounded-full border-2 transition-colors ${isDark ? 'border-white/10 text-white hover:bg-white/10' : 'border-gray-100 text-gray-700 hover:bg-gray-50'}`}>
                      <Filter size={18} />
                    </button>
                    <button onClick={() => setShowAddUser(true)} className="p-2 rounded-full bg-black text-white hover:bg-gray-800 transition-colors shadow-sm dark:bg-white dark:text-black dark:hover:bg-gray-200">
                      <Plus size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="custom-scrollbar pb-6 px-6">
                  <table className="w-full text-[13px] text-left whitespace-nowrap">
                    <thead className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider border-b-2 ${borderSubColor}`}>
                      <tr>
                        <th className="px-6 py-4">Username</th>
                        <th className="px-6 py-4">Full Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Last Active</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y border-b ${borderSubColor}`}>
                      {isUsersLoading ? (
                        <>
                          <SkeletonRow cols={6} />
                          <SkeletonRow cols={6} />
                          <SkeletonRow cols={6} />
                        </>
                      ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan="6" className={`text-center py-8 font-bold ${mutedText}`}>No users found matching filters.</td></tr>
                      ) : (
                      filteredUsers.map((user, index) => (
                          <tr key={user.id} className={`${hoverBg} transition-colors group`}>
                            <td className="px-6 py-4 font-bold">{user.username || user.name.toLowerCase().replace(' ', '')}</td>
                            <td className="px-6 py-4 font-bold">{user.name}</td>
                            <td className="px-6 py-4 font-bold">{user.email || '—'}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide capitalize ${getRoleBadgeColor(user.role).replace('uppercase', 'capitalize')}`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-bold">{user.lastlogin}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="relative inline-block text-left">
                                <button onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)} className={`p-1 rounded-md transition ${mutedText} hover:text-black dark:hover:text-white`}>
                                  <MoreVertical size={16} />
                                </button>
                                {openMenuId === user.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)}></div>
                                    <div className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl z-50 py-1 border ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-100'}`}>
                                      <div className="flex flex-col">
                                        <button onClick={() => { handleEditUser(user.id, user.name, user.role); setOpenMenuId(null); }} className={`w-full px-5 py-2.5 text-[13px] font-bold flex items-center justify-between transition-colors ${isDark ? 'text-gray-100 hover:bg-white/5' : 'text-gray-900 hover:bg-gray-50'}`}>
                                          Edit User <Pencil size={15} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                        </button>
                                        <button onClick={() => { setOpenMenuId(null); }} className={`w-full px-5 py-2.5 text-[13px] font-bold flex items-center justify-between transition-colors ${isDark ? 'text-gray-100 hover:bg-white/5' : 'text-gray-900 hover:bg-gray-50'}`}>
                                          Modify Role <Users size={15} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                        </button>
                                        <button onClick={() => { setOpenMenuId(null); }} className={`w-full px-5 py-2.5 text-[13px] font-bold flex items-center justify-between transition-colors ${isDark ? 'text-gray-100 hover:bg-white/5' : 'text-gray-900 hover:bg-gray-50'}`}>
                                          Reset Password <KeyRound size={15} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                        </button>
                                        <div className={`h-[1px] my-1 ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}></div>
                                        <button onClick={() => { handleDeleteUser(user.id, user.name); setOpenMenuId(null); }} className={`w-full px-5 py-2.5 text-[13px] font-bold text-red-500 flex items-center justify-between transition-colors ${isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-50'}`}>
                                          Delete User <Trash2 size={15} className="text-red-500" />
                                        </button>
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {showAddUser && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`${surfaceBg} rounded-3xl p-8 w-full max-w-md shadow-2xl border ${borderColor}`}>
                      <h3 className={`text-xl font-bold mb-6 ${textColor}`}>Add New User</h3>
                      <form onSubmit={handleAddUserSubmit} className="space-y-4">
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${mutedText}`}>Full Name</label>
                          <input type="text" value={newUser.fullname} onChange={e => setNewUser({...newUser, fullname: e.target.value})} className={inputStyle} required />
                        </div>
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${mutedText}`}>Username</label>
                          <input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className={inputStyle} required />
                        </div>
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${mutedText}`}>Email</label>
                          <input type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className={inputStyle} required />
                        </div>
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${mutedText}`}>Password</label>
                          <input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className={inputStyle} required />
                        </div>
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${mutedText}`}>Role</label>
                          <select value={newUser.roleid} onChange={e => setNewUser({...newUser, roleid: Number(e.target.value)})} className={inputStyle}>
                            <option value={1}>Admin</option>
                            <option value={2}>Teacher</option>
                            <option value={3}>Student</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                          <button type="button" onClick={() => setShowAddUser(false)} className={`px-5 py-2.5 rounded-xl font-semibold transition-colors ${subBg} ${textColor} hover:bg-gray-200 dark:hover:bg-gray-800`}>Cancel</button>
                          <button type="submit" className={`px-5 py-2.5 rounded-xl font-semibold text-white transition-colors ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Create User</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* --- 3. BIOMETRIC ENROLLMENT VIEW (Shows ONLY Students) --- */}
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
                        <input type="text" placeholder="Search ID or Name..." className={`${inputStyle} pl-10 h-full w-full sm:w-60 bg-transparent`} />
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
                        <>
                          <SkeletonRow cols={5} />
                          <SkeletonRow cols={5} />
                          <SkeletonRow cols={5} />
                        </>
                      ) : users.length === 0 ? (
                        <tr><td colSpan="6" className={`text-center py-8 font-bold ${mutedText}`}>No students found.</td></tr>
                      ) : (
                      users.map((user) => {
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

            {activeView === 'timetable' && (
              <div className={`${cardStyle}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Schedule / Timetable Management</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Define active learning periods and subject schedules.</p>
                  </div>
                  <button className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                    <CalendarDays size={14} className="mr-1 inline" /> Add Schedule
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className={`w-full text-sm border-collapse`}>
                    <thead><tr className={`${subBg}`}>
                      <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText} uppercase tracking-wider border ${borderSubColor}`}>Time</th>
                      {['Monday','Tuesday','Wednesday','Thursday','Friday'].map(d => (
                        <th key={d} className={`px-4 py-3 text-left text-xs font-bold ${mutedText} uppercase tracking-wider border ${borderSubColor}`}>{d}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {[
                        {time:'8:00 - 9:30', slots:['CS-101','MAT-101','CS-201','—','CS-301']},
                        {time:'9:45 - 11:15', slots:['ENG-101','CS-101','—','MAT-101','CS-201']},
                        {time:'1:00 - 2:30', slots:['—','CS-301','MAT-101','CS-101','—']},
                        {time:'2:45 - 4:15', slots:['CS-201','—','ENG-101','CS-301','MAT-101']},
                      ].map((row, i) => (
                        <tr key={i} className={`${hoverBg} transition-colors`}>
                          <td className={`px-4 py-3 font-bold text-xs border ${borderSubColor} ${mutedText}`}>{row.time}</td>
                          {row.slots.map((s, j) => (
                            <td key={j} className={`px-4 py-3 border ${borderSubColor} text-sm ${s === '—' ? mutedText : 'font-semibold'}`}>{s}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeView === 'classes' && (
              <div className={`${cardStyle}`}>
                {selectedSchedule ? (
                  <div>
                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <button onClick={goBackToSchedules} className={`px-4 py-2 rounded-lg font-bold text-xs text-white shadow-sm transition mb-4 inline-flex items-center gap-1 w-fit ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                          ← Back to Schedules
                        </button>
                        <h3 className="font-bold text-lg">Attendance Sheet</h3>
                        <p className={`text-xs ${mutedText} mt-1`}>{selectedClass.classname} - {selectedSchedule.subject} ({selectedSchedule.dayofweek})</p>
                      </div>
                      <div className="flex gap-3">
                        {!isEditingAttendance && (
                          <button 
                            onClick={openAddStudentModal}
                            className={`px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition inline-flex items-center gap-2 ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <UserPlus size={14} /> Add Student
                          </button>
                        )}
                        {!isEditingAttendance && (
                          <button 
                            onClick={exportToCSV}
                            disabled={!attendanceData || attendanceData.students.length === 0}
                            className={`px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition inline-flex items-center gap-2 ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                          >
                            <Download size={14} /> Export CSV
                          </button>
                        )}
                        
                        {isEditingAttendance ? (
                          <>
                            <button 
                              onClick={handleEditAttendanceToggle}
                              disabled={isSavingAttendance}
                              className={`px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition inline-flex items-center gap-2 ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                            >
                              <X size={14} /> Cancel
                            </button>
                            <button 
                              onClick={saveAttendanceChanges}
                              disabled={isSavingAttendance}
                              className={`px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition inline-flex items-center gap-2 text-white ${isDark ? 'bg-green-500 hover:bg-green-400 text-slate-900' : 'bg-green-500 hover:bg-green-600'}`}
                            >
                              <Save size={14} /> {isSavingAttendance ? 'Saving...' : 'Save Changes'}
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={handleEditAttendanceToggle}
                            className={`px-4 py-2 rounded-lg font-bold text-xs shadow-sm transition inline-flex items-center gap-2 text-white ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        )}
                      </div>
                    </div>
                    {isAttendanceLoading ? (
                        <div className="overflow-x-auto w-full mt-4">
                          <table className="w-full text-left">
                            <tbody>
                              <SkeletonRow cols={5} />
                              <SkeletonRow cols={5} />
                              <SkeletonRow cols={5} />
                            </tbody>
                          </table>
                        </div>
                    ) : attendanceData ? (
                      <div className="overflow-x-auto custom-scrollbar pb-6">
                        <table className={`w-full text-[12px] text-left whitespace-nowrap border-collapse border ${borderSubColor}`}>
                          <thead className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider`}>
                            <tr>
                              <th className={`px-3 py-1.5 sticky left-0 z-10 ${surfaceBg} border ${borderSubColor}`}>Student Name</th>
                              {attendanceData.sessions.map(s => (
                                <th key={s.sessionid} className={`px-2 py-1.5 text-center border ${borderSubColor}`}>{new Date(s.sessiondate).toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceData.students.map(student => (
                              <tr key={student.studentid} className={`${hoverBg} transition-colors group`}>
                                <td className={`px-3 py-1.5 font-bold sticky left-0 z-10 ${surfaceBg} border ${borderSubColor}`}>
                                  {student.fullname}
                                </td>
                                {attendanceData.sessions.map(session => {
                                  const key = `${student.studentid}_${session.sessionid}`;
                                  const isEdited = !!editedAttendance[key];
                                  const record = attendanceData.attendance.find(a => a.studentid === student.studentid && a.sessionid === session.sessionid);
                                  const currentStatus = isEdited ? editedAttendance[key].status : (record ? record.status : '-');
                                  
                                  let statusColor = mutedText;
                                  if (currentStatus === 'Present') statusColor = 'text-green-500';
                                  else if (currentStatus === 'Absent') statusColor = 'text-red-500';
                                  else if (currentStatus === 'Late') statusColor = 'text-yellow-500';
                                  else if (currentStatus === 'Permission') statusColor = 'text-blue-500';
                                  
                                  const editedBg = isEdited ? (isDark ? 'bg-indigo-500/20' : 'bg-indigo-50') : '';
                                  const displayChar = currentStatus === 'Present' ? '1' : (currentStatus === '-' ? '' : currentStatus.charAt(0));

                                  return (
                                    <td 
                                      key={session.sessionid} 
                                      className={`p-0 text-center font-bold border ${borderSubColor} ${editedBg} align-middle`}
                                    >
                                      {isEditingAttendance ? (
                                        <input 
                                          type="text" 
                                          maxLength={1}
                                          value={displayChar}
                                          className={`w-full h-full min-w-[30px] py-1.5 text-center bg-transparent outline-none focus:ring-2 focus:ring-indigo-500 font-bold ${statusColor}`}
                                          onFocus={(e) => e.target.select()}
                                          onChange={(e) => {
                                            const val = e.target.value.toUpperCase();
                                            let nextStatus = '-';
                                            if (val === '1') nextStatus = 'Present';
                                            else if (val === 'P') nextStatus = 'Permission';
                                            else if (val === 'L') nextStatus = 'Late';
                                            else if (val === 'A') nextStatus = 'Absent';
                                            else if (val === '') nextStatus = '-';
                                            else nextStatus = '-'; // ignore invalid chars
                                            
                                            setEditedAttendance(prev => ({
                                              ...prev,
                                              [key]: { studentid: student.studentid, sessionid: session.sessionid, status: nextStatus }
                                            }));
                                          }}
                                        />
                                      ) : (
                                        <div className={`px-2 py-1.5 ${statusColor}`}>
                                          {displayChar || '—'}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                            {attendanceData.students.length === 0 && (
                              <tr><td colSpan={attendanceData.sessions.length + 1} className="text-center py-6 font-bold text-gray-500">No students enrolled.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : selectedClass ? (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <button onClick={goBackToClasses} className={`px-4 py-2 rounded-lg font-bold text-xs text-white shadow-sm transition mb-4 inline-flex items-center gap-1 w-fit ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                          ← Back to Classes
                        </button>
                        <h3 className="font-bold text-lg">{selectedClass.classname} ({selectedClass.classcode}) Schedules</h3>
                        <p className={`text-xs ${mutedText} mt-1`}>Select a schedule to view the attendance sheet.</p>
                      </div>
                    </div>
                    {isSchedulesLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </div>
                    ) : schedules.length === 0 ? (
                      <div className="text-center py-10 font-bold text-gray-500">No schedules found for this class.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {schedules.map(sched => (
                          <div key={sched.scheduleid} onClick={() => handleScheduleClick(sched)} className={`border rounded-xl p-5 cursor-pointer hover:border-indigo-500 transition-colors ${borderSubColor} ${subBg}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-lg">{sched.subject}</p>
                                <p className={`text-xs ${brandColor} font-semibold uppercase tracking-wider`}>{sched.dayofweek}</p>
                              </div>
                            </div>
                            <div className={`mt-4 pt-4 border-t ${borderSubColor} flex items-center gap-2`}>
                              <Clock size={14} className={mutedText} />
                              <span className={`text-xs font-bold ${mutedText}`}>{sched.starttime.slice(0,5)} - {sched.endtime.slice(0,5)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-lg">Active Classes</h3>
                        <p className={`text-xs ${mutedText} mt-1`}>Manage rosters and view attendance sheets.</p>
                      </div>
                      <button className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}><Plus size={16} className="inline mr-1" /> Create Class</button>
                    </div>
                    {isClassesLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </div>
                    ) : classes.length === 0 ? (
                      <div className="text-center py-10 font-bold text-gray-500">No classes found in the database.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classes.map(cls => (
                          <div key={cls.classid} onClick={() => handleClassClick(cls)} className={`border rounded-xl p-5 cursor-pointer hover:border-indigo-500 transition-colors ${borderSubColor} ${subBg}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-lg">{cls.classcode}</p>
                                <p className={`text-xs ${brandColor} font-semibold uppercase tracking-wider`}>{cls.classname}</p>
                              </div>
                              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${isDark ? 'bg-black text-gray-300' : 'bg-white text-gray-600 shadow-sm border border-gray-100'}`}>{cls.student_count} Students</span>
                            </div>
                            <div className={`mt-4 pt-4 border-t ${borderSubColor} flex items-center justify-between`}>
                              <div className="flex items-center gap-2">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(cls.primary_lecturer || 'Unassigned')}&background=eef2ff&color=6366f1`} className="w-6 h-6 rounded-full" />
                                <p className={`text-xs font-medium ${mutedText}`}>{cls.primary_lecturer || 'No Lecturer'}</p>
                              </div>
                              <button className={`text-xs font-bold hover:underline ${brandColor}`}>View Schedules</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeView === 'hardware' && (
              <div className={`${cardStyle}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-lg">Biometric Hardware Endpoints</h3>
                    <p className={`text-xs ${mutedText} mt-1`}>Monitor the connection status of physical fingerprint scanners.</p>
                  </div>
                  <button className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}><i className="fas fa-plus mr-1"></i> Register Device</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className={`border rounded-xl p-5 flex flex-col justify-between ${borderSubColor} ${subBg}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="font-bold text-lg">BIO-01</p>
                        <p className={`text-xs ${mutedText} mt-0.5`}><i className="fas fa-map-marker-alt mr-1"></i> Main Entrance</p>
                      </div>
                      <span className={`px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1.5 ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span> ONLINE
                      </span>
                    </div>
                    <div className={`pt-4 border-t ${borderSubColor} flex justify-between text-xs`}>
                      <span className={mutedText}>Last Sync: Just now</span>
                      <button className={`font-bold hover:underline ${brandColor}`}>Configure</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                    <button className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-csv text-xl"></i> CSV</button>
                    <button className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-excel text-xl"></i> Excel</button>
                    <button className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-pdf text-xl"></i> PDF</button>
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

            {activeView === 'logs' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col pb-6">
                <div className="bg-[#181a1f] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full flex-1 min-h-[500px]">
                  {/* Console Header */}
                  <div className="bg-[#21252b] px-6 py-4 flex items-center justify-between border-b border-[#181a1f]">
                    <div className="flex items-center gap-4">
                      <button className="bg-[#3a3f4b] hover:bg-[#4b5162] text-white text-[12px] font-bold px-4 py-2 rounded-md transition">View All (36)</button>
                      <button className="text-gray-400 hover:text-white text-[12px] font-bold transition">Refresh</button>
                    </div>
                    <div className="flex items-center gap-4 text-gray-500">
                      <Trash2 size={16} className="cursor-pointer hover:text-white transition" />
                      <Copy size={16} className="cursor-pointer hover:text-white transition" />
                      <Maximize size={16} className="cursor-pointer hover:text-white transition" />
                    </div>
                  </div>
                  
                  {/* Console Body */}
                  <div className="p-6 overflow-y-auto custom-scrollbar h-full font-mono text-[14px] leading-[1.5] flex flex-col tracking-tight select-text">
                    {[
                      { time:'8:34:58 AM', action:'DELETE_USER', msg:'User ID 16 deleted by Admin (Actor: him_vuthy)', color:'text-red-500' },
                      { time:'8:47:58 AM', action:'UPDATE_ROLE', msg:'Role changed to Teacher by Admin (Actor: him_vuthy)', color:'text-yellow-500' },
                      { time:'1:49:43 AM', action:'ADD_USER', msg:'New user registered via Phone: 887126 (Actor: 887126)', color:'text-green-500' },
                      { time:'2:45:12 AM', action:'ADD_USER', msg:'New user registered via Phone: 416317 (Actor: gaylord)', color:'text-green-500' },
                      { time:'9:16:50 AM', action:'RESET_PASSWORD', msg:'Password reset for User ID 20 (Actor: him_vuthy)', color:'text-yellow-500' },
                      { time:'3:12:12 PM', action:'ADD_USER', msg:'New user registered via Google: 922630 (Actor: him_vuthy)', color:'text-green-500' },
                      { time:'4:59:48 PM', action:'ADD_USER', msg:'New user registered: sigmaboy (Actor: sigma)', color:'text-green-500' },
                      { time:'6:42:48 PM', action:'DELETE_USER', msg:'User him_vuthy deleted by Admin (Actor: him_vuthy)', color:'text-red-500' },
                      { time:'8:10:41 PM', action:'DELETE_USER', msg:'User him_vuthy19 deleted by Admin (Actor: him_vuthy)', color:'text-red-500' },
                      { time:'8:13:15 PM', action:'ADD_USER', msg:'New user registered via Phone: 125759 (Actor: System)', color:'text-green-500' },
                      { time:'3:29:57 AM', action:'DELETE_USER', msg:'User 125759 deleted by Admin (Actor: him_vuthy)', color:'text-red-500' },
                    ].map((log, i) => (
                      <div key={i} className={`${log.color} whitespace-pre-wrap`}>
                        [{log.time}] [{log.action}]: {log.msg}
                      </div>
                    ))}
                  </div>

                  {/* Input Bar */}
                  <div className="px-6 pb-6 pt-0">
                    <div className="bg-[#21252b] rounded-lg border border-[#3a3f4b] px-4 py-3 flex items-center justify-between group focus-within:border-[#528bff] transition-colors">
                      <div className="flex items-center gap-3 text-gray-500 text-[14px] w-full font-mono">
                        <span className="font-bold opacity-50">&gt;&gt;</span>
                        <input type="text" placeholder="Type a command..." className="bg-transparent outline-none border-none flex-1 text-white placeholder-gray-600 focus:placeholder-gray-700" />
                      </div>
                      <Clock size={16} className="text-gray-500 cursor-pointer hover:text-white transition shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            )}

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
                       <p className={`text-xs ${mutedText} mt-1 mb-4`}>Securely end your current administrative session.</p>
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
      {showAddStudentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${cardStyle} max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col p-0`}>
            <div className={`p-4 border-b ${borderSubColor} flex justify-between items-center`}>
              <h2 className="text-lg font-bold">Enroll Student</h2>
              <button onClick={() => setShowAddStudentModal(false)} className={`${mutedText} hover:text-red-500 transition`}>
                <X size={20} />
              </button>
            </div>
            
            <div className={`p-4 border-b ${borderSubColor} bg-black/5`}>
              <label className={`block text-xs font-bold mb-2 ${mutedText}`}>MANUAL ENTRY / SEARCH</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Enter Student ID (e.g. ST-001)"
                  value={enrollSearchQuery}
                  onChange={e => setEnrollSearchQuery(e.target.value)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm border ${borderSubColor} bg-transparent outline-none focus:border-indigo-500 transition`}
                  onKeyDown={e => { if(e.key === 'Enter') enrollStudent(enrollSearchQuery); }}
                />
                <button 
                  onClick={() => enrollStudent(enrollSearchQuery)}
                  className={`px-4 py-2 rounded-lg font-bold text-xs text-white transition ${isDark ? 'bg-indigo-500 hover:bg-indigo-400' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                >
                  Enroll ID
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
              {unenrolledStudents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <UserPlus size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Cannot load unenrolled list (or none left).<br/>You can still type the ID manually above.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unenrolledStudents
                    .filter(s => s.studentid.toLowerCase().includes(enrollSearchQuery.toLowerCase()) || s.fullname.toLowerCase().includes(enrollSearchQuery.toLowerCase()))
                    .map(student => (
                    <div key={student.studentid} className={`flex items-center justify-between p-3 rounded-lg border ${borderSubColor} ${hoverBg}`}>
                      <div className="flex items-center gap-3">
                        <img src={student.profilepicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.fullname)}&background=eef2ff&color=6366f1`} className="w-8 h-8 rounded-full" />
                        <div>
                          <p className="font-bold text-sm">{student.fullname}</p>
                          <p className={`text-xs ${mutedText}`}>{student.studentid}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => enrollStudent(student.studentid)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition ${isDark ? 'bg-indigo-500 hover:bg-indigo-400 text-white' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                      >
                        Enroll
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showEntityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${cardStyle} max-w-2xl w-full flex flex-col p-0`}>
            <div className={`p-4 border-b ${borderSubColor} flex justify-between items-center`}>
              <h2 className="text-lg font-bold">{editingEntity ? 'Edit Entity' : 'Add New Entity'}</h2>
              <button onClick={() => setShowEntityModal(false)} className={`${mutedText} hover:text-red-500 transition`}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEntity} className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold mb-1">Full Name</label>
                <input required type="text" value={newEntity.fullname} onChange={e => setNewEntity({...newEntity, fullname: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} bg-transparent`} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Role</label>
                <select value={newEntity.roleid} onChange={e => setNewEntity({...newEntity, roleid: parseInt(e.target.value)})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} bg-transparent`}>
                  <option value={1} className={isDark ? 'text-black' : ''}>Admin</option>
                  <option value={2} className={isDark ? 'text-black' : ''}>Teacher</option>
                  <option value={3} className={isDark ? 'text-black' : ''}>Student</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Gender</label>
                <select value={newEntity.gender} onChange={e => setNewEntity({...newEntity, gender: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} bg-transparent`}>
                  <option value="Male" className={isDark ? 'text-black' : ''}>Male</option>
                  <option value="Female" className={isDark ? 'text-black' : ''}>Female</option>
                  <option value="Other" className={isDark ? 'text-black' : ''}>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Date of Birth</label>
                <input type="date" value={newEntity.dateofbirth} onChange={e => setNewEntity({...newEntity, dateofbirth: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} bg-transparent`} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Phone Number</label>
                <input type="text" value={newEntity.phonenumber} onChange={e => setNewEntity({...newEntity, phonenumber: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} bg-transparent`} />
              </div>
              <div className="col-span-full border-t border-dashed my-2 pt-2 border-gray-300 dark:border-white/10">
                <p className="text-xs font-bold text-gray-500 mb-2">USER ACCOUNT (Optional)</p>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Username</label>
                <input type="text" value={newEntity.username} onChange={e => setNewEntity({...newEntity, username: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} bg-transparent`} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Email</label>
                <input type="email" value={newEntity.email} onChange={e => setNewEntity({...newEntity, email: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} bg-transparent`} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">{editingEntity ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                <input type={editingEntity ? "text" : "password"} value={newEntity.password} onChange={e => setNewEntity({...newEntity, password: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} bg-transparent`} />
              </div>
              <div className="col-span-full flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setShowEntityModal(false)} className={`px-4 py-2 rounded-lg font-bold text-sm ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}>Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg font-bold text-sm bg-indigo-500 text-white hover:bg-indigo-600">Save Entity</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
