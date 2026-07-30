import React, { useState, useEffect, useRef } from 'react';
import { 
  Fingerprint, Bell, LayoutDashboard, Database, BookOpen, 
  Cpu, FileText, Terminal, Settings, LogOut, 
  Users, CheckCircle, XCircle, BarChart3, Sun, Moon,
  CalendarDays, Search, Pencil, Trash2, KeyRound, PieChart as PieChartIcon, MoreHorizontal,
  Copy, Maximize, Clock, Filter, Plus, MoreVertical, Download, UserPlus, Save, X, ChevronLeft, ShieldCheck, CheckCircle2, Shield
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const baseUrl = API_BASE.replace(/\/$/, '');
const hardwareBaseUrl = 'http://localhost:3000'; // Override for local hardware API

const CustomSelect = ({ value, onChange, options, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className="relative" ref={selectRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${className} flex items-center justify-between min-w-[150px] outline-none`}
      >
        <span className="truncate">{selectedOption.label}</span>
        <svg className={`w-4 h-4 ml-2 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      
      {isOpen && (
        <div className="absolute z-[100] w-full mt-1 bg-white border border-gray-100 rounded-2xl shadow-xl dark:bg-[#111] dark:border-white/10 overflow-hidden">
          {options.map((opt) => (
            <div
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-sky-50 dark:hover:bg-white/5 transition-colors ${value === opt.value ? 'bg-sky-50/50 text-sky-600 font-bold dark:bg-sky-500/10 dark:text-sky-400' : 'text-gray-700 dark:text-gray-300 font-medium'}`}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};


const AdminDashboard = ({ onLogout }) => {
  // --- UI STATES ---
  const [activeView, setActiveView] = useState(() => {
    return localStorage.getItem('adminActiveView') || 'dashboard';
  });
  const [openMenuId, setOpenMenuId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // --- Attendance Tracking State ---
  const [trackingLevel, setTrackingLevel] = useState('classes'); // 'classes', 'sessions', 'log'
  const [trackingClasses, setTrackingClasses] = useState([]);
  const [trackingSessions, setTrackingSessions] = useState([]);
  const [trackingLogs, setTrackingLogs] = useState([]);
  const [selectedTrackingClass, setSelectedTrackingClass] = useState(null);
  const [selectedTrackingSession, setSelectedTrackingSession] = useState(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  useEffect(() => {
    if (activeView) {
      localStorage.setItem('adminActiveView', activeView);
    }
  }, [activeView]);
  
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('adminTheme') === 'dark';
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [adminSettings, setAdminSettings] = useState({
    checkInReminders: true,
    missedAttendanceAlerts: true,
    excuseUpdates: false,
    weeklySummary: false,
    loginAlerts: true,
    reminderTime: '15 minutes before',
    language: 'English'
  });
  
  const updateSetting = (key, value) => {
    setAdminSettings(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    localStorage.setItem('adminTheme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // --- CACHE & OPTIMISTIC RENDERING ---
  const dataCache = React.useRef({
    users: null,
    entities: null,
    biometric: null,
    classes: null,
    schedules: {},
    attendance: {},
    trackingClasses: null,
    trackingSessions: {},
    trackingLogs: {}
  });

  const [adminDashboardData, setAdminDashboardData] = useState({
    stats: { totalStudents: 0, activeClasses: 0, enrollment: 0, pendingEnrollment: 0 },
    attendanceTotals: { total: 0, Present: 0, Late: 0, Absent: 0, rate: 0 },
    todaysClasses: [],
    weeklyData: [],
    recentAttendance: []
  });
  const [isAdminDashLoading, setIsAdminDashLoading] = useState(false);

  // Terminal UI State
  const [activeTerminalTab, setActiveTerminalTab] = useState('log');
  const [terminalLogs, setTerminalLogs] = useState([
    { time: new Date().toLocaleTimeString(), action: 'SYSTEM', msg: 'System logs initialized. Ready for queries.', color: 'text-blue-400' },
    { time: new Date().toLocaleTimeString(), action: 'INFO', msg: 'Type a SQL query and press Enter to execute.', color: 'text-gray-400' }
  ]);
  const [terminalInput, setTerminalInput] = useState('');
  const terminalEndRef = useRef(null);

  const handleTerminalSubmit = async (e) => {
    if (e.key === 'Enter' && terminalInput.trim()) {
      const command = terminalInput.trim();
      setTerminalInput('');
      const timeStr = new Date().toLocaleTimeString();
      
      setTerminalLogs(prev => [...prev, {
        time: timeStr, action: 'ADMIN_QUERY', msg: `> ${command}`, color: 'text-gray-300'
      }]);

      try {
        const res = await fetch(`${baseUrl}/api/admin/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: command })
        });
        const data = await res.json();
        
        if (!res.ok) {
          setTerminalLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString(), action: 'ERROR', msg: data.error || 'Failed to execute query', color: 'text-red-500'
          }]);
        } else {
          let msg = `[${data.command || 'QUERY'}] Successfully executed. RowCount: ${data.rowCount || 0}`;
          if (data.rows && data.rows.length > 0) {
            msg += `\n` + JSON.stringify(data.rows.slice(0, 10), null, 2);
            if (data.rows.length > 10) msg += `\n... (Showing 10 of ${data.rows.length} rows)`;
          }
          setTerminalLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString(), action: 'SUCCESS', msg, color: 'text-green-400'
          }]);
        }
      } catch (err) {
        setTerminalLogs(prev => [...prev, {
          time: new Date().toLocaleTimeString(), action: 'ERROR', msg: err.message, color: 'text-red-500'
        }]);
      }
    }
  };

  useEffect(() => {
    if (activeView === 'logs' && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs, activeView]);

  const fetchAdminDashboard = async () => {
    try {
      setIsAdminDashLoading(true);
      
      const res = await fetch(`${baseUrl}/api/admin/dashboard`);
      if (res.ok) {
        const data = await res.json();
        setAdminDashboardData(data);
      }
    } catch (err) {
      console.error("Failed to fetch admin dashboard", err);
    } finally {
      setIsAdminDashLoading(false);
    }
  };

  useEffect(() => {
    if (activeView === 'dashboard') {
      fetchAdminDashboard();
    }
  }, [activeView]);

  const isLoading = false;
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [biometricStudents, setBiometricStudents] = useState([]);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [hardwareDevices, setHardwareDevices] = useState([]);
  const [showRegisterDeviceModal, setShowRegisterDeviceModal] = useState(false);
  const [newDevice, setNewDevice] = useState({ devicename: '', location: '' });
  
  const [showConfigureDeviceModal, setShowConfigureDeviceModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState({ deviceid: null, devicename: '', location: '' });

  const handleConfigureDeviceSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${hardwareBaseUrl}/api/devices/${editingDevice.deviceid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ devicename: editingDevice.devicename, location: editingDevice.location })
      });
      if (res.ok) {
        setShowConfigureDeviceModal(false);
        setEditingDevice({ deviceid: null, devicename: '', location: '' });
        fetchHardwareDevices();
      } else {
        alert('Failed to configure device');
      }
    } catch (e) {
      console.error(e);
      alert('Error configuring device');
    }
  };

  const handleRegisterDeviceSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${hardwareBaseUrl}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDevice)
      });
      if (res.ok) {
        setShowRegisterDeviceModal(false);
        setNewDevice({ devicename: '', location: '' });
        fetchHardwareDevices();
      } else {
        alert('Failed to register device');
      }
    } catch (e) {
      console.error(e);
      alert('Error registering device');
    }
  };

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
      const res = await fetch(`${baseUrl}/api/users`);
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
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logSortOption, setLogSortOption] = useState('name_asc');
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [editingEntity, setEditingEntity] = useState(null);
  const [newEntity, setNewEntity] = useState({
    fullname: '', username: '', email: '', password: '', roleid: 3, gender: 'Male', dateofbirth: '', phonenumber: ''
  });

  const fetchEntities = async () => {
    if (dataCache.current.entities) {
      setEntities(dataCache.current.entities);
    } else {
      setIsEntitiesLoading(true);
    }
    try {
      const res = await fetch(`${baseUrl}/api/entities`);
      if (res.ok) {
        const data = await res.json();
        setEntities(data);
        dataCache.current.entities = data;
      }
    } catch (e) {
      console.error(e);
    }
    setIsEntitiesLoading(false);
  };

  const fetchBiometricStudents = async () => {
    if (dataCache.current.biometric) {
      setBiometricStudents(dataCache.current.biometric);
    } else {
      setIsBiometricLoading(true);
    }
    try {
      const res = await fetch(`${baseUrl}/api/biometric/students`);
      if (res.ok) {
        const data = await res.json();
        setBiometricStudents(data);
        dataCache.current.biometric = data;
      }
    } catch (e) {
      console.error(e);
    }
    setIsBiometricLoading(false);
  };

  const fetchHardwareDevices = async () => {
    try {
      const res = await fetch(`${hardwareBaseUrl}/api/devices`);
      if (res.ok) {
        const data = await res.json();
        setHardwareDevices(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchMajors = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/majors`);
      if (res.ok) {
        const data = await res.json();
        setMajors(data);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchMajors();
  }, []);

  useEffect(() => {
    let interval;
    if (activeView === 'database') fetchUsers();
    else if (activeView === 'attendance') { fetchTrackingClasses(); setTrackingLevel('classes'); }
    else if (activeView === 'entities') fetchEntities();
    else if (activeView === 'biometric') fetchBiometricStudents();
    else if (activeView === 'hardware') {
      fetchHardwareDevices();
      interval = setInterval(fetchHardwareDevices, 3000);
    }
    return () => { if (interval) clearInterval(interval); };
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
    
    const previousUsers = [...users];
    setUsers(prev => [optimisticUser, ...prev]);
    setShowAddUser(false);
    setNewUser({ fullname: '', username: '', email: '', password: '', roleid: 3 });

    try {
      const res = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(optimisticUser)
      });
      if (!res.ok) {
        throw new Error('Failed to create user');
      }
      fetchUsers(); // Refresh cache with real data
    } catch (error) {
      console.error(error);
      alert('Error creating user, changes reverted.');
      setUsers(previousUsers); // Rollback
    }
  };

  const handleSaveEntity = async (e) => {
    e.preventDefault();
    const isEdit = !!editingEntity;
    const tempEid = isEdit ? editingEntity.eid : Date.now();
    
    // OPTIMISTIC RENDER
    const optimisticEntity = {
      ...newEntity,
      eid: tempEid,
      roleid: newEntity.roleid,
      rolename: newEntity.roleid === 1 ? 'Admin' : newEntity.roleid === 2 ? 'Teacher' : 'Student',
      createdat: isEdit ? editingEntity.createdat : new Date().toISOString(),
      lastedit: new Date().toISOString()
    };
    
    // Save original state for rollback
    const previousEntities = [...entities];
    
    if (isEdit) {
      setEntities(prev => prev.map(en => en.eid === tempEid ? { ...en, ...optimisticEntity } : en));
    } else {
      setEntities(prev => [optimisticEntity, ...prev]);
    }
    
    setShowEntityModal(false);
    setEditingEntity(null);
    setNewEntity({ fullname: '', username: '', email: '', password: '', roleid: 3, gender: 'Male', dateofbirth: '', phonenumber: '' });

    try {
      const url = isEdit ? `${baseUrl}/api/entities/${tempEid}` : `${baseUrl}/api/entities`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEntity)
      });
      if (res.ok) {
        fetchEntities(); // Sync with real IDs
      } else {
        throw new Error('Failed to save');
      }
    } catch (err) {
      console.error(err);
      alert('Error saving entity, changes reverted.');
      setEntities(previousEntities); // Rollback
    }
  };

  const handleDeleteEntity = async (eid) => {
    if (!confirm('Are you sure you want to delete this entity?')) return;
    
    const previousEntities = [...entities];
    setEntities(prev => prev.filter(e => e.eid !== eid)); // OPTIMISTIC
    
    try {
      const res = await fetch(`${baseUrl}/api/entities/${eid}`, { method: 'DELETE' });
      if (res.ok) {
        fetchEntities();
      } else {
        throw new Error('Failed to delete entity');
      }
    } catch (err) {
      console.error(err);
      alert('Error deleting entity, changes reverted.');
      setEntities(previousEntities); // Rollback
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (user.student_id && user.student_id.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          user.id.toString().includes(searchQuery);
    const matchesRole = roleFilter === 'All' || user.role.toLowerCase() === roleFilter.toLowerCase();
    return matchesSearch && matchesRole;
  });

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${userName}?`)) return;
    
    const previousUsers = [...users];
    setUsers(users.filter(user => user.id !== userId)); // Optimistic UI
    
    try {
      const res = await fetch(`${baseUrl}/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert('Error deleting user, changes reverted.');
      setUsers(previousUsers); // Rollback
    }
  };

  const handleEditUser = async (userId, currentName, currentRole) => {
    const newName = window.prompt("Enter new name for this user:", currentName);
    if (!newName || newName === currentName) return;
    
    const previousUsers = [...users];
    setUsers(users.map(user => user.id === userId ? { ...user, name: newName } : user)); // Optimistic UI
    
    try {
      const res = await fetch(`${baseUrl}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      });
      if (!res.ok) throw new Error('Failed to update user');
      fetchUsers();
    } catch (error) {
      console.error(error);
      alert('Error editing user, changes reverted.');
      setUsers(previousUsers); // Rollback
    }
  };

  // --- CLASS & ATTENDANCE DATA ---
  const [classes, setClasses] = useState([]);
  const [isClassesLoading, setIsClassesLoading] = useState(false);
  const [showCreateClassModal, setShowCreateClassModal] = useState(false);
  const [majors, setMajors] = useState([]);
  const [newClass, setNewClass] = useState({ classcode: '', classname: '', academicyear: '2025-2026', semester: 1, majorid: '' });
  
  const handleCreateClassSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${baseUrl}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClass)
      });
      if (res.ok) {
        setShowCreateClassModal(false);
        setNewClass({ classcode: '', classname: '', academicyear: '2025-2026', semester: 1, majorid: '' });
        fetchTrackingClasses(); 
      } else {
        alert('Failed to create class');
      }
    } catch (e) {
      console.error(e);
      alert('Error creating class');
    }
  };
  
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
  const [enrollListSearchQuery, setEnrollListSearchQuery] = useState('');
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // --- TIMETABLE CRUD STATE ---
  const [selectedTimetableClass, setSelectedTimetableClass] = useState(null);
  const [timetableSchedules, setTimetableSchedules] = useState([]);
  const [isTimetableLoading, setIsTimetableLoading] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [scheduleFormData, setScheduleFormData] = useState({ subject: '', starttime: '', endtime: '', dayofweek: 'Monday', teacherid: '' });
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const fetchClasses = async () => {
    if (dataCache.current.classes) {
      setClasses(dataCache.current.classes);
    } else {
      setIsClassesLoading(true);
    }
    try {
      const res = await fetch(`${baseUrl}/api/classes`);
      const data = await res.json();
      setClasses(data);
      dataCache.current.classes = data;
    } catch (error) {
      console.error('Failed to fetch classes', error);
    }
    setIsClassesLoading(false);
  };

  useEffect(() => {
    if (activeView === 'classes' || activeView === 'timetable') {
      fetchClasses();
    }
  }, [activeView]);

  // --- TIMETABLE FUNCTIONS ---
  const handleTimetableClassClick = async (cls) => {
    setSelectedTimetableClass(cls);
    setIsTimetableLoading(true);
    try {
      const res = await fetch(`${baseUrl}/api/classes/${cls.classid}/schedules`);
      const data = await res.json();
      setTimetableSchedules(data);
    } catch (error) {
      console.error('Failed to fetch schedules', error);
    }
    setIsTimetableLoading(false);
  };

  const openAddScheduleModal = () => {
    setEditingSchedule(null);
    setScheduleFormData({ subject: '', starttime: '', endtime: '', dayofweek: 'Monday', teacherid: '' });
    setShowScheduleModal(true);
  };

  const openEditScheduleModal = (sched) => {
    setEditingSchedule(sched);
    setScheduleFormData({
      subject: sched.subject,
      starttime: sched.starttime,
      endtime: sched.endtime,
      dayofweek: sched.dayofweek,
      teacherid: sched.teacherid || ''
    });
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    if (!scheduleFormData.subject || !scheduleFormData.starttime || !scheduleFormData.endtime || !scheduleFormData.dayofweek) return;
    setIsSavingSchedule(true);
    try {
      if (editingSchedule) {
        // Edit
        const res = await fetch(`${baseUrl}/api/schedules/${editingSchedule.scheduleid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleFormData)
        });
        const updatedSched = await res.json();
        setTimetableSchedules(prev => prev.map(s => s.scheduleid === updatedSched.scheduleid ? updatedSched : s));
      } else {
        // Add
        const res = await fetch(`${baseUrl}/api/classes/${selectedTimetableClass.classid}/schedules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(scheduleFormData)
        });
        const newSched = await res.json();
        setTimetableSchedules(prev => [...prev, newSched]);
      }
      setShowScheduleModal(false);
    } catch (error) {
      console.error('Failed to save schedule', error);
    }
    setIsSavingSchedule(false);
  };

  const handleDeleteSchedule = async (scheduleid) => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) return;
    try {
      await fetch(`${baseUrl}/api/schedules/${scheduleid}`, {
        method: 'DELETE'
      });
      setTimetableSchedules(prev => prev.filter(s => s.scheduleid !== scheduleid));
    } catch (error) {
      console.error('Failed to delete schedule', error);
    }
  };

  // --- ATTENDANCE TRACKING FUNCTIONS ---
  const fetchTrackingClasses = async () => {
    if (dataCache.current.trackingClasses) {
      setTrackingClasses(dataCache.current.trackingClasses);
    } else {
      setIsTrackingLoading(true);
    }
    try {
      const localDate = new Date();
      const todayDateStr = localDate.getFullYear() + '-' + String(localDate.getMonth() + 1).padStart(2, '0') + '-' + String(localDate.getDate()).padStart(2, '0');
      const todayDayName = localDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      const res = await fetch(`${baseUrl}/api/attendance-tracking/classes?day=${todayDayName}&date=${todayDateStr}`);
      const data = await res.json();
      setTrackingClasses(data);
      dataCache.current.trackingClasses = data;
    } catch (error) {
      console.error('Failed to fetch tracking classes', error);
    }
    setIsTrackingLoading(false);
  };

  const fetchTrackingSessions = async (classid) => {
    if (dataCache.current.trackingSessions[classid]) {
      setTrackingSessions(dataCache.current.trackingSessions[classid]);
      setTrackingLevel('sessions');
    } else {
      setIsTrackingLoading(true);
    }
    try {
      const res = await fetch(`${baseUrl}/api/attendance-tracking/classes/${classid}/sessions`);
      const data = await res.json();
      setTrackingSessions(data);
      dataCache.current.trackingSessions[classid] = data;
      setTrackingLevel('sessions');
    } catch (error) {
      console.error('Failed to fetch tracking sessions', error);
    }
    setIsTrackingLoading(false);
  };

  const fetchTrackingLogs = async (sessionid) => {
    if (sessionid === 'mock-today') {
      setTrackingLogs([]);
      setTrackingLevel('log');
      return;
    }

    if (dataCache.current.trackingLogs[sessionid]) {
      setTrackingLogs(dataCache.current.trackingLogs[sessionid]);
      setTrackingLevel('log');
    } else {
      setIsTrackingLoading(true);
    }
    
    try {
      const res = await fetch(`${baseUrl}/api/attendance-tracking/sessions/${sessionid}/log`);
      if (!res.ok) {
        throw new Error('Server returned an error');
      }
      const data = await res.json();
      // Ensure we always have an array
      const validData = Array.isArray(data) ? data : [];
      setTrackingLogs(validData);
      dataCache.current.trackingLogs[sessionid] = validData;
      setTrackingLevel('log');
    } catch (error) {
      console.error('Failed to fetch tracking logs', error);
      setTrackingLogs([]);
      setTrackingLevel('log');
    }
    setIsTrackingLoading(false);
  };

  const handleTrackingClassClick = (cls) => {
    setSelectedTrackingClass(cls);
    fetchTrackingSessions(cls.classid);
  };

  const handleTrackingSessionClick = (session) => {
    setSelectedTrackingSession(session);
    fetchTrackingLogs(session.sessionid);
  };

  const handleClassClick = async (cls) => {
    setSelectedClass(cls);
    if (dataCache.current.schedules[cls.classid]) {
      setSchedules(dataCache.current.schedules[cls.classid]);
    } else {
      setIsSchedulesLoading(true);
    }
    try {
      const res = await fetch(`${baseUrl}/api/classes/${cls.classid}/schedules`);
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
      const res = await fetch(`${baseUrl}/api/schedules/${sched.scheduleid}/attendance`);
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

  const handleGenerateReport = async (format) => {
    try {
      const res = await fetch(`${baseUrl}/api/reports/attendance`);
      if (!res.ok) throw new Error('Failed to fetch report data');
      const data = await res.json();
      
      if (!data || data.length === 0) {
        alert('No attendance data available to generate report.');
        return;
      }

      const formattedData = data.map(row => ({
        'Student ID': String(row.studentid).padStart(4, '0'),
        'Student Name': row.studentname,
        'Class Code': row.classcode,
        'Class Name': row.classname,
        'Session Date': new Date(row.sessiondate).toLocaleDateString(),
        'Status': row.status,
        'Time Attended': row.attendedat ? new Date(row.attendedat).toLocaleTimeString() : 'N/A',
        'Minutes Late': row.minutelate || 0
      }));

      const filename = `Attendance_Report_${new Date().toISOString().split('T')[0]}`;

      if (format === 'CSV') {
        const header = Object.keys(formattedData[0]).join(',');
        const rows = formattedData.map(row => Object.values(row).map(val => `"${val}"`).join(',')).join('\n');
        const csvContent = `${header}\n${rows}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.csv`;
        link.click();
      } else if (format === 'Excel') {
        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
        XLSX.writeFile(workbook, `${filename}.xlsx`);
      } else if (format === 'PDF') {
        const doc = new jsPDF();
        doc.text('System-Wide Attendance Report', 14, 15);
        
        const tableColumn = Object.keys(formattedData[0]);
        const tableRows = formattedData.map(row => Object.values(row));
        
        doc.autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: 20,
          styles: { fontSize: 8 },
          headStyles: { fillColor: [79, 70, 229] }
        });
        
        doc.save(`${filename}.pdf`);
      }
    } catch (e) {
      console.error(e);
      alert('Error generating report: ' + e.message);
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
    
    // OPTIMISTIC RENDER
    const previousAttendanceData = { ...attendanceData };
    const newData = { ...attendanceData, attendance: [...(attendanceData.attendance || [])] };
    updates.forEach(update => {
      const idx = newData.attendance.findIndex(a => a.studentid === update.studentid && a.sessionid === update.sessionid);
      if (idx !== -1) {
        newData.attendance[idx] = { ...newData.attendance[idx], status: update.status };
      } else {
        newData.attendance.push({ studentid: update.studentid, sessionid: update.sessionid, status: update.status, minutelate: 0 });
      }
    });
    setAttendanceData(newData);
    setIsEditingAttendance(false);
    
    setIsSavingAttendance(true);
    try {
      const res = await fetch(`${baseUrl}/api/attendance/bulk`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates })
      });
      if (!res.ok) throw new Error('Failed to save attendance');
      
      if (dataCache.current.attendance[selectedSchedule.scheduleid]) {
         dataCache.current.attendance[selectedSchedule.scheduleid] = newData;
      }
      setEditedAttendance({});
    } catch (e) {
      console.error(e);
      alert('Failed to save attendance, changes reverted.');
      setAttendanceData(previousAttendanceData); // Rollback
      setIsEditingAttendance(true); // Re-open edit mode
    }
    setIsSavingAttendance(false);
  };

  const openAddStudentModal = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/classes/${selectedClass.classid}/unenrolled-students`);
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
    
    const studentObj = unenrolledStudents.find(s => s.studentid === studentIdToEnroll);
    const previousAttendanceData = { ...attendanceData };
    let newData = null;
    
    if (studentObj && attendanceData) {
      // OPTIMISTIC RENDER
      newData = { ...attendanceData, students: [...(attendanceData.students || [])] };
      newData.students.push({ studentid: studentObj.studentid, fullname: studentObj.fullname, profilepicture: studentObj.profilepicture });
      newData.students.sort((a,b) => a.fullname.localeCompare(b.fullname));
      setAttendanceData(newData);
      setUnenrolledStudents(prev => prev.filter(s => s.studentid !== studentIdToEnroll));
      setShowAddStudentModal(false);
    }
    
    try {
      const res = await fetch(`${baseUrl}/api/classes/${selectedClass.classid}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentid: studentIdToEnroll })
      });
      
      const responseData = await res.json();
      if (!res.ok) throw new Error(responseData.error || 'Unknown error');
      
      if (!studentObj) {
        const student = responseData.student;
        newData = { ...attendanceData, students: [...(attendanceData.students || [])] };
        newData.students.push({ studentid: student.studentid, fullname: student.fullname, profilepicture: student.profilepicture });
        newData.students.sort((a,b) => a.fullname.localeCompare(b.fullname));
        setAttendanceData(newData);
        setShowAddStudentModal(false);
      }
      
      if (newData && dataCache.current.attendance[selectedSchedule.scheduleid]) {
         dataCache.current.attendance[selectedSchedule.scheduleid] = newData;
      }
      setEnrollSearchQuery(''); // reset
    } catch (e) {
      console.error(e);
      alert('Failed to enroll student, changes reverted.');
      if (studentObj && attendanceData) {
        setAttendanceData(previousAttendanceData); // Rollback
        setUnenrolledStudents(prev => [...prev, studentObj]); // Put back
      }
    }
  };


  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' 
  }).toUpperCase();

  // --- DYNAMIC THEME CLASSES ---
  const appBg = isDark ? "bg-black" : "bg-[#e2e8f0]";
  const surfaceBg = isDark ? "bg-black" : "bg-white";
  const borderColor = isDark ? "border-white/10 divide-white/10" : "border-[#e2e8f0] divide-[#e2e8f0]";
  const borderSubColor = isDark ? "border-white/5 divide-white/5" : "border-gray-200 divide-gray-200";
  const textColor = isDark ? "text-white" : "text-gray-800";
  const mutedText = isDark ? "text-gray-400" : "text-slate-500";
  const subBg = isDark ? "bg-white/5" : "bg-gray-50";
  const hoverBg = isDark ? "hover:bg-white/5" : "hover:bg-gray-50";
  
  const navActiveBg = isDark ? "bg-white/10 text-cyan-400" : "bg-indigo-600 text-white shadow-md shadow-indigo-600/20";
  const navInactiveBg = isDark ? "text-gray-400 hover:bg-white/5 hover:text-white" : "text-slate-500 hover:bg-gray-50 hover:text-indigo-600";
  const brandColor = isDark ? "text-cyan-400" : "text-indigo-600";
  const buttonHoverText = isDark ? 'hover:text-cyan-400' : 'hover:text-indigo-600';
  
  const cardStyle = `${surfaceBg} rounded-3xl p-8 flex flex-col ${isDark ? 'shadow-[0_0_15px_rgba(255,255,255,0.02)] border border-white/5' : 'shadow-sm'}`;
  const inputStyle = `w-full p-2.5 text-sm border rounded-2xl focus:outline-none transition-colors ${isDark ? 'bg-[#111] border-white/20 text-white focus:border-cyan-400 [&>option]:bg-black [&>option]:text-white' : 'bg-gray-50 border-gray-200 text-gray-800 focus:border-indigo-500 [&>option]:bg-white [&>option]:text-gray-800'}`;

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
    entities: 'Entity Database',
    biometric: 'Biometric Enrollment',
    timetable: 'Schedule / Time Table Management',
    classes: 'Class Management',
    hardware: 'Hardware Scanners',
    reports: 'Reports & Backups',
    logs: 'System Logs',
    settings: 'System Settings',
    attendance: 'Attendance Tracking'
  };

  const Toggle = ({ setting, label }) => {
    const checked = adminSettings[setting];
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => updateSetting(setting, !checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#60a5fa]' : 'bg-gray-200 dark:bg-white/15'}`}
      >
        <span
          className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-slate-950/5 transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'} mt-0.5`}
        />
      </button>
    );
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
            <span className={`${brandColor} font-bold text-lg flex items-center`}>
              {viewTitles[activeView]}
            </span>
          </div>
          
          <div className="flex items-center gap-5">
            <span className={`${mutedText} uppercase tracking-wider text-xs font-semibold hidden md:block`}>{currentDate}</span>
            <div className="relative">
              <button 
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={`${mutedText} ${notificationsOpen ? brandColor : buttonHoverText} transition relative p-2 ml-2`}
              >
                <Bell size={20} />
                <span className={`absolute top-1.5 right-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 border-2 ${isDark ? 'border-black' : 'border-white'}`}></span>
              </button>
              
              {notificationsOpen && (
                <div className={`absolute right-0 top-12 z-50 w-80 rounded-[1.5rem] border ${borderColor} ${surfaceBg} p-4 shadow-xl`}>
                  <div className={`flex items-center justify-between pb-3 mb-3 border-b ${borderColor}`}>
                    <h3 className="text-[15px] font-bold">Notifications</h3>
                    <div className="flex items-center gap-2">
                      <button className={`grid place-items-center w-7 h-7 rounded-full ${subBg} ${hoverBg} ${mutedText} transition`}>
                        <Filter size={13} />
                      </button>
                      <button className="px-3 py-1.5 rounded-full bg-[#4f46e5] text-white text-[11px] font-bold hover:bg-[#4338ca] transition shadow-sm">
                        New Lesson
                      </button>
                    </div>
                  </div>
                  <p className={`text-[13px] ${mutedText} px-1 pb-1`}>No new notifications.</p>
                </div>
              )}
            </div>
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

        <div 
          id="main-scroll-container"
          className={`flex-1 overflow-y-auto px-6 pt-6 pb-6 ${appBg} transition-colors duration-500`}
          onScroll={(e) => {
            const currentScrollY = e.target.scrollTop;
            let searchContainerId, stickyZoneId;

            if (activeView === 'entities') {
              searchContainerId = 'entity-search-container';
              stickyZoneId = 'entity-sticky-zone';
            } else if (activeView === 'attendance') {
              searchContainerId = 'attendance-search-container';
              stickyZoneId = 'attendance-sticky-zone';
            }

            if (searchContainerId && stickyZoneId) {
              const searchContainer = document.getElementById(searchContainerId);
              const stickyZone = document.getElementById(stickyZoneId);
              if (!searchContainer || !stickyZone) return;
              
              const lastScrollY = parseInt(searchContainer.dataset.lastScroll || '0', 10);
              const delta = currentScrollY - lastScrollY;
              
              // Only process significant scroll deltas to avoid micro-jitters
              if (Math.abs(delta) > 5) {
                searchContainer.dataset.lastScroll = currentScrollY;
                const isCollapsed = searchContainer.dataset.collapsed === 'true';
                
                if (currentScrollY < 150) {
                  // Always visible near top
                  if (isCollapsed) {
                    stickyZone.style.transform = 'translateY(0px)';
                    searchContainer.style.opacity = '1';
                    searchContainer.dataset.collapsed = 'false';
                  }
                } else if (delta > 0 && !isCollapsed) {
                  // Scrolling down: visually translate it up instead of changing layout height
                  const h = searchContainer.offsetHeight || 120;
                  stickyZone.style.transform = `translateY(-${h}px)`;
                  searchContainer.style.opacity = '0';
                  searchContainer.dataset.collapsed = 'true';
                } else if (delta < -15 && isCollapsed) {
                  // Scrolling up: uncollapse
                  stickyZone.style.transform = 'translateY(0px)';
                  searchContainer.style.opacity = '1';
                  searchContainer.dataset.collapsed = 'false';
                }
              }
            }
          }}
        >
          <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pt-3">
            
            {activeView === 'dashboard' && (
              <div className="space-y-6 w-full">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-6">
                      <p className={`text-[10px] text-gray-500 font-bold uppercase tracking-widest`}>Total Students</p>
                      <Users className={`w-4 h-4 text-gray-400`} />
                    </div>
                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{adminDashboardData.stats.totalStudents}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-6">
                      <p className={`text-[10px] text-gray-500 font-bold uppercase tracking-widest`}>Active Classes</p>
                      <BookOpen className={`w-4 h-4 text-gray-400`} />
                    </div>
                    <p className="text-4xl font-extrabold text-gray-900 dark:text-white">{adminDashboardData.stats.activeClasses}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-6">
                      <p className={`text-[10px] text-gray-500 font-bold uppercase tracking-widest`}>Present</p>
                    </div>
                    <p className="text-4xl font-extrabold text-[#22c55e]">{adminDashboardData.attendanceTotals.Present}</p>
                  </div>
                  <div className={`${cardStyle} justify-center`}>
                    <div className="flex justify-between items-center mb-6">
                      <p className={`text-[10px] text-gray-500 font-bold uppercase tracking-widest`}>Absent</p>
                    </div>
                    <p className="text-4xl font-extrabold text-[#ef4444]">{adminDashboardData.attendanceTotals.Absent}</p>
                  </div>
                </div>

                <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
                  <div className={`${cardStyle} overflow-hidden`}>
                    <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4 dark:border-white/10">
                      <div>
                        <h3 className="font-extrabold text-gray-900 dark:text-white">Attendance Analytics</h3>
                        <p className={`mt-0.5 text-xs text-gray-500 dark:text-gray-400`}>Weekly system check-in performance</p>
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="relative h-64 pl-9">
                        <div className="absolute inset-y-0 left-9 right-0 flex flex-col justify-between text-[10px] text-slate-400">
                          {[100, 75, 50, 25, 0].map((n) => <div key={n} className="relative border-t border-[#e2e8f0] dark:border-white/10"><span className="absolute -left-9 -top-2">{n}%</span></div>)}
                        </div>
                        <div className="absolute inset-0 left-11 flex items-end justify-around gap-3 pt-4">
                          {(() => {
                            const dates = [];
                            const curr = new Date();
                            const dayOfWeek = curr.getDay(); // 0 is Sun, 1 is Mon
                            const first = curr.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                            for (let i = 0; i < 7; i++) {
                              const day = new Date(curr.getTime());
                              day.setDate(first + i);
                              dates.push(day);
                            }
                            return dates.map((dateObj, i) => {
                              const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                              const d = (adminDashboardData.weeklyData || []).find(wd => {
                                const wdDate = new Date(wd.date);
                                return wdDate.getFullYear() === dateObj.getFullYear() && 
                                       wdDate.getMonth() === dateObj.getMonth() && 
                                       wdDate.getDate() === dateObj.getDate();
                              }) || { present_count: 0, total_count: 0 };
                              
                              const v = d.total_count > 0 ? Math.round((d.present_count / d.total_count) * 100) : 0;
                              const isToday = new Date().getFullYear() === dateObj.getFullYear() && 
                                              new Date().getMonth() === dateObj.getMonth() && 
                                              new Date().getDate() === dateObj.getDate();
                              
                              return (
                                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                                  <span className={`text-[10px] font-bold ${isToday ? 'rounded-md bg-sky-100 px-2 py-1 text-sky-800 shadow-sm' : 'text-slate-500'}`}>{v}%</span>
                                  <div className={`w-full max-w-16 rounded-xl ${isToday ? 'bg-gradient-to-t from-[#3b82f6] to-[#93c5fd] shadow-lg shadow-sky-400/20' : 'bg-[repeating-linear-gradient(135deg,#f1f0f4_0px,#f1f0f4_4px,#e7e5eb_4px,#e7e5eb_6px)] dark:bg-[repeating-linear-gradient(135deg,#20283a_0px,#20283a_4px,#2b3448_4px,#2b3448_6px)]'}`} style={{ height: `${v > 0 ? Math.max(v * 1.75, 4) : 0}px` }} />
                                  <span className={`text-xs font-medium text-slate-500`}>{dateStr}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className={`${cardStyle} overflow-hidden`}>
                      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4 dark:border-white/10">
                        <h3 className="font-extrabold text-gray-900 dark:text-white">Today's Classes</h3>
                        <span className={`flex items-center gap-2 text-xs text-gray-500`}><span className="h-2 w-2 rounded-full bg-emerald-400" />{adminDashboardData.todaysClasses.length} sessions</span>
                      </div>
                      <div className="space-y-3 p-4 h-48 overflow-y-auto custom-scrollbar">
                        {adminDashboardData.todaysClasses.length === 0 ? (
                          <p className={`text-center text-sm text-gray-500 mt-10`}>No classes scheduled for today.</p>
                        ) : adminDashboardData.todaysClasses.map((item, index) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">{item.code.slice(0, 2)}</div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-extrabold text-gray-900 dark:text-white">{item.subject}</p>
                              <p className={`truncate text-xs text-gray-500`}>{item.lecturer}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs font-black text-gray-900 dark:text-white">{item.time.split(' - ')[0]}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <div className={`${cardStyle} overflow-hidden`}>
                      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4 dark:border-white/10">
                        <h3 className="font-extrabold text-gray-900 dark:text-white">Attendance Breakdown</h3>
                        <Fingerprint size={18} className="text-gray-500" />
                      </div>
                      <div className="p-4">
                        <div className="flex h-11 overflow-hidden rounded-lg">
                          <div className="bg-sky-400 transition-all duration-500" style={{ width: `${adminDashboardData.attendanceTotals.total > 0 ? Math.round((adminDashboardData.attendanceTotals.Present / adminDashboardData.attendanceTotals.total) * 100) : 0}%` }} />
                          <div className="bg-sky-200 transition-all duration-500" style={{ width: `${adminDashboardData.attendanceTotals.total > 0 ? Math.round((adminDashboardData.attendanceTotals.Late / adminDashboardData.attendanceTotals.total) * 100) : 0}%` }} />
                          <div className="bg-slate-200 transition-all duration-500 dark:bg-white/10" style={{ width: `${adminDashboardData.attendanceTotals.total > 0 ? Math.round((adminDashboardData.attendanceTotals.Absent / adminDashboardData.attendanceTotals.total) * 100) : 0}%` }} />
                        </div>
                        <div className={`mt-3 flex flex-wrap gap-4 text-[11px] font-semibold text-gray-500`}>
                          <span><b className="mr-1 text-sky-500">■</b>Present {adminDashboardData.attendanceTotals.total > 0 ? Math.round((adminDashboardData.attendanceTotals.Present / adminDashboardData.attendanceTotals.total) * 100) : 0}%</span>
                          <span><b className="mr-1 text-sky-300">■</b>Late {adminDashboardData.attendanceTotals.total > 0 ? Math.round((adminDashboardData.attendanceTotals.Late / adminDashboardData.attendanceTotals.total) * 100) : 0}%</span>
                          <span><b className="mr-1 text-slate-300">■</b>Absent {adminDashboardData.attendanceTotals.total > 0 ? Math.round((adminDashboardData.attendanceTotals.Absent / adminDashboardData.attendanceTotals.total) * 100) : 0}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className={`${cardStyle} mt-4 overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-[#e2e8f0] px-5 py-4 dark:border-white/10">
                    <div>
                      <h3 className="font-extrabold text-gray-900 dark:text-white">Recent Attendance</h3>
                      <p className={`mt-0.5 text-xs text-gray-500`}>Latest system-wide check-ins</p>
                    </div>
                    <button 
                      onClick={() => setActiveView('attendance')}
                      className={`text-sm font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors bg-sky-50 dark:bg-sky-500/10 px-4 py-1.5 rounded-full`}
                    >
                      More
                    </button>
                  </div>
                  <div className="w-full overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
                        <tr>
                          <th className="px-6 py-3 font-semibold tracking-wider">Date & Time</th>
                          <th className="px-6 py-3 font-semibold tracking-wider">Student</th>
                          <th className="px-6 py-3 font-semibold tracking-wider">Course</th>
                          <th className="px-6 py-3 font-semibold tracking-wider text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-white dark:bg-transparent">
                        {adminDashboardData.recentAttendance.length === 0 ? (
                           <tr><td colSpan="4" className="text-center py-6">No recent check-ins found.</td></tr>
                        ) : adminDashboardData.recentAttendance.map(record => (
                          <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-200 font-medium">
                              {new Date(record.time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-gray-200 font-medium">
                              {record.name}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900 dark:text-gray-200">{record.course}</span>
                                <span className="text-xs">{record.coursename}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                record.status === 'Present' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                  : record.status === 'Late'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20'
                              }`}>
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
            
            {/* --- NEW ATTENDANCE VIEW PLACEHOLDER --- */}
            {activeView === 'attendance' && (
              <div className="space-y-6">
                {/* Header */}
                {trackingLevel === 'classes' && (
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h1 className={`text-2xl font-bold ${textColor}`}>Attendance Tracking</h1>
                      <p className={`${mutedText} mt-1`}>
                        Select a class to view attendance sessions.
                      </p>
                    </div>
                  </div>
                )}

                {isTrackingLoading ? (
                  <>
                    {trackingLevel === 'classes' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </div>
                    )}
                    {trackingLevel === 'sessions' && (
                      <div className={`${surfaceBg} border ${borderColor} rounded-xl overflow-hidden shadow-sm`}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                             <tbody>
                               <SkeletonRow cols={5} />
                               <SkeletonRow cols={5} />
                               <SkeletonRow cols={5} />
                             </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {trackingLevel === 'log' && (
                      <div className="flex flex-col gap-6">
                        <div className={`${surfaceBg} border ${borderColor} rounded-xl overflow-hidden shadow-sm`}>
                          <div className={`px-6 py-4 border-b ${borderColor} flex justify-between items-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <div className={`h-4 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded w-48 animate-pulse`}></div>
                            <div className={`h-4 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded w-24 animate-pulse`}></div>
                          </div>
                          <div className="overflow-x-auto p-4">
                            <table className="w-full">
                               <tbody>
                                 <SkeletonRow cols={7} />
                                 <SkeletonRow cols={7} />
                               </tbody>
                            </table>
                          </div>
                        </div>
                        <div className={`${surfaceBg} border ${borderColor} rounded-xl overflow-hidden shadow-sm`}>
                          <div className={`px-6 py-4 border-b ${borderColor} flex justify-between items-center ${isDark ? 'bg-red-500/10' : 'bg-red-50'}`}>
                            <div className={`h-4 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded w-32 animate-pulse`}></div>
                            <div className={`h-4 ${isDark ? 'bg-gray-800' : 'bg-gray-200'} rounded w-24 animate-pulse`}></div>
                          </div>
                          <div className="overflow-x-auto p-4">
                            <table className="w-full">
                               <tbody>
                                 <SkeletonRow cols={3} />
                                 <SkeletonRow cols={3} />
                               </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* LEVEL 1: Classes Grid */}
                    {trackingLevel === 'classes' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {trackingClasses.map(cls => (
                          <div 
                            key={cls.classid} 
                            onClick={() => handleTrackingClassClick(cls)}
                            className={`${surfaceBg} border ${borderColor} rounded-xl p-6 hover:shadow-md cursor-pointer transition transform hover:-translate-y-1`}
                          >
                            <h3 className={`text-lg font-bold ${textColor}`}>{cls.classname}</h3>
                            <p className={`text-sm ${mutedText} mb-4 font-bold`}>{cls.classcode}</p>
                            
                            <div className={`p-4 rounded-lg ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'} mb-4`}>
                              <p className={`text-xs font-semibold ${isDark ? 'text-indigo-400' : 'text-indigo-600'} uppercase mb-1`}>Today's Subject</p>
                              <p className={`font-medium ${textColor}`}>{cls.todaySubject || 'No class scheduled today'}</p>
                            </div>
                            
                            {cls.todaySubject && (
                              <div>
                                <div className="flex justify-between text-sm mb-1">
                                  <span className={mutedText}>Attendance (Today)</span>
                                  <span className={`font-bold ${textColor}`}>
                                    {cls.presentCount} / {cls.total_enrolled}
                                    {cls.lateCount > 0 && <span className="text-yellow-500 ml-1">({cls.lateCount} late)</span>}
                                  </span>
                                </div>
                                <div className={`w-full h-2 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                                  <div 
                                    className="h-2 rounded-full bg-green-500" 
                                    style={{ width: `${cls.total_enrolled > 0 ? (cls.presentCount / cls.total_enrolled) * 100 : 0}%` }}
                                  ></div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {trackingClasses.length === 0 && (
                          <div className={`col-span-full text-center py-12 ${mutedText}`}>No classes found.</div>
                        )}
                      </div>
                    )}

                    {/* LEVEL 2: Sessions List */}
                    {trackingLevel === 'sessions' && (
                      <div className={`${cardStyle} !p-0 flex flex-col`}>
                        <div id="attendance-sticky-zone" className={`sticky -top-6 z-20 rounded-t-3xl transition-transform duration-300 ease-in-out ${isDark ? 'bg-[#111111]' : 'bg-white'}`}>
                          <div id="attendance-search-container" className="transition-opacity duration-300 ease-in-out" style={{ opacity: 1 }}>
                            <div className={`px-8 pt-8 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                              <div>
                                <h3 className="font-extrabold text-[22px]">Attendance Tracking</h3>
                                <p className={`${mutedText} mt-1 text-[13px] font-semibold`}>Viewing recent sessions for {selectedTrackingClass?.classname} ({selectedTrackingClass?.classcode})</p>
                              </div>
                              <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                                <div className="relative flex-1 sm:flex-initial">
                                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                                  <input 
                                    type="text" 
                                    placeholder="Search subject or date..." 
                                    value={sessionSearchQuery}
                                    onChange={(e) => setSessionSearchQuery(e.target.value)}
                                    className={`pl-10 pr-4 py-2 text-[13px] font-semibold border-2 rounded-full focus:outline-none transition-colors w-full sm:w-64 ${isDark ? 'bg-black border-white/10 text-white focus:border-cyan-400' : 'bg-white border-gray-100 text-gray-800 focus:border-indigo-500'}`} 
                                  />
                                </div>
                                <button onClick={() => setTrackingLevel('classes')} className="px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors shadow-sm font-bold text-sm inline-flex items-center gap-2">
                                  <ChevronLeft size={16} /> Back
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className={`border-b-2 ${borderSubColor}`}>
                            <table className="w-full table-fixed text-[13px] text-left whitespace-nowrap">
                              <colgroup>
                                <col className="w-[15%]" />
                                <col className="w-[20%]" />
                                <col className="w-[25%]" />
                                <col className="w-[25%]" />
                                <col className="w-[15%]" />
                              </colgroup>
                              <thead>
                                <tr className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider`}>
                                  <th className="px-4 py-4">Date</th>
                                  <th className="px-4 py-4">Subject</th>
                                  <th className="px-4 py-4">Time</th>
                                  <th className="px-4 py-4">Attendance</th>
                                  <th className="px-4 py-4 text-right">Action</th>
                                </tr>
                              </thead>
                            </table>
                          </div>
                        </div>
                        <div className="overflow-x-auto pb-4">
                          <table className="w-full table-fixed text-[13px] text-left whitespace-nowrap">
                            <colgroup>
                              <col className="w-[15%]" />
                              <col className="w-[20%]" />
                              <col className="w-[25%]" />
                              <col className="w-[25%]" />
                              <col className="w-[15%]" />
                            </colgroup>
                            <tbody className={`divide-y ${borderSubColor}`}>
                              {(() => {
                                const todayStr = new Date().toDateString();
                                const hasToday = trackingSessions.some(s => new Date(s.sessiondate).toDateString() === todayStr);
                                let displayList = [...trackingSessions];
                                
                                if (selectedTrackingClass?.todaySubject && !hasToday) {
                                  displayList.unshift({
                                    sessionid: 'mock-today',
                                    sessiondate: new Date().toISOString(),
                                    subject: selectedTrackingClass.todaySubject,
                                    starttime: '07:00:00',
                                    endtime: '11:00:00',
                                    present_count: selectedTrackingClass.presentCount || 0,
                                    late_count: 0,
                                    total_enrolled: selectedTrackingClass.total_enrolled || 0,
                                    isMock: true
                                  });
                                }
                                
                                const filteredList = displayList.filter(s => (s.subject || '').toLowerCase().includes(sessionSearchQuery.toLowerCase()) || new Date(s.sessiondate).toLocaleDateString().includes(sessionSearchQuery));
                                
                                if (filteredList.length === 0) {
                                  return (
                                    <tr>
                                      <td colSpan="5" className={`px-4 py-8 text-center font-bold ${mutedText} italic`}>No sessions found.</td>
                                    </tr>
                                  );
                                }
                                
                                return filteredList.map(session => {
                                  const isToday = new Date(session.sessiondate).toDateString() === todayStr;
                                  return (
                                    <tr 
                                      key={session.sessionid} 
                                      onClick={() => handleTrackingSessionClick(session)}
                                      className={`${hoverBg} transition-colors group cursor-pointer ${isToday ? (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50/70') : ''}`}
                                    >
                                      <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                                        <div className="flex items-center gap-2">
                                          <span>{new Date(session.sessiondate).toLocaleDateString()}</span>
                                          {isToday && <span className="text-[10px] uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400 px-2 py-0.5 rounded font-extrabold">Today</span>}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 font-bold truncate">{session.subject}</td>
                                      <td className="px-4 py-3 font-bold text-gray-500 dark:text-gray-400">
                                        {session.starttime} - {session.endtime}
                                      </td>
                                      <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-200">
                                        {session.total_enrolled > 0 ? (
                                          <span>
                                            {session.present_count} / {session.total_enrolled}
                                            {session.late_count > 0 && <span className="text-yellow-500 ml-1">({session.late_count} late)</span>}
                                          </span>
                                        ) : 'N/A'}
                                      </td>
                                      <td className="px-4 py-3 font-bold text-right">
                                        <button className="text-indigo-500 hover:text-indigo-600 font-bold transition-colors">View Log &rarr;</button>
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* LEVEL 3: Scan Log */}
                    {trackingLevel === 'log' && (
                      <div className="flex flex-col gap-6">
                        {/* Present/Late Table */}
                        <div className={`${cardStyle} !p-0 flex flex-col`}>
                        <div id="attendance-sticky-zone" className={`sticky -top-6 z-20 rounded-t-3xl transition-transform duration-300 ease-in-out ${isDark ? 'bg-[#111111]' : 'bg-white'}`}>
                          <div id="attendance-search-container" className="transition-opacity duration-300 ease-in-out" style={{ opacity: 1 }}>
                            <div className={`px-8 pt-8 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                              <div>
                                <h3 className="font-extrabold text-[22px]">Attendance Tracking</h3>
                                <p className={`${mutedText} mt-1 text-[13px] font-semibold`}>Live attendance log for {selectedTrackingSession?.subject} on {selectedTrackingSession ? new Date(selectedTrackingSession.sessiondate).toLocaleDateString() : ''}</p>
                              </div>
                              <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                                <div className="flex items-center gap-2 mr-2">
                                  <CustomSelect
                                    value={logSortOption}
                                    onChange={(val) => setLogSortOption(val)}
                                    options={[
                                      { value: 'name_asc', label: 'Name (A-Z)' },
                                      { value: 'name_desc', label: 'Name (Z-A)' },
                                      { value: 'time_desc', label: 'Time In (Latest)' },
                                      { value: 'time_asc', label: 'Time In (Oldest)' },
                                      { value: 'id_asc', label: 'Student ID (Asc)' }
                                    ]}
                                    className={`px-4 py-2 text-[13px] font-semibold border-2 rounded-full focus:outline-none transition-colors ${isDark ? 'bg-black border-white/10 text-white focus:border-cyan-400' : 'bg-white border-gray-100 text-gray-800 focus:border-indigo-500'}`}
                                  />
                                </div>
                                <div className="relative flex-1 sm:flex-initial">
                                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                                  <input 
                                    type="text" 
                                    placeholder="Search student..." 
                                    value={logSearchQuery}
                                    onChange={(e) => setLogSearchQuery(e.target.value)}
                                    className={`pl-10 pr-4 py-2 text-[13px] font-semibold border-2 rounded-full focus:outline-none transition-colors w-full sm:w-64 ${isDark ? 'bg-black border-white/10 text-white focus:border-cyan-400' : 'bg-white border-gray-100 text-gray-800 focus:border-indigo-500'}`} 
                                  />
                                </div>
                                <button onClick={() => setTrackingLevel('sessions')} className="px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors shadow-sm font-bold text-sm inline-flex items-center gap-2">
                                  <ChevronLeft size={16} /> Back
                                </button>
                              </div>
                            </div>
                          </div>
                            
                            <div className={`px-6 py-4 border-t border-b ${borderColor} flex justify-between items-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                              <h3 className={`font-bold ${textColor}`}>Present & Late Students</h3>
                              <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>Total: {trackingLogs.filter(log => log.status !== 'Absent' && (log.fullname.toLowerCase().includes(logSearchQuery.toLowerCase()) || (log.studentid?.toString().includes(logSearchQuery)) || log.eid.toString().includes(logSearchQuery))).length}</span>
                            </div>
                            </div>
                          
                          <div className="overflow-x-auto pb-4">
                            <table className="w-full table-fixed text-[13px] text-left whitespace-nowrap">
                              <colgroup>
                                <col className="w-[15%]" />
                                <col className="w-[30%]" />
                                <col className="w-[15%]" />
                                <col className="w-[15%]" />
                                <col className="w-[25%]" />
                              </colgroup>
                              <thead>
                                <tr className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider border-b-2 ${borderSubColor}`}>
                                  <th className="px-4 py-4">StudentID</th>
                                  <th className="px-4 py-4">Name</th>
                                  <th className="px-4 py-4">Class</th>
                                  <th className="px-4 py-4">Time In</th>
                                  <th className="px-4 py-4">Status</th>
                                </tr>
                              </thead>
                              <tbody className={`divide-y ${borderSubColor}`}>
                                {trackingLogs
                                  .filter(log => log.status !== 'Absent' && (log.fullname.toLowerCase().includes(logSearchQuery.toLowerCase()) || log.studentid?.toString().includes(logSearchQuery) || log.eid.toString().includes(logSearchQuery)))
                                  .sort((a, b) => {
                                    if (logSortOption === 'name_asc') return a.fullname.localeCompare(b.fullname);
                                    if (logSortOption === 'name_desc') return b.fullname.localeCompare(a.fullname);
                                    if (logSortOption === 'time_desc') return new Date(b.attendedat || 0) - new Date(a.attendedat || 0);
                                    if (logSortOption === 'time_asc') return new Date(a.attendedat || 0) - new Date(b.attendedat || 0);
                                    if (logSortOption === 'id_asc') return (a.studentid || a.eid) - (b.studentid || b.eid);
                                    return 0;
                                  })
                                  .map((log, index) => (
                                  <tr key={index} className={`${hoverBg} transition-colors group`}>
                                    <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400">
                                      {log.studentid || log.eid}
                                    </td>
                                    <td className="px-4 py-3 font-bold truncate">{log.fullname}</td>
                                    <td className="px-4 py-3 font-bold truncate">{selectedTrackingClass?.classname || 'Unknown'}</td>
                                    <td className="px-4 py-3 font-bold text-gray-500 dark:text-gray-400">
                                      {log.attendedat ? new Date(log.attendedat).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${log.status === 'Present' ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700') : (isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-700')}`}>
                                          {log.status}
                                        </span>
                                        {log.status === 'Late' && (
                                          <span className={`text-[10px] font-bold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            ({Math.round(log.minutelate || 0)} mins)
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                {trackingLogs.filter(log => log.status !== 'Absent' && (log.fullname.toLowerCase().includes(logSearchQuery.toLowerCase()) || log.studentid?.toString().includes(logSearchQuery) || log.eid.toString().includes(logSearchQuery))).length === 0 && (
                                  <tr>
                                    <td colSpan="5" className={`px-4 py-8 text-center font-bold ${mutedText} italic`}>No scans found.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Absent Table */}
                        <div className={`${cardStyle} !p-0 flex flex-col`}>
                          <div className={`sticky top-0 z-10 rounded-t-3xl ${isDark ? 'bg-[#111111]' : 'bg-white'}`}>
                            <div className={`px-6 py-4 border-b rounded-t-3xl ${borderColor} flex justify-between items-center ${isDark ? 'bg-red-500/5' : 'bg-red-50'}`}>
                              <h3 className={`font-extrabold text-[15px] ${isDark ? 'text-red-400' : 'text-red-700'}`}>Absent Students</h3>
                              <span className={`text-xs px-2 py-1 rounded-full font-bold ${isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}>
                                Total: {trackingLogs.filter(log => log.status === 'Absent' && (log.fullname.toLowerCase().includes(logSearchQuery.toLowerCase()) || log.studentid?.toString().includes(logSearchQuery) || log.eid.toString().includes(logSearchQuery))).length}
                              </span>
                            </div>
                          </div>
                          <div className="overflow-x-auto pb-4">
                              <table className="w-full table-fixed text-[13px] text-left whitespace-nowrap">
                                <colgroup>
                                  <col className="w-[15%]" />
                                  <col className="w-[30%]" />
                                  <col className="w-[15%]" />
                                  <col className="w-[15%]" />
                                  <col className="w-[25%]" />
                                </colgroup>
                                <thead>
                                  <tr className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider border-b-2 ${borderSubColor}`}>
                                    <th className="px-4 py-4">StudentID</th>
                                    <th className="px-4 py-4">Name</th>
                                    <th className="px-4 py-4">Class</th>
                                    <th className="px-4 py-4">Time In</th>
                                    <th className="px-4 py-4">Status</th>
                                  </tr>
                                </thead>
                                <tbody className={`divide-y ${borderSubColor}`}>
                                {trackingLogs
                                  .filter(log => log.status === 'Absent' && (log.fullname.toLowerCase().includes(logSearchQuery.toLowerCase()) || log.studentid?.toString().includes(logSearchQuery) || log.eid.toString().includes(logSearchQuery)))
                                  .sort((a, b) => {
                                    if (logSortOption === 'name_asc') return a.fullname.localeCompare(b.fullname);
                                    if (logSortOption === 'name_desc') return b.fullname.localeCompare(a.fullname);
                                    if (logSortOption === 'time_desc') return new Date(b.attendedat || 0) - new Date(a.attendedat || 0);
                                    if (logSortOption === 'time_asc') return new Date(a.attendedat || 0) - new Date(b.attendedat || 0);
                                    if (logSortOption === 'id_asc') return (a.studentid || a.eid) - (b.studentid || b.eid);
                                    return 0;
                                  })
                                  .map((log, index) => (
                                  <tr key={index} className={`hover:${isDark ? 'bg-red-500/5' : 'bg-red-50'} transition-colors group`}>
                                    <td className="px-4 py-3 font-bold text-red-500 dark:text-red-400">
                                      {log.studentid || log.eid}
                                    </td>
                                    <td className="px-4 py-3 font-bold truncate">{log.fullname}</td>
                                    <td className="px-4 py-3 font-bold truncate">{selectedTrackingClass?.classname || 'Unknown'}</td>
                                    <td className="px-4 py-3 font-bold text-gray-500 dark:text-gray-400">
                                      {log.attendedat ? new Date(log.attendedat).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700'}`}>
                                        Absent
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                                {trackingLogs.filter(log => log.status === 'Absent' && (log.fullname.toLowerCase().includes(logSearchQuery.toLowerCase()) || log.studentid?.toString().includes(logSearchQuery) || log.eid.toString().includes(logSearchQuery))).length === 0 && (
                                  <tr>
                                    <td colSpan="5" className={`px-4 py-8 text-center font-bold ${mutedText} italic`}>No absent students.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeView === 'entities' && (() => {
              const roleData = [
                { name: 'Admin', value: entities.filter(e => e.roleid === 1 || e.rolename?.toLowerCase() === 'admin').length, color: '#ef4444' },
                { name: 'Teacher', value: entities.filter(e => e.roleid === 2 || e.rolename?.toLowerCase() === 'teacher' || e.rolename?.toLowerCase() === 'lecturer').length, color: '#3b82f6' },
                { name: 'Student', value: entities.filter(e => e.roleid === 3 || e.rolename?.toLowerCase() === 'student').length, color: '#22c55e' }
              ].filter(d => d.value > 0);

              const genderData = [
{ name: 'Male', value: entities.filter(e => e.gender?.toLowerCase() === 'male').length, color: '#0ea5e9' },
                { name: 'Female', value: entities.filter(e => e.gender?.toLowerCase() === 'female').length, color: '#ec4899' }
              ].filter(d => d.value > 0);

              return (
              <div className="flex flex-col gap-12">
                {/* Stat Cards — scroll away naturally */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8 shrink-0 h-36">
                  <div className={`${cardStyle} flex flex-col justify-center px-8`}>
                    <div className="flex justify-between items-start">
                      <h4 className={`text-xs font-extrabold uppercase tracking-widest ${mutedText} mb-2`}>Total Entities</h4>
                      <Users className={`w-5 h-5 ${mutedText} opacity-50`} />
                    </div>
                    <span className="text-4xl font-extrabold">{entities.length}</span>
                  </div>

                  <div className={`${cardStyle} flex flex-col justify-center px-8`}>
                    <div className="flex justify-between items-start">
                      <h4 className={`text-xs font-extrabold uppercase tracking-widest ${mutedText} mb-2`}>Total Users</h4>
                      <UserPlus className={`w-5 h-5 ${mutedText} opacity-50`} />
                    </div>
                    <span className="text-4xl font-extrabold">{entities.filter(e => e.userid).length}</span>
                  </div>
                  
                  <div className={`${cardStyle} flex flex-row items-center p-4 px-6`}>
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className={`text-xs font-extrabold uppercase tracking-widest ${mutedText} mb-3`}>Roles</h4>
                      <div className="text-[11px] font-bold space-y-2">
                        {roleData.map(d => (
                          <div key={d.name} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                            <span className={mutedText}>{d.name}:</span>
                            <span>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="w-24 h-24 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={roleData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={45} stroke="none" paddingAngle={2}>
                            {roleData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={`${cardStyle} flex flex-row items-center p-4 px-6`}>
                    <div className="flex-1 flex flex-col justify-center">
                      <h4 className={`text-xs font-extrabold uppercase tracking-widest ${mutedText} mb-3`}>Gender</h4>
                      <div className="text-[11px] font-bold space-y-2">
                        {genderData.map(d => (
                          <div key={d.name} className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                            <span className={mutedText}>{d.name}:</span>
                            <span>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="w-24 h-24 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={25} outerRadius={45} stroke="none" paddingAngle={2}>
                            {genderData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Table card — page scroll, no internal scrollbar */}
                <div className={`${cardStyle} !p-0`}>
                  {/* Sticky zone: Directory bar (collapsible) + column headers (always visible) */}
                  {/* -top-6 perfectly counteracts the pt-6 on the main-scroll-container, eliminating the gap */}
                  <div id="entity-sticky-zone" className={`sticky -top-6 z-20 rounded-t-3xl transition-transform duration-300 ease-in-out ${isDark ? 'bg-[#111111]' : 'bg-white'}`}>
                    <div
                      id="entity-search-container"
                      className="transition-opacity duration-300 ease-in-out"
                      style={{ opacity: 1 }}
                    >
                    <div className={`px-8 pt-8 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4`}>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-[22px]">Directory</h3>
                      </div>
                      <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                        <div className="relative flex-1 sm:flex-initial">
                          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                          <input 
                            type="text" 
                            placeholder="Search (try role=student gender=male)..." 
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
                    </div>
                    {/* Column headers — always visible as part of sticky zone */}
                    <table className="w-full table-fixed text-[13px] text-left whitespace-nowrap">
                      <colgroup>
                        <col className="w-[6%]" />
                        <col className="w-[6%]" />
                        <col className="w-[7%]" />
                        <col className="w-[9%]" />
                        <col className="w-[17%]" />
                        <col className="w-[8%]" />
                        <col className="w-[7%]" />
                        <col className="w-[7%]" />
                        <col className="w-[9%]" />
                        <col className="w-[14%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <thead>
                        <tr className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider border-t border-b-2 ${borderSubColor}`}>
                          <th className="pl-8 pr-4 py-4">Entity ID</th>
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
                    </table>
                  </div>

                  {/* Body table — identical colgroup so columns align perfectly */}
                  <table className="w-full table-fixed text-[13px] text-left whitespace-nowrap">
                      <colgroup>
                        <col className="w-[6%]" />
                        <col className="w-[6%]" />
                        <col className="w-[7%]" />
                        <col className="w-[9%]" />
                        <col className="w-[17%]" />
                        <col className="w-[8%]" />
                        <col className="w-[7%]" />
                        <col className="w-[7%]" />
                        <col className="w-[9%]" />
                        <col className="w-[14%]" />
                        <col className="w-[10%]" />
                      </colgroup>
                      <tbody className={`divide-y ${borderSubColor}`}>
                        {isEntitiesLoading ? (
                          <>
                            <SkeletonRow cols={11} />
                            <SkeletonRow cols={11} />
                            <SkeletonRow cols={11} />
                            <SkeletonRow cols={11} />
                            <SkeletonRow cols={11} />
                          </>
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
                            
                            const roleSpecId = e.roleid === 1 || e.rolename?.toLowerCase() === 'admin' ? 'A' : e.roleid === 2 || e.rolename?.toLowerCase() === 'teacher' ? (e.lecturerid ? `T${String(e.lecturerid).padStart(4, '0')}` : `T${String(e.eid).padStart(4, '0')}`) : (e.studentid ? `S${String(e.studentid).padStart(4, '0')}` : `S${String(e.eid).padStart(4, '0')}`);
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
                              <td className="pl-8 pr-4 py-3 font-bold truncate">{e.eid}</td>
                              <td className="px-4 py-3 font-bold truncate">{e.userid || '-'}</td>
                              <td className="px-4 py-3 font-bold text-indigo-600 dark:text-indigo-400 truncate">{e.roleid === 1 || e.rolename?.toLowerCase() === 'admin' ? 'A' : e.roleid === 2 || e.rolename?.toLowerCase() === 'teacher' ? (e.lecturerid ? `T${String(e.lecturerid).padStart(4, '0')}` : `T${String(e.eid).padStart(4, '0')}`) : (e.studentid ? `S${String(e.studentid).padStart(4, '0')}` : e.roleid ? `S${String(e.eid).padStart(4, '0')}` : '-')}</td>
                              <td className="px-4 py-3 font-bold truncate">{e.username || '-'}</td>
                              <td className="px-4 py-3 font-bold truncate">{e.fullname}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-[10px] font-bold ${e.roleid === 1 ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') : e.roleid === 2 ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700') : (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700')}`}>
                                  {e.rolename || '-'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold truncate">{e.gender || '-'}</td>
                              <td className="px-4 py-3 font-bold truncate">{e.dateofbirth ? new Date(e.dateofbirth).toLocaleDateString() : '-'}</td>
                              <td className="px-4 py-3 font-bold truncate">{e.phonenumber || '-'}</td>
                              <td className="px-4 py-3 font-bold truncate text-gray-500">{e.email || '-'}</td>
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
              )
            })()}

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
                        <th className="px-6 py-4">Date Created</th>
                        <th className="px-6 py-4">Last Active</th>
                        <th className="px-6 py-4 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y border-b ${borderSubColor}`}>
                      {isUsersLoading ? (
                        <>
                          <SkeletonRow cols={7} />
                          <SkeletonRow cols={7} />
                          <SkeletonRow cols={7} />
                        </>
                      ) : filteredUsers.length === 0 ? (
                        <tr><td colSpan="7" className={`text-center py-8 font-bold ${mutedText}`}>No users found matching filters.</td></tr>
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
                            <td className="px-6 py-4 font-bold">{user.createdat}</td>
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
                <div className={`p-6 pb-4 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${borderColor}`}>
                  <div>
                    <h3 className="font-extrabold text-[22px]">Biometric Enrollment</h3>
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
                    <thead className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider border-b-2 ${borderSubColor}`}>
                      <tr>
                        <th className="px-4 py-4">User Details</th>
                        <th className="px-4 py-4">Email</th>
                        <th className="px-4 py-4">Phone Number</th>
                        <th className="px-4 py-4">Fingerprint Status</th>
                        <th className="px-4 py-4 text-right">Management Actions</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${borderSubColor}`}>
                      {isBiometricLoading ? (
                        <>
                          <SkeletonRow cols={5} />
                          <SkeletonRow cols={5} />
                          <SkeletonRow cols={5} />
                        </>
                      ) : biometricStudents.length === 0 ? (
                        <tr><td colSpan="5" className={`text-center py-8 font-bold ${mutedText}`}>No students found.</td></tr>
                      ) : (
                      biometricStudents.map((student) => {
                        const isRegistered = student.biometricid !== null && student.biometricid !== undefined && student.biometricid !== ''; 

                        return (
                          <tr key={student.studentid} className={`${hoverBg} transition-colors group`}>
                            
                            <td className="px-4 py-2">
                              <div>
                                <span className="block font-bold text-[14px] mb-1">{student.fullname}</span>
                                <span className={`text-[11px] font-bold ${mutedText} block`}>ID: {String(student.studentid).padStart(4, '0')}</span>
                              </div>
                            </td>

                            <td className="px-4 py-2">
                              <span className="text-[13px] font-bold">{student.email || '—'}</span>
                            </td>

                            <td className="px-4 py-2">
                              <span className="text-[13px] font-bold">{student.phonenumber || '—'}</span>
                            </td>

                            <td className="px-4 py-2">
                              <div>
                                <span className={`text-[12px] font-bold flex items-center gap-1.5 ${isRegistered ? 'text-green-500' : 'text-red-500'}`}>
                                  {isRegistered ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                  {isRegistered ? 'Registered' : 'Not Registered'}
                                </span>
                                <span className={`text-[11px] ${mutedText} block mt-1`}>
                                  {isRegistered ? `FP-${student.fingerindex}` : '—'}
                                </span>
                              </div>
                            </td>

                            <td className="px-4 py-2 text-right space-x-2">
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
                {!selectedTimetableClass ? (
                  <div>
                    <div className="flex justify-between items-end mb-6">
                      <div>
                        <h3 className="font-bold text-lg">Select a Class for Timetable</h3>
                        <p className={`text-xs ${mutedText} mt-1`}>Manage schedules by selecting a class below.</p>
                      </div>
                    </div>
                    {isClassesLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                      </div>
                    ) : classes.length === 0 ? (
                      <div className="text-center py-10 font-bold text-gray-500">No classes found.</div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classes.map(cls => (
                          <div key={cls.classid} onClick={() => handleTimetableClassClick(cls)} className={`border rounded-xl p-5 cursor-pointer hover:border-indigo-500 transition-colors ${borderSubColor} ${subBg}`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-bold text-lg">{cls.classcode}</p>
                                <p className={`text-xs ${brandColor} font-semibold uppercase tracking-wider`}>{cls.classname}</p>
                              </div>
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
                        <button onClick={() => setSelectedTimetableClass(null)} className={`px-4 py-2 rounded-lg font-bold text-xs text-white shadow-sm transition mb-4 inline-flex items-center gap-1 w-fit ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                          &larr; Back to Classes
                        </button>
                        <h3 className="font-bold text-lg">Timetable: {selectedTimetableClass.classcode}</h3>
                        <p className={`text-xs ${mutedText} mt-1`}>{selectedTimetableClass.classname}</p>
                      </div>
                      <button onClick={openAddScheduleModal} className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                        <CalendarDays size={14} className="mr-1 inline" /> Add Schedule
                      </button>
                    </div>

                    {isTimetableLoading ? (
                       <div className="py-10 text-center text-gray-500 font-bold">Loading schedules...</div>
                    ) : timetableSchedules.length === 0 ? (
                       <div className="py-10 text-center text-gray-500 font-bold border-2 border-dashed rounded-xl">No schedules found for this class.</div>
                    ) : (
                       <div className="overflow-x-auto">
                         <table className={`w-full text-sm border-collapse`}>
                           <thead>
                             <tr className={`${subBg}`}>
                               <th className={`px-4 py-3 text-left text-xs font-bold ${mutedText} uppercase tracking-wider border ${borderSubColor}`}>Time</th>
                               {['Monday','Tuesday','Wednesday','Thursday','Friday'].map(d => (
                                 <th key={d} className={`px-4 py-3 text-left text-xs font-bold ${mutedText} uppercase tracking-wider border ${borderSubColor}`}>{d}</th>
                               ))}
                             </tr>
                           </thead>
                           <tbody>
                             {(() => {
                               const getStartHour = (timeStr) => parseInt(timeStr.split(':')[0], 10);
                               const getDuration = (start, end) => {
                                  const [sh, sm] = start.split(':').map(Number);
                                  const [eh, em] = end.split(':').map(Number);
                                  return Math.max(1, Math.round((eh + em/60) - (sh + sm/60)));
                               };

                               let minHour = 8;
                               let maxHour = 17;
                               if (timetableSchedules.length > 0) {
                                  const startHours = timetableSchedules.map(s => getStartHour(s.starttime));
                                  const endHours = timetableSchedules.map(s => getStartHour(s.starttime) + getDuration(s.starttime, s.endtime));
                                  minHour = Math.min(minHour, ...startHours);
                                  maxHour = Math.max(maxHour, ...endHours);
                               }

                               const rows = [];
                               for (let currentHour = minHour; currentHour < maxHour; currentHour++) {
                                 const hourStr = currentHour.toString().padStart(2, '0') + ':00';
                                 
                                 rows.push(
                                   <tr key={hourStr} className={`${hoverBg} transition-colors`}>
                                     <td className={`px-4 py-3 font-bold text-xs border ${borderSubColor} ${mutedText} align-top whitespace-nowrap`}>{hourStr}</td>
                                     {['Monday','Tuesday','Wednesday','Thursday','Friday'].map(day => {
                                        
                                        const schedCoveringHere = timetableSchedules.find(s => {
                                           if (s.dayofweek !== day) return false;
                                           const startH = getStartHour(s.starttime);
                                           const duration = getDuration(s.starttime, s.endtime);
                                           return currentHour > startH && currentHour < (startH + duration);
                                        });

                                        if (schedCoveringHere) {
                                           return null; // Rendered by a previous rowSpan
                                        }

                                        const schedStartingHere = timetableSchedules.find(s => getStartHour(s.starttime) === currentHour && s.dayofweek === day);

                                        if (schedStartingHere) {
                                           const duration = getDuration(schedStartingHere.starttime, schedStartingHere.endtime);
                                           return (
                                             <td 
                                               key={day} 
                                               rowSpan={duration}
                                               className={`px-4 py-3 border ${borderSubColor} text-sm font-bold cursor-pointer transition ${isDark ? 'text-indigo-200 bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/30' : 'text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border-indigo-200'} align-top relative`}
                                               onClick={() => openEditScheduleModal(schedStartingHere)}
                                             >
                                               <div className="flex flex-col gap-1">
                                                 <span className="text-base">{schedStartingHere.subject}</span>
                                                 <span className={`text-xs opacity-80 ${isDark ? 'text-indigo-300' : 'text-indigo-600'}`}>{schedStartingHere.starttime.substring(0,5)} - {schedStartingHere.endtime.substring(0,5)}</span>
                                                 <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-indigo-500/10">
                                                   <img 
                                                     src={`https://ui-avatars.com/api/?name=${encodeURIComponent(schedStartingHere.teacher_name || 'Unassigned')}&background=random`} 
                                                     className="w-4 h-4 rounded-full opacity-80" 
                                                   />
                                                   <span className="text-[10px] font-bold opacity-80 truncate">{schedStartingHere.teacher_name || 'Unassigned'}</span>
                                                 </div>
                                               </div>
                                             </td>
                                           );
                                        }

                                        return (
                                          <td 
                                            key={day} 
                                            className={`px-4 py-3 border ${borderSubColor} text-sm ${mutedText}`}
                                          >
                                            —
                                          </td>
                                        );
                                     })}
                                   </tr>
                                 );
                               }
                               return rows;
                             })()}
                           </tbody>
                         </table>
                       </div>
                    )}
                  </div>
                )}
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
                        <table className={`w-full text-[12px] text-left whitespace-nowrap border-collapse border ${borderSubColor} ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                          <thead className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider`}>
                            <tr>
                              <th className={`px-3 py-1.5 sticky left-0 z-10 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} border ${borderSubColor}`}>Student Name</th>
                              {attendanceData.sessions.map(s => (
                                <th key={s.sessionid} className={`px-2 py-1.5 text-center border ${borderSubColor}`}>{new Date(s.sessiondate).toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}</th>
                              ))}
                              {Array.from({ length: Math.max(0, 15 - attendanceData.sessions.length) }).map((_, i) => {
                                let startDate = new Date();
                                if (attendanceData.sessions.length > 0) {
                                  startDate = new Date(attendanceData.sessions[attendanceData.sessions.length - 1].sessiondate);
                                  startDate.setDate(startDate.getDate() + 7);
                                } else {
                                  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                  const targetDayIndex = days.indexOf(selectedSchedule?.dayofweek);
                                  if (targetDayIndex !== -1) {
                                    while (startDate.getDay() !== targetDayIndex) startDate.setDate(startDate.getDate() + 1);
                                  }
                                }
                                const nextDate = new Date(startDate);
                                nextDate.setDate(startDate.getDate() + (i * 7));
                                return (
                                  <th key={`empty-th-${i}`} className={`px-2 py-1.5 text-center border ${borderSubColor} min-w-[80px]`}>
                                    {nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {attendanceData.students.map(student => (
                              <tr key={student.studentid} className={`${hoverBg} transition-colors group`}>
                                <td className={`px-3 py-1.5 font-bold sticky left-0 z-10 ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'} border ${borderSubColor}`}>
                                  {student.fullname}
                                </td>
                                {attendanceData.sessions.map(session => {
                                  const key = `${student.studentid}_${session.sessionid}`;
                                  const isEdited = !!editedAttendance[key];
                                  const record = attendanceData.attendance.find(a => a.studentid === student.studentid && a.sessionid === session.sessionid);
                                  const currentStatus = isEdited ? editedAttendance[key].status : (record ? record.status : '-');
                                  
                                  let statusColor = mutedText;
                                  if (currentStatus === 'Present') statusColor = isDark ? 'text-green-400' : 'text-green-600';
                                  else if (currentStatus === 'Absent') statusColor = isDark ? 'text-red-400' : 'text-red-600';
                                  else if (currentStatus === 'Late') statusColor = isDark ? 'text-yellow-400' : 'text-amber-500';
                                  else if (currentStatus === 'Permission') statusColor = isDark ? 'text-blue-400' : 'text-blue-600';
                                  
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
                                {Array.from({ length: Math.max(0, 15 - attendanceData.sessions.length) }).map((_, i) => (
                                  <td key={`empty-td-${i}`} className={`px-2 py-1.5 border ${borderSubColor}`}>
                                    <span className="opacity-0 select-none">-</span>
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {attendanceData.students.length === 0 && (
                              <tr><td colSpan={Math.max(15, attendanceData.sessions.length) + 1} className="text-center py-6 font-bold text-gray-500">No students enrolled.</td></tr>
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
                      <button onClick={() => setShowCreateClassModal(true)} className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}><Plus size={16} className="inline mr-1" /> Create Class</button>
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

                {showCreateClassModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`${surfaceBg} rounded-3xl p-8 w-full max-w-md shadow-2xl border ${borderColor}`}>
                      <h3 className={`text-xl font-bold mb-6 ${textColor}`}>Create New Class</h3>
                      <form onSubmit={handleCreateClassSubmit} className="space-y-4">
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Class Code</label>
                          <input type="text" value={newClass.classcode} onChange={(e) => setNewClass({...newClass, classcode: e.target.value})} className={inputStyle} placeholder="e.g. DSE-M3" required />
                        </div>
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Class Name</label>
                          <input type="text" value={newClass.classname} onChange={(e) => setNewClass({...newClass, classname: e.target.value})} className={inputStyle} placeholder="e.g. Software Engineering Cohort 3" required />
                        </div>
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Major</label>
                          <select value={newClass.majorid} onChange={(e) => setNewClass({...newClass, majorid: e.target.value})} className={inputStyle} required>
                            <option value="">Select Major...</option>
                            {majors.map(m => (
                              <option key={m.majorid} value={m.majorid}>{m.majorname}</option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Academic Year</label>
                            <input type="text" value={newClass.academicyear} onChange={(e) => setNewClass({...newClass, academicyear: e.target.value})} className={inputStyle} placeholder="2025-2026" required />
                          </div>
                          <div>
                            <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Semester</label>
                            <input type="number" min="1" max="10" value={newClass.semester} onChange={(e) => setNewClass({...newClass, semester: e.target.value})} className={inputStyle} required />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                          <button type="button" onClick={() => setShowCreateClassModal(false)} className={`px-5 py-2.5 rounded-xl font-semibold transition-colors ${subBg} ${textColor} hover:bg-gray-200 dark:hover:bg-gray-800`}>Cancel</button>
                          <button type="submit" className={`px-5 py-2.5 rounded-xl font-semibold text-white transition-colors ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Create Class</button>
                        </div>
                      </form>
                    </div>
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
                  <button onClick={() => setShowRegisterDeviceModal(true)} className={`px-4 py-2 rounded-lg font-bold text-sm text-white shadow-sm transition ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-500 hover:bg-indigo-600'}`}><i className="fas fa-plus mr-1"></i> Register Device</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {hardwareDevices.length === 0 ? (
                    <div className={`col-span-full py-8 text-center ${mutedText}`}>No registered devices found.</div>
                  ) : (
                    hardwareDevices.map((device) => (
                      <div key={device.deviceid} className={`border rounded-xl p-5 flex flex-col justify-between ${borderSubColor} ${subBg}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="font-bold text-lg">{device.deviceName || device.devicename || `Device #${device.deviceid}`}</p>
                            <p className={`text-xs ${mutedText} mt-0.5`}><i className="fas fa-map-marker-alt mr-1"></i> {device.location || 'Main Entrance'}</p>
                          </div>
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1.5 ${device.online ? (isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700') : (isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700')}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${device.online ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span> {device.online ? 'ONLINE' : 'OFFLINE'}
                          </span>
                        </div>
                        <div className={`pt-4 border-t ${borderSubColor} flex justify-between text-xs`}>
                          <span className={mutedText}>Last Sync: {device.lastSync ? new Date(device.lastSync).toLocaleTimeString() : (device.lastseen ? new Date(device.lastseen).toLocaleTimeString() : 'Never')}</span>
                          <button onClick={() => { setEditingDevice({ deviceid: device.deviceid, devicename: device.deviceName || device.devicename || '', location: device.location || '' }); setShowConfigureDeviceModal(true); }} className={`font-bold hover:underline ${brandColor}`}>Configure</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {showRegisterDeviceModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`${surfaceBg} rounded-3xl p-8 w-full max-w-md shadow-2xl border ${borderColor}`}>
                      <h3 className={`text-xl font-bold mb-6 ${textColor}`}>Register New Scanner</h3>
                      <form onSubmit={handleRegisterDeviceSubmit} className="space-y-4">
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Device Name / Model</label>
                          <input type="text" value={newDevice.devicename} onChange={(e) => setNewDevice({...newDevice, devicename: e.target.value})} className={inputStyle} placeholder="e.g. AS608-Hallway" required />
                        </div>
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Location</label>
                          <input type="text" value={newDevice.location} onChange={(e) => setNewDevice({...newDevice, location: e.target.value})} className={inputStyle} placeholder="e.g. Main Entrance" required />
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                          <button type="button" onClick={() => setShowRegisterDeviceModal(false)} className={`px-5 py-2.5 rounded-xl font-semibold transition-colors ${subBg} ${textColor} hover:bg-gray-200 dark:hover:bg-gray-800`}>Cancel</button>
                          <button type="submit" className={`px-5 py-2.5 rounded-xl font-semibold text-white transition-colors ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Register Scanner</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {showConfigureDeviceModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className={`${surfaceBg} rounded-3xl p-8 w-full max-w-md shadow-2xl border ${borderColor}`}>
                      <h3 className={`text-xl font-bold mb-6 ${textColor}`}>Configure Scanner</h3>
                      <form onSubmit={handleConfigureDeviceSubmit} className="space-y-4">
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Device Name / Model</label>
                          <input type="text" value={editingDevice.devicename} onChange={(e) => setEditingDevice({...editingDevice, devicename: e.target.value})} className={inputStyle} required />
                        </div>
                        <div>
                          <label className={`block text-xs font-bold mb-1.5 ${mutedText} uppercase tracking-wider`}>Location</label>
                          <input type="text" value={editingDevice.location} onChange={(e) => setEditingDevice({...editingDevice, location: e.target.value})} className={inputStyle} required />
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                          <button type="button" onClick={() => setShowConfigureDeviceModal(false)} className={`px-5 py-2.5 rounded-xl font-semibold transition-colors ${subBg} ${textColor} hover:bg-gray-200 dark:hover:bg-gray-800`}>Cancel</button>
                          <button type="submit" className={`px-5 py-2.5 rounded-xl font-semibold text-white transition-colors ${isDark ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}>Save Changes</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeView === 'reports' && (
              <div className="flex flex-col gap-6">
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
                      <button onClick={() => handleGenerateReport('CSV')} className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-csv text-xl"></i> CSV</button>
                      <button onClick={() => handleGenerateReport('Excel')} className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-excel text-xl"></i> Excel</button>
                      <button onClick={() => handleGenerateReport('PDF')} className={`py-3 rounded-lg font-bold text-sm transition flex flex-col items-center gap-2 ${subBg} ${hoverBg} ${borderSubColor} border`}><i className="fas fa-file-pdf text-xl"></i> PDF</button>
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

                {/* Recent Backups */}
                <div className={`${cardStyle} !p-0 overflow-hidden`}>
                  <div className={`p-6 pb-4 border-b flex justify-between items-center ${borderSubColor}`}>
                    <h3 className="font-bold text-lg">Recent Backups</h3>
                    <button className={`px-3 py-1.5 rounded-lg text-xs font-bold ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} transition`}>Select All</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left whitespace-nowrap">
                      <thead className={`text-[10px] font-extrabold ${mutedText} uppercase tracking-wider border-b-2 ${borderSubColor}`}>
                        <tr>
                          <th className="px-6 py-4">Backup ID</th>
                          <th className="px-6 py-4">File Name</th>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Size</th>
                          <th className="px-6 py-4"></th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${borderSubColor}`}>
                        {[
                          { id: 1, name: 'backup_2026-07-15_1200.sql', date: '7/15/2026, 12:00 PM', size: '15.4 MB' },
                          { id: 2, name: 'backup_2026-07-14_1200.sql', date: '7/14/2026, 12:00 PM', size: '15.2 MB' },
                          { id: 3, name: 'backup_2026-07-13_1200.sql', date: '7/13/2026, 12:00 PM', size: '14.9 MB' },
                        ].map(backup => (
                          <tr key={backup.id} className={`${hoverBg} transition-colors`}>
                            <td className="px-6 py-4 font-bold">{backup.id}</td>
                            <td className="px-6 py-4 font-bold">{backup.name}</td>
                            <td className="px-6 py-4 text-xs font-semibold">{backup.date}</td>
                            <td className="px-6 py-4 text-xs font-semibold">{backup.size}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <div className={`w-4 h-4 rounded bg-gray-600 dark:bg-gray-400 cursor-pointer transition hover:opacity-80`}></div>
                                <button className={`p-1 rounded-lg ${mutedText} hover:bg-gray-100 dark:hover:bg-white/5`}><MoreVertical size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeView === 'logs' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 h-full flex flex-col pb-6">
                <div className="bg-[#181a1f] rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full flex-1 min-h-[calc(100vh-150px)]">
                  {/* Console Header */}
                  <div className="bg-[#21252b] px-6 py-4 flex items-center justify-between border-b border-[#181a1f]">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveTerminalTab('log')} className={`${activeTerminalTab === 'log' ? 'bg-[#3a3f4b] text-white' : 'text-gray-400 hover:bg-[#3a3f4b]/50 hover:text-white'} text-[12px] font-bold px-4 py-2 rounded-md transition`}>Log ({terminalLogs.filter(l => !['ADMIN_QUERY', 'SUCCESS', 'ERROR'].includes(l.action)).length})</button>
                      <button onClick={() => setActiveTerminalTab('query')} className={`${activeTerminalTab === 'query' ? 'bg-[#3a3f4b] text-white' : 'text-gray-400 hover:bg-[#3a3f4b]/50 hover:text-white'} text-[12px] font-bold px-4 py-2 rounded-md transition`}>Query ({terminalLogs.filter(l => ['ADMIN_QUERY', 'SUCCESS', 'ERROR'].includes(l.action)).length})</button>
                      <div className="w-px h-4 bg-gray-700 mx-2"></div>
                      <button className="text-gray-400 hover:text-white text-[12px] font-bold px-2 py-1 transition">Refresh</button>
                    </div>
                    <div className="flex items-center gap-4 text-gray-500">
                      <Trash2 size={16} className="cursor-pointer hover:text-white transition" />
                      <Copy size={16} className="cursor-pointer hover:text-white transition" />
                      <Maximize size={16} className="cursor-pointer hover:text-white transition" />
                    </div>
                  </div>
                  
                  {/* Console Body */}
                  <div className="p-6 overflow-y-auto custom-scrollbar flex-1 font-mono text-[14px] leading-[1.5] flex flex-col tracking-tight select-text">
                    {terminalLogs.filter(log => activeTerminalTab === 'query' ? ['ADMIN_QUERY', 'SUCCESS', 'ERROR'].includes(log.action) : !['ADMIN_QUERY', 'SUCCESS', 'ERROR'].includes(log.action)).map((log, i) => (
                      <div key={i} className={`${log.color} whitespace-pre-wrap`}>
                        [{log.time}] [{log.action}]: {log.msg}
                      </div>
                    ))}
                    <div ref={terminalEndRef} />
                  </div>

                  {/* Input Bar */}
                  {activeTerminalTab === 'query' && (
                  <div className="px-6 pb-6 pt-0">
                    <div className="bg-[#21252b] rounded-lg border border-[#3a3f4b] px-4 py-3 flex items-center justify-between group focus-within:border-[#528bff] transition-colors">
                      <div className="flex items-center gap-3 text-gray-500 text-[14px] w-full font-mono">
                        <span className="font-bold opacity-50">&gt;&gt;</span>
                        <input 
                          type="text" 
                          placeholder="Type a SQL query to execute..." 
                          value={terminalInput}
                          onChange={(e) => setTerminalInput(e.target.value)}
                          onKeyDown={handleTerminalSubmit}
                          className="bg-transparent outline-none border-none flex-1 text-white placeholder-gray-600 focus:placeholder-gray-700" 
                        />
                      </div>
                      <Clock size={16} className="text-gray-500 cursor-pointer hover:text-white transition shrink-0" />
                    </div>
                  </div>
                  )}
                </div>
              </div>
            )}

            {activeView === 'settings' && (
              <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
                <div>
                  <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">Preferences</p>
                  <h2 className={`text-2xl font-black tracking-tight ${textColor}`}>Settings</h2>
                  <p className={`mt-1 text-sm ${mutedText}`}>Manage notifications, appearance, attendance preferences, and account security.</p>
                </div>

                <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
                  <section className={`${cardStyle} overflow-hidden !p-0`}>
                    <div className={`flex items-center gap-3 border-b ${borderColor} p-5`}>
                      <span className={`grid h-10 w-10 place-items-center rounded-xl ${isDark ? 'bg-sky-400/10 text-sky-300' : 'bg-sky-50 text-[#3b82f6]'}`}><Bell size={19} /></span>
                      <div><h3 className="font-extrabold">Attendance notifications</h3><p className={`mt-0.5 text-xs ${mutedText}`}>Choose which updates you want to receive.</p></div>
                    </div>
                    <div className={`divide-y ${borderColor} px-5`}>
                      {[
                        ['checkInReminders', 'Class check-in reminders', 'Notify me before fingerprint check-in opens.'],
                        ['missedAttendanceAlerts', 'Missed attendance alerts', 'Let me know when a class is marked absent or unverified.'],
                        ['excuseUpdates', 'Excuse request updates', 'Receive a notification when a teacher reviews my request.'],
                        ['weeklySummary', 'Weekly attendance summary', 'Get a short attendance recap at the end of each week.'],
                      ].map(([setting, title, copy]) => (
                        <div key={setting} className="flex items-center justify-between gap-5 py-4">
                          <div><p className="text-sm font-bold">{title}</p><p className={`mt-1 text-xs leading-5 ${mutedText}`}>{copy}</p></div>
                          <Toggle setting={setting} label={title} />
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="space-y-5">
                    <section className={`${cardStyle} p-5`}>
                      <div className="flex items-center gap-3">
                        <span className={`grid h-10 w-10 place-items-center rounded-xl ${isDark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-600'}`}><Fingerprint size={19} /></span>
                        <div><h3 className="font-extrabold">Fingerprint status</h3><p className={`mt-0.5 text-xs ${mutedText}`}>Your attendance identity</p></div>
                      </div>
                      <div className={`mt-4 flex items-center justify-between rounded-xl p-3 ${isDark ? 'bg-emerald-400/[0.08]' : 'bg-emerald-50/70'}`}>
                        <span className={`flex items-center gap-2 text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}><CheckCircle2 size={15} />Enrolled and ready</span>
                        <span className={`text-[10px] ${mutedText}`}>Verified</span>
                      </div>
                      <button className={`mt-3 w-full rounded-xl border py-2.5 text-xs font-bold transition ${isDark ? 'border-white/10 hover:border-[#60a5fa] hover:text-[#60a5fa]' : 'border-[#e2e8f0] hover:border-[#60a5fa] hover:text-[#2563eb]'}`}>View student profile</button>
                    </section>

                    <section className={`${cardStyle} p-5`}>
                      <div className="flex items-center gap-3">
                        <span className={`grid h-10 w-10 place-items-center rounded-xl ${isDark ? 'bg-white/10 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><ShieldCheck size={19} /></span>
                        <div className="flex-1"><h3 className="font-extrabold">Login alerts</h3><p className={`mt-0.5 text-xs ${mutedText}`}>Notify me about new device sign-ins.</p></div>
                        <Toggle setting="loginAlerts" label="Login alerts" />
                      </div>
                    </section>
                  </div>
                </div>

                <section className={`${cardStyle} overflow-hidden !p-0`}>
                  <div className={`border-b ${borderColor} p-5 flex items-center gap-3`}>
                    <span className={`grid h-10 w-10 place-items-center rounded-xl ${isDark ? 'bg-violet-400/10 text-violet-300' : 'bg-violet-50 text-violet-600'}`}><Shield size={19} /></span>
                    <div><h3 className="font-extrabold">Account security</h3><p className={`mt-1 text-xs ${mutedText}`}>Protect your dashboard and sign-in details.</p></div>
                  </div>
                  <div className={`divide-y ${borderColor} px-5`}>
                    <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <KeyRound size={16} className={isDark ? 'text-violet-300' : 'text-violet-500'} />
                        <div><p className="text-sm font-bold">Change password</p><p className={`mt-1 text-xs ${mutedText}`}>Use at least 8 characters and avoid reused passwords.</p></div>
                      </div>
                      <button className={`rounded-xl border px-4 py-2 text-xs font-bold transition ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-[#e2e8f0] hover:bg-slate-50'}`}>Change password</button>
                    </div>
                    <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        <svg className={`w-4 h-4 ${isDark ? 'text-violet-300' : 'text-violet-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <div><p className="text-sm font-bold flex items-center gap-2">Two-step verification <span className={`text-[9px] px-1.5 py-0.5 rounded ${isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Off</span></p><p className={`mt-1 text-xs ${mutedText}`}>Confirm sign-ins with a six-digit code sent to your email.</p></div>
                      </div>
                      <button className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-violet-700">Set up</button>
                    </div>
                  </div>
                </section>

                <section className={`${cardStyle} overflow-hidden !p-0`}>
                  <div className={`border-b ${borderColor} p-5`}><h3 className="font-extrabold">My preferences</h3><p className={`mt-1 text-xs ${mutedText}`}>Personalize how the portal works for you.</p></div>
                  <div className={`divide-y ${borderColor} px-5`}>
                    <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-bold">Appearance</p><p className={`mt-1 text-xs ${mutedText}`}>Choose a bright campus-inspired theme.</p></div>
                      <div className="flex gap-2">
                        {[{ dark: false, label: 'Daylight', icon: Sun }, { dark: true, label: 'Soft sky', icon: Moon }].map(({ dark, label, icon }) => (
                          <button key={label} onClick={() => setIsDark(dark)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${isDark === dark ? 'border-[#60a5fa] bg-sky-50 text-sky-800 dark:bg-sky-400/10 dark:text-sky-300' : `border-[#e2e8f0] text-slate-600 hover:border-[#60a5fa] ${isDark ? 'border-white/10 text-slate-400' : ''}`}`}>{React.createElement(icon, { size: 15 })}{label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-bold">Class reminder time</p><p className={`mt-1 text-xs ${mutedText}`}>When should the portal remind you about your next class?</p></div>
                      <select value={adminSettings.reminderTime} onChange={(event) => updateSetting('reminderTime', event.target.value)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold outline-none focus:border-[#60a5fa] bg-transparent ${isDark ? 'border-white/10 text-slate-300 [&>option]:bg-slate-900' : 'border-[#e2e8f0] text-slate-700'}`}>
                        {['5 minutes before', '15 minutes before', '30 minutes before', '1 hour before'].map((value) => <option key={value}>{value}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div><p className="text-sm font-bold">Language</p><p className={`mt-1 text-xs ${mutedText}`}>Choose your preferred dashboard language.</p></div>
                      <select value={adminSettings.language} onChange={(event) => updateSetting('language', event.target.value)} className={`rounded-xl border px-3 py-2.5 text-xs font-bold outline-none focus:border-[#60a5fa] bg-transparent ${isDark ? 'border-white/10 text-slate-300 [&>option]:bg-slate-900' : 'border-[#e2e8f0] text-slate-700'}`}>
                        <option>English</option><option>Khmer</option>
                      </select>
                    </div>
                  </div>
                </section>

                <section className={`${cardStyle} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
                  <div><h3 className="font-extrabold">Account session</h3><p className={`mt-1 text-xs ${mutedText}`}>You are signed in on this device. Sign out safely when you are finished.</p></div>
                  <button onClick={onLogout} className={`flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${isDark ? 'bg-rose-400/10 text-rose-300 hover:bg-rose-400/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}><LogOut size={16} />Sign out</button>
                </section>
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
              <label className={`block text-xs font-bold mb-2 ${mutedText}`}>MANUAL ENTRY</label>
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
                  <p className="text-sm">All students are already enrolled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${mutedText}`} />
                    <input 
                      type="text" 
                      placeholder="Search students (try gender=male)..." 
                      value={enrollListSearchQuery}
                      onChange={(e) => setEnrollListSearchQuery(e.target.value)}
                      className={`w-full pl-9 pr-4 py-2 text-sm border rounded-2xl focus:outline-none transition-colors ${isDark ? 'bg-black border-white/10 text-white focus:border-cyan-400' : 'bg-white border-gray-200 text-gray-800 focus:border-indigo-500'}`} 
                    />
                  </div>
                  <div className="space-y-2">
                  {unenrolledStudents
                    .filter(s => {
                      const parts = enrollListSearchQuery.split(' ');
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
                      
                      if (filters.gender && (!s.gender || s.gender.toLowerCase() !== filters.gender)) return false;
                      if (text && !s.fullname.toLowerCase().includes(text) && !String(s.studentid).toLowerCase().includes(text)) return false;
                      
                      return true;
                    })
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

      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`${cardStyle} max-w-md w-full flex flex-col p-0`}>
            <div className={`p-4 border-b ${borderSubColor} flex justify-between items-center`}>
              <h2 className="text-lg font-bold">{editingSchedule ? 'Edit Schedule' : 'Add Schedule'}</h2>
              <button onClick={() => setShowScheduleModal(false)} className={`${mutedText} hover:text-red-500 transition`}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={`block text-xs font-bold mb-2 ${mutedText}`}>SUBJECT / MODULE</label>
                <input 
                  type="text" 
                  value={scheduleFormData.subject}
                  onChange={e => setScheduleFormData({...scheduleFormData, subject: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${borderSubColor} bg-transparent outline-none focus:border-indigo-500`}
                  placeholder="e.g. CS-101"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-bold mb-2 ${mutedText}`}>START TIME</label>
                  <input 
                    type="time" 
                    value={scheduleFormData.starttime}
                    onChange={e => setScheduleFormData({...scheduleFormData, starttime: e.target.value})}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${borderSubColor} bg-transparent outline-none focus:border-indigo-500 ${isDark ? '[color-scheme:dark]' : ''}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-bold mb-2 ${mutedText}`}>END TIME</label>
                  <input 
                    type="time" 
                    value={scheduleFormData.endtime}
                    onChange={e => setScheduleFormData({...scheduleFormData, endtime: e.target.value})}
                    className={`w-full px-3 py-2 rounded-lg text-sm border ${borderSubColor} bg-transparent outline-none focus:border-indigo-500 ${isDark ? '[color-scheme:dark]' : ''}`}
                  />
                </div>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-2 ${mutedText}`}>DAY OF WEEK</label>
                <select 
                  value={scheduleFormData.dayofweek}
                  onChange={e => setScheduleFormData({...scheduleFormData, dayofweek: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${borderSubColor} bg-transparent outline-none focus:border-indigo-500 ${isDark ? 'text-white [&>option]:bg-[#1e1e1e]' : ''}`}
                >
                  {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-xs font-bold mb-2 ${mutedText}`}>ASSIGNED TEACHER</label>
                <select 
                  value={scheduleFormData.teacherid}
                  onChange={e => setScheduleFormData({...scheduleFormData, teacherid: e.target.value})}
                  className={`w-full px-3 py-2 rounded-lg text-sm border ${borderSubColor} bg-transparent outline-none focus:border-indigo-500 ${isDark ? 'text-white [&>option]:bg-[#1e1e1e]' : ''}`}
                >
                  <option value="">-- Unassigned --</option>
                  {entities.filter(e => e.roleid === 2).map(t => (
                    <option key={t.eid} value={t.eid}>{t.fullname}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={`p-4 border-t ${borderSubColor} flex justify-between gap-2`}>
              {editingSchedule ? (
                <button 
                  onClick={() => {
                    handleDeleteSchedule(editingSchedule.scheduleid);
                    setShowScheduleModal(false);
                  }}
                  className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition ${isDark ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' : 'bg-red-50 hover:bg-red-100 text-red-600'}`}
                >
                  Delete
                </button>
              ) : <div></div>}
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowScheduleModal(false)}
                  className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveSchedule}
                  disabled={isSavingSchedule || !scheduleFormData.subject || !scheduleFormData.starttime || !scheduleFormData.endtime}
                  className={`px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition text-white ${isDark ? 'bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50' : 'bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50'}`}
                >
                  {isSavingSchedule ? 'Saving...' : (editingSchedule ? 'Save Changes' : 'Create Schedule')}
                </button>
              </div>
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
                <input required type="text" value={newEntity.fullname} onChange={e => setNewEntity({...newEntity, fullname: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} ${isDark ? 'bg-[#111]' : 'bg-white'}`} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Role</label>
                <CustomSelect
                  value={newEntity.roleid}
                  onChange={val => setNewEntity({...newEntity, roleid: parseInt(val)})}
                  options={[
                    {value: 1, label: 'Admin'},
                    {value: 2, label: 'Teacher'},
                    {value: 3, label: 'Student'}
                  ]}
                  className={`w-full px-3 py-2 rounded-2xl border ${borderSubColor} ${isDark ? 'bg-[#111]' : 'bg-white'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Gender</label>
                <CustomSelect
                  value={newEntity.gender}
                  onChange={val => setNewEntity({...newEntity, gender: val})}
                  options={[
                    {value: 'Male', label: 'Male'},
                    {value: 'Female', label: 'Female'},
                    {value: 'Other', label: 'Other'}
                  ]}
                  className={`w-full px-3 py-2 rounded-2xl border ${borderSubColor} ${isDark ? 'bg-[#111]' : 'bg-white'}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Date of Birth</label>
                <input type="date" value={newEntity.dateofbirth} onChange={e => setNewEntity({...newEntity, dateofbirth: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} ${isDark ? 'bg-[#111]' : 'bg-white'}`} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Phone Number</label>
                <input type="text" value={newEntity.phonenumber} onChange={e => setNewEntity({...newEntity, phonenumber: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} ${isDark ? 'bg-[#111]' : 'bg-white'}`} />
              </div>
              <div className="col-span-full border-t border-dashed my-2 pt-2 border-gray-300 dark:border-white/10">
                <p className="text-xs font-bold text-gray-500 mb-2">USER ACCOUNT (Optional)</p>
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Username</label>
                <input type="text" value={newEntity.username} onChange={e => setNewEntity({...newEntity, username: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} ${isDark ? 'bg-[#111]' : 'bg-white'}`} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">Email</label>
                <input type="email" value={newEntity.email} onChange={e => setNewEntity({...newEntity, email: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} ${isDark ? 'bg-[#111]' : 'bg-white'}`} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1">{editingEntity ? 'New Password (leave blank to keep current)' : 'Password'}</label>
                <input type={editingEntity ? "text" : "password"} value={newEntity.password} onChange={e => setNewEntity({...newEntity, password: e.target.value})} className={`w-full px-3 py-2 rounded-lg border ${borderSubColor} ${isDark ? 'bg-[#111]' : 'bg-white'}`} />
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
