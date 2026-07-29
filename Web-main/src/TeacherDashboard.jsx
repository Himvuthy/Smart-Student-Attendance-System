import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BarChart3, Bell, BookOpen, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Camera, Clock3, Download, FileCheck2, FileText, Fingerprint, HelpCircle, LayoutDashboard, LogOut,
  MapPin, Menu, Moon, MoreHorizontal, Play, Search, Settings, ShieldCheck, Square, Sun,
  TriangleAlert, UserRound, Users, X, XCircle,
} from 'lucide-react';
import AccountSecurity from './AccountSecurity';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import { EXCUSE_CACHE_KEY, fetchExcuseRequests, readExcuseCache, reviewExcuseRequest, writeExcuseCache } from './excuseRequests';
import { OFFICIAL_TIMETABLE_KEY, readOfficialTimetable } from './officialTimetable';
import { ATTENDANCE_CORRECTIONS_KEY, readAttendanceCorrections, reviewAttendanceCorrection } from './attendanceCorrections';
import { downloadCsv } from './csvExport';

// Mock constants removed in favor of live DB fetches

const navGroups = [
  {
    label: 'Teaching',
    items: [
      ['dashboard', 'Overview', LayoutDashboard],
      ['classes', 'My classes', BookOpen],
      ['takeAttendance', 'Take attendance', Fingerprint],
      ['records', 'Attendance records', CalendarDays],
    ],
  },
  {
    label: 'Management',
    items: [
      ['excuses', 'Excuse reviews', FileCheck2],
      ['schedule', 'Teaching schedule', Clock3],
      ['reports', 'Reports', BarChart3],
    ],
  },
];

const viewNames = {
  dashboard: 'Overview', classes: 'My classes', takeAttendance: 'Take attendance',
  records: 'Attendance records', excuses: 'Excuse reviews', schedule: 'Teaching schedule',
  reports: 'Reports', profile: 'My profile', settings: 'Settings',
};

const teacherViews = new Set(Object.keys(viewNames));
const API_BASE = import.meta.env.VITE_API_URL || 'https://smart-student-attendance-system-nkka.onrender.com';

const TeacherDashboard = ({ onLogout }) => {
  const [activeView, setActiveView] = useState(() => {
    const saved = localStorage.getItem('teacherActiveView');
    return teacherViews.has(saved) ? saved : 'dashboard';
  });
  const [isDark, setIsDark] = useState(() => localStorage.getItem('appTheme') === 'soft-sky');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('teacherSidebarCollapsed') === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [requestToast, setRequestToast] = useState('');
  const [seenRequestIds, setSeenRequestIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('teacherSeenExcuseRequests') || '[]'); } catch { return []; }
  });
  const [dismissedRequestIds, setDismissedRequestIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('teacherDismissedExcuseNotifications') || '[]'); } catch { return []; }
  });
  const [teacherGeneralNotificationDismissed, setTeacherGeneralNotificationDismissed] = useState(() => localStorage.getItem('teacherGeneralNotificationDismissed') === 'true');
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [riskQuery, setRiskQuery] = useState('');
  const [riskCourseFilter, setRiskCourseFilter] = useState('All');
  const [recordReturnView, setRecordReturnView] = useState(null);
  const [attendanceReturnView, setAttendanceReturnView] = useState(null);
  const [officialTimetable, setOfficialTimetable] = useState(readOfficialTimetable);
  const [sessionActive, setSessionActive] = useState(false);
  const [fingerprintAttempts, setFingerprintAttempts] = useState([]);
  const [correctionRequests, setCorrectionRequests] = useState(readAttendanceCorrections);
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [excuses, setExcuses] = useState([]);
  const [myClasses, setMyClasses] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [myAtRisk, setMyAtRisk] = useState([]);
  const [myReports, setMyReports] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [teacherSettings, setTeacherSettings] = useState(() => {
    const defaults = { scannerAlerts: true, excuseAlerts: true, weeklySummary: true, loginAlerts: true };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('teacherSettings') || '{}') }; } catch { return defaults; }
  });
  const searchRef = useRef(null);
  const profilePhotoInputRef = useRef(null);
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem('teacherProfilePhoto') || currentUser.profilepicture || '');
  const [profilePhotoError, setProfilePhotoError] = useState('');
  const [profilePhotoEditorSource, setProfilePhotoEditorSource] = useState('');
  
  const [teacherProfile, setTeacherProfile] = useState({
    name: currentUser.fullname || 'Loading...',
    id: currentUser.lecturerid ? `T${String(currentUser.lecturerid).padStart(4, '0')}` : '...',
    email: currentUser.email || '...',
    username: currentUser.username || '...',
    stats: { totalStudents: 0, totalClasses: 0 }
  });
  const teacher = teacherProfile;

  useEffect(() => {
    if (!currentUser.eid) return;
    let isMounted = true;
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        const baseUrl = API_BASE.replace(/\/$/, "");
        const [profRes, classRes, schedRes, atRiskRes, reportsRes] = await Promise.all([
          fetch(`${baseUrl}/api/teacher/${currentUser.eid}/profile`),
          fetch(`${baseUrl}/api/teacher/${currentUser.eid}/classes`),
          fetch(`${baseUrl}/api/teacher/${currentUser.eid}/schedule`),
          fetch(`${baseUrl}/api/teacher/${currentUser.eid}/at-risk`),
          fetch(`${baseUrl}/api/teacher/${currentUser.eid}/reports`)
        ]);

        if (!isMounted) return;

        if (profRes.ok) {
          const prof = await profRes.json();
          setTeacherProfile({
            name: prof.fullname,
            id: prof.lecturerid ? `T${String(prof.lecturerid).padStart(4, '0')}` : '...',
            email: prof.email,
            username: prof.username,
            stats: { totalStudents: prof.total_students, totalClasses: prof.total_classes }
          });
        }
        if (classRes.ok) {
          const rawClass = await classRes.json();
          const parsedClasses = rawClass.map(c => ({
            id: c.classid,
            code: c.classcode,
            name: c.classname,
            room: 'Room TBA',
            students: parseInt(c.student_count) || 0,
            schedule: `${c.days || 'TBA'} · ${c.starttime ? c.starttime.substring(0,5) : ''}–${c.endtime ? c.endtime.substring(0,5) : ''}`,
            rate: parseFloat(c.attendance_rate) || 0
          }));
          setMyClasses(parsedClasses);
          if (parsedClasses.length > 0) setSelectedClass(parsedClasses[0].code);
        }
        if (schedRes.ok) {
          const rawSched = await schedRes.json();
          setMySchedule(rawSched.map(s => ({
            id: s.scheduleid,
            classid: s.classid,
            day: s.dayofweek,
            subject: s.subject,
            classCode: s.classcode,
            start: s.starttime.substring(0,5),
            end: s.endtime.substring(0,5),
            room: 'TBA'
          })));
        }
        if (atRiskRes.ok) {
          const rawRisk = await atRiskRes.json();
          setMyAtRisk(rawRisk.map(r => ({
            id: r.studentid,
            name: r.fullname,
            course: r.classcode,
            courseName: r.subject,
            present: parseInt(r.present),
            late: parseInt(r.late),
            absent: parseInt(r.absent),
            rate: parseFloat(r.rate)
          })));
        }
        if (reportsRes.ok) {
          const rawRep = await reportsRes.json();
          setMyReports(rawRep.map(r => ({
            id: r.scheduleid,
            code: r.classcode,
            name: r.subject,
            rate: parseFloat(r.rate) || 0,
            students: parseInt(r.enrolled) || 0
          })));
        }
      } catch (e) {
        console.error('Error fetching teacher data:', e);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [currentUser.eid]);

  useEffect(() => {
    if (!selectedClass || !myClasses.length) return;
    const selectedClassObj = myClasses.find(c => c.code === selectedClass);
    if (!selectedClassObj) return;
    
    let isMounted = true;
    const fetchRoster = async () => {
      try {
        const baseUrl = API_BASE.replace(/\/$/, "");
        const res = await fetch(`${baseUrl}/api/classes/${selectedClassObj.id}/roster`);
        if (res.ok && isMounted) {
          const rawRoster = await res.json();
          const mapped = rawRoster.map(r => ({
            id: `S${String(r.studentid).padStart(4, '0')}`,
            dbId: r.studentid,
            name: r.fullname,
            status: r.status === '-' ? (sessionActive ? 'Absent' : '-') : r.status,
            time: r.attendedat ? new Date(r.attendedat).toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'}) : '—',
            verification: r.attendedat ? 'Verified' : 'Pending',
            confidence: r.attendedat ? 99 : 0
          }));
          setAttendanceRows(mapped);
        }
      } catch (e) {
         console.error('Error fetching roster:', e);
      }
    };
    fetchRoster();
    return () => { isMounted = false; };
  }, [selectedClass, myClasses, sessionActive]);

  const initials = teacher.name.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const assignedTimetable = mySchedule;
  const card = 'campus-card rounded-2xl border border-white/80 bg-white shadow-sm';
  const muted = 'text-slate-600 dark:text-slate-300';
  const pendingExcuses = excuses.filter((request) => request.status === 'Pending');
  const displayedTeacherRequests = pendingExcuses.filter((request) => !dismissedRequestIds.includes(String(request.id)));
  const unreadExcuseRequests = displayedTeacherRequests.filter((request) => !seenRequestIds.includes(String(request.id)));
  const pendingCorrections = correctionRequests.filter((request) => request.status === 'Pending');
  const openFingerprintAttempts = fingerprintAttempts.filter((attempt) => attempt.status === 'Open');
  const knownExcuseIdsRef = useRef(new Set(seenRequestIds));

  useEffect(() => { localStorage.setItem('teacherActiveView', activeView); }, [activeView]);
  useEffect(() => { localStorage.setItem('appTheme', isDark ? 'soft-sky' : 'daylight'); }, [isDark]);
  useEffect(() => { localStorage.setItem('teacherSidebarCollapsed', String(collapsed)); }, [collapsed]);
  useEffect(() => { localStorage.setItem('teacherAttendanceRows', JSON.stringify(attendanceRows)); }, [attendanceRows]);
  useEffect(() => {
    localStorage.setItem('teacherExcuses', JSON.stringify(excuses));
    writeExcuseCache(excuses);
  }, [excuses]);
  useEffect(() => { localStorage.setItem('teacherSettings', JSON.stringify(teacherSettings)); }, [teacherSettings]);
  useEffect(() => {
    const syncTimetable = (event) => {
      if (event.type === 'storage' && event.key !== OFFICIAL_TIMETABLE_KEY) return;
      setOfficialTimetable(readOfficialTimetable());
    };
    window.addEventListener('storage', syncTimetable);
    window.addEventListener('official-timetable-updated', syncTimetable);
    return () => {
      window.removeEventListener('storage', syncTimetable);
      window.removeEventListener('official-timetable-updated', syncTimetable);
    };
  }, []);
  useEffect(() => {
    const syncCorrections = (event) => {
      if (event.type === 'storage' && event.key !== ATTENDANCE_CORRECTIONS_KEY) return;
      setCorrectionRequests(readAttendanceCorrections());
    };
    window.addEventListener('storage', syncCorrections);
    window.addEventListener('attendance-corrections-updated', syncCorrections);
    return () => {
      window.removeEventListener('storage', syncCorrections);
      window.removeEventListener('attendance-corrections-updated', syncCorrections);
    };
  }, []);
  useEffect(() => {
    const shortcut = (event) => {
      if (event.key === '/' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        event.preventDefault(); searchRef.current?.focus(); setSearchOpen(true);
      }
      if (event.key === 'Escape') { setSearchOpen(false); setNotificationsOpen(false); }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    const newRequest = excuses.find((request) => request.status === 'Pending' && !knownExcuseIdsRef.current.has(String(request.id)) && !dismissedRequestIds.includes(String(request.id)));
    if (newRequest && teacherSettings.excuseAlerts) {
      setRequestToast(`${newRequest.student} submitted an absence request for ${newRequest.course}.`);
    }
    knownExcuseIdsRef.current = new Set(excuses.map((request) => String(request.id)));
  }, [excuses, teacherSettings.excuseAlerts, dismissedRequestIds]);

  useEffect(() => {
    if (!requestToast) return undefined;
    const timeout = window.setTimeout(() => setRequestToast(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [requestToast]);

  const openTeacherNotifications = () => {
    setNotificationsOpen((value) => !value);
    setSearchOpen(false);
    const seen = [...new Set([...seenRequestIds, ...displayedTeacherRequests.map((request) => String(request.id))])];
    setSeenRequestIds(seen);
    localStorage.setItem('teacherSeenExcuseRequests', JSON.stringify(seen));
  };

  const clearTeacherNotifications = () => {
    const dismissed = [...new Set([...dismissedRequestIds, ...pendingExcuses.map((request) => String(request.id))])];
    setDismissedRequestIds(dismissed);
    setTeacherGeneralNotificationDismissed(true);
    setRequestToast('');
    localStorage.setItem('teacherDismissedExcuseNotifications', JSON.stringify(dismissed));
    localStorage.setItem('teacherGeneralNotificationDismissed', 'true');
  };

  useEffect(() => {
    let cancelled = false;
    const refreshRequests = () => fetchExcuseRequests()
      .then((requests) => {
        if (!cancelled) setExcuses((current) => requests.length || !current.length ? requests : current);
      })
      .catch(() => {});
    refreshRequests();
    const refreshInterval = window.setInterval(refreshRequests, 5000);
    const syncRequests = (event) => {
      if ((event.type === 'storage' && event.key === EXCUSE_CACHE_KEY) || event.type === 'excuse-requests-updated') {
        const next = readExcuseCache(seedExcuses);
        setExcuses((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
      }
    };
    window.addEventListener('storage', syncRequests);
    window.addEventListener('excuse-requests-updated', syncRequests);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      window.removeEventListener('storage', syncRequests);
      window.removeEventListener('excuse-requests-updated', syncRequests);
    };
  }, []);

  const filteredStudents = useMemo(() => attendanceRows.filter((student) => {
    const matchesQuery = `${student.name} ${student.id}`.toLowerCase().includes(studentQuery.toLowerCase());
    return matchesQuery && (statusFilter === 'All' || student.status === statusFilter);
  }), [attendanceRows, studentQuery, statusFilter]);

  const filteredAtRiskStudents = useMemo(() => myAtRisk.filter((student) => {
    const matchesQuery = `${student.name} ${student.id}`.toLowerCase().includes(riskQuery.toLowerCase());
    const matchesCourse = riskCourseFilter === 'All' || student.course === riskCourseFilter;
    return matchesQuery && matchesCourse;
  }), [myAtRisk, riskQuery, riskCourseFilter]);

  const totals = useMemo(() => ({
    present: attendanceRows.filter((row) => row.status === 'Present').length,
    late: attendanceRows.filter((row) => row.status === 'Late').length,
    absent: attendanceRows.filter((row) => row.status === 'Absent').length,
  }), [attendanceRows]);

  const globalResults = useMemo(() => {
    const value = globalQuery.trim().toLowerCase();
    if (!value) return [];
    const pages = [...navGroups.flatMap((group) => group.items), ['profile', 'My profile', UserRound], ['settings', 'Settings', Settings]]
      .map(([id, label, icon]) => ({ id, label, detail: 'Page', icon }));
    const classResults = myClasses.map((item) => ({ id: 'classes', label: item.name, detail: `${item.code} · ${item.room}`, icon: BookOpen, classCode: item.code }));
    return [...pages, ...classResults].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(value)).slice(0, 6);
  }, [globalQuery]);

  const openResult = (result) => {
    if (result.classCode) setSelectedClass(result.classCode);
    if (result.id === 'records') setRecordReturnView(null);
    if (result.id === 'takeAttendance') setAttendanceReturnView(null);
    setActiveView(result.id); setGlobalQuery(''); setSearchOpen(false);
  };

  const statusStyle = (status) => status === 'Present'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
    : status === 'Late'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'
      : 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300';

  const setStudentStatus = (id, status) => setAttendanceRows((rows) => rows.map((row) => (
    row.id === id ? { ...row, status, verification: 'Manual override', confidence: null, time: status === 'Absent' ? '—' : row.time === '—' ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : row.time } : row
  )));

  const reviewCorrection = (request, status) => {
    const updated = reviewAttendanceCorrection(request.id, status);
    setCorrectionRequests((items) => items.map((item) => item.id === request.id ? updated : item));
    if (status === 'Approved') {
      setAttendanceRows((rows) => rows.map((row) => row.id === request.studentId ? { ...row, status: request.expectedStatus, verification: 'Teacher corrected', confidence: null } : row));
    }
  };

  const downloadReport = () => {
    const rows = [['Student ID', 'Student', 'Course', 'Status', 'Check-in'], ...filteredStudents.map((student) => [student.id, student.name, selectedClass, student.status, student.time])];
    downloadCsv(`${selectedClass}-attendance-report.csv`, rows);
  };

  const updateProfilePhoto = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfilePhotoError('Please choose an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setProfilePhotoError('Please choose an image smaller than 10 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhotoEditorSource(String(reader.result));
      setProfilePhotoError('');
    };
    reader.readAsDataURL(file);
  };

  const saveProfilePhoto = (photo) => {
    try {
      setProfilePhoto(photo);
      localStorage.setItem('teacherProfilePhoto', photo);
      setProfilePhotoEditorSource('');
      setProfilePhotoError('');
    } catch {
      setProfilePhotoError('The edited photo could not be saved. Please try a smaller image.');
    }
  };

  const removeProfilePhoto = () => {
    setProfilePhoto('');
    setProfilePhotoError('');
    localStorage.removeItem('teacherProfilePhoto');
  };

  const HeaderBlock = ({ eyebrow, title, copy }) => (
    <div>
      {eyebrow && <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">{eyebrow}</p>}
      <h2 className="text-2xl font-black tracking-tight">{title}</h2>
      {copy && <p className={`mt-1 text-sm ${muted}`}>{copy}</p>}
    </div>
  );

  const BackButton = ({ label, target, onBeforeBack }) => (
    <button onClick={() => { if (onBeforeBack?.() === false) return; setActiveView(target); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 shadow-sm transition hover:-translate-x-0.5 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-white/10 dark:bg-[#121a29] dark:text-slate-300 dark:hover:bg-sky-400/10 dark:hover:text-sky-300"><ArrowLeft size={15} />{label}</button>
  );

  const StatusTable = ({ editable = false }) => (
    <div className="overflow-x-auto">
      <table className={`w-full table-fixed text-left text-sm ${editable ? 'min-w-[1080px]' : 'min-w-[900px]'}`}>
        <colgroup>
          <col style={{ width: editable ? '21%' : '28%' }} />
          <col style={{ width: editable ? '12%' : '18%' }} />
          <col style={{ width: editable ? '10%' : '18%' }} />
          <col style={{ width: editable ? '11%' : '18%' }} />
          {editable && <col style={{ width: '18%' }} />}
          <col style={{ width: editable ? '11%' : '18%' }} />
          {editable && <col style={{ width: '17%' }} />}
        </colgroup>
        <thead className="border-b border-slate-200 bg-slate-100/80 text-xs text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
          <tr>{['Student', 'Student ID', 'Course', 'Check-in', ...(editable ? ['Fingerprint verification'] : []), 'Status', ...(editable ? ['Update'] : [])].map((heading) => <th key={heading} className={`px-5 py-4 font-bold ${heading === 'Update' ? 'text-right' : ''}`}>{heading}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {filteredStudents.map((student) => (
            <tr key={student.id} className="transition hover:bg-sky-50/50 dark:hover:bg-sky-400/5">
              <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-sky-50 text-xs font-black text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">{student.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><b>{student.name}</b></div></td>
              <td className={`px-5 py-4 ${muted}`}>{student.id}</td>
              <td className="px-5 py-4 font-semibold">{selectedClass}</td>
              <td className={`px-5 py-4 ${muted}`}>{student.time}</td>
              {editable && <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold ${student.verification === 'Verified' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : student.verification === 'Failed scan' ? 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'}`}><Fingerprint size={12} />{student.verification || 'Pending'}{student.confidence ? ` · ${student.confidence}%` : ''}</span></td>}
              <td className="px-5 py-4"><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${statusStyle(student.status)}`}>{student.status}</span></td>
              {editable && <td className="px-5 py-4"><div className="flex justify-end gap-1">{['Present', 'Late', 'Absent'].map((status) => <button key={status} onClick={() => setStudentStatus(student.id, status)} title={`Mark ${status}`} className={`h-8 rounded-lg px-2.5 text-[10px] font-bold transition ${student.status === status ? statusStyle(status) : 'border border-slate-200 text-slate-500 hover:border-sky-300 dark:border-white/10 dark:text-slate-400'}`}>{status}</button>)}</div></td>}
            </tr>
          ))}
          {!filteredStudents.length && <tr><td colSpan={editable ? 7 : 5} className={`px-5 py-12 text-center ${muted}`}>No students match the current filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );

  const Filters = () => (
    <div className="flex flex-col gap-3 sm:flex-row">
      <label className="relative block flex-1 sm:max-w-xs"><Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} /><input value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Search student" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5" /></label>
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400 dark:border-white/10 dark:bg-[#121a29]">{['All', 'Present', 'Late', 'Absent'].map((status) => <option key={status}>{status}</option>)}</select>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Teacher portal" title={`Good morning, ${teacher.name.split(' ')[0]}`} copy="Here is what is happening across your classes today." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Assigned students', '156', 'Across 4 active classes', Users],
          ['Classes today', '4', 'Next class at 08:00', BookOpen],
          ['Attendance today', '91%', '142 verified check-ins', CheckCircle2],
          ['Pending excuses', excuses.filter((item) => item.status === 'Pending').length, 'Waiting for your review', FileCheck2],
        ].map(([label, value, note, icon]) => <article key={label} className={`${card} p-5`}><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">{React.createElement(icon, { size: 18 })}</span><p className={`text-sm font-semibold ${muted}`}>{label}</p></div><p className="mt-5 text-3xl font-black">{value}</p><p className={`mt-1 text-xs ${muted}`}>{note}</p></article>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-slate-100 p-5 dark:border-white/10"><h3 className="font-extrabold">Weekly attendance</h3><p className={`mt-1 text-xs ${muted}`}>Average verified attendance across your classes.</p></div>
          <div className="flex h-72 items-end gap-4 p-6 pt-10">{[91, 88, 94, 90, 96].map((value, index) => <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-bold">{value}%</span><div className="w-full max-w-16 rounded-t-xl bg-sky-200 transition hover:bg-sky-400 dark:bg-sky-400/20 dark:hover:bg-sky-400/50" style={{ height: `${value}%` }} /><span className={`text-[10px] ${muted}`}>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][index]}</span></div>)}</div>
        </section>
        <section className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/10"><div><h3 className="font-extrabold">Today’s classes</h3><p className={`mt-1 text-xs ${muted}`}>Tuesday, July 28</p></div><button onClick={() => setActiveView('schedule')} className="text-xs font-bold text-sky-600 hover:text-sky-700">View schedule</button></div>
          <div className="divide-y divide-slate-100 p-2 dark:divide-white/5">{myClasses.slice(0, 3).map((item, index) => <button key={item.code} onClick={() => { setSelectedClass(item.code); setAttendanceReturnView('dashboard'); setActiveView('takeAttendance'); }} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-sky-50 dark:hover:bg-sky-400/5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-xs font-black text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">{item.code.slice(2)}</span><span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.name}</b><span className={`mt-1 block text-[10px] ${muted}`}>{index + 8}:00 · {item.room}</span></span><ChevronRight size={15} className={muted} /></button>)}</div>
        </section>
      </div>
    </div>
  );

  const renderClasses = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Teaching" title="My classes" copy="Open a class to manage its attendance and student roster." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {myClasses.map((item) => <article key={item.code} className={`${card} overflow-hidden shadow-[0_10px_28px_rgba(39,55,105,0.11)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(73,85,160,0.17)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.28)]`}><div className="p-5"><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-sky-50 text-xs font-black text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">{item.code.slice(2)}</span><MoreHorizontal size={18} className={muted} /></div><p className={`mt-5 text-[10px] font-black uppercase tracking-[0.15em] ${muted}`}>{item.code}</p><h3 className="mt-1 font-black">{item.name}</h3><div className={`mt-4 space-y-2 text-xs ${muted}`}><p className="flex items-center gap-2"><Users size={14} />{item.students} students</p><p className="flex items-center gap-2"><Clock3 size={14} />{item.schedule}</p><p className="flex items-center gap-2"><MapPin size={14} />{item.room}</p></div><div className="mt-5 flex gap-2"><button onClick={() => { setSelectedClass(item.code); setAttendanceReturnView('classes'); setActiveView('takeAttendance'); }} className="flex-1 rounded-xl bg-sky-400 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500">Take attendance</button><button onClick={() => { setSelectedClass(item.code); setRecordReturnView('classes'); setActiveView('records'); }} className="rounded-xl border border-slate-200 px-3 text-sky-600 transition hover:border-sky-300 dark:border-white/10"><FileText size={16} /></button></div></div></article>)}
      </div>
    </div>
  );

  const renderTakeAttendance = () => (
    <div className="space-y-6">
      {attendanceReturnView && <BackButton label={`Back to ${attendanceReturnView === 'dashboard' ? 'overview' : attendanceReturnView}`} target={attendanceReturnView} onBeforeBack={() => {
        if (sessionActive && !window.confirm('The attendance session is still live. End it and go back?')) return false;
        setSessionActive(false);
        setAttendanceReturnView(null);
        return true;
      }} />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><HeaderBlock eyebrow="Fingerprint session" title="Take attendance" copy="Open a scanner session and review live student check-ins." /><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-sky-400 dark:border-white/10 dark:bg-[#121a29]">{myClasses.map((item) => <option key={item.code} value={item.code}>{item.code} — {item.name}</option>)}</select></div>
      <section className={`${card} flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between`}>
        <div className="flex items-center gap-4"><span className={`relative grid h-14 w-14 place-items-center rounded-2xl ${sessionActive ? 'bg-sky-400 text-white shadow-lg shadow-sky-400/20' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'}`}><Fingerprint size={27} />{sessionActive && <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#121a29]" />}</span><div><h3 className="font-black">{sessionActive ? 'Scanner session is live' : 'Scanner session is closed'}</h3><p className={`mt-1 text-xs ${muted}`}>{sessionActive ? 'Students can check in using the classroom fingerprint scanner.' : 'Start the session when students are ready to check in.'}</p></div></div>
        <button onClick={() => setSessionActive((value) => !value)} className={`flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition ${sessionActive ? 'border border-sky-200 bg-white/80 text-slate-700 shadow-sm hover:bg-sky-50' : 'bg-sky-400 text-slate-700 hover:bg-sky-500'}`}>{sessionActive ? <><Square size={15} />End session</> : <><Play size={15} />Start session</>}</button>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">{[['Present', totals.present, CheckCircle2], ['Late', totals.late, Clock3], ['Absent', totals.absent, XCircle]].map(([label, value, icon]) => <div key={label} className={`${card} flex items-center gap-3 p-4`}><span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-400/10 dark:text-sky-300">{React.createElement(icon, { size: 17 })}</span><div><p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>{label}</p><p className="text-xl font-black">{value}</p></div></div>)}</div>
      <section className={`${card} overflow-hidden`}><div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"><div><h3 className="font-extrabold">Live roster</h3><p className={`mt-1 text-xs ${muted}`}>{selectedClass} · July 28, 2026</p></div><Filters /></div><StatusTable editable /></section>
      <section className={`${card} overflow-hidden`}><div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-white/10"><div><h3 className="font-extrabold">Fingerprint attempt review</h3><p className={`mt-1 text-xs ${muted}`}>Review failed matches and duplicate check-in attempts from this session.</p></div><span className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">{openFingerprintAttempts.length} open</span></div><div className="divide-y divide-slate-100 dark:divide-white/5">{fingerprintAttempts.map((attempt) => <div key={attempt.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${attempt.type === 'Failed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300'}`}><Fingerprint size={18} /></span><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-extrabold">{attempt.student}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${attempt.type === 'Failed' ? 'bg-rose-50 text-rose-600 dark:bg-rose-400/10' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10'}`}>{attempt.type}</span></div><p className={`mt-1 text-xs ${muted}`}>{attempt.studentId} · {attempt.time} · {attempt.detail}</p></div></div><div className="flex items-center gap-2">{attempt.status === 'Open' ? <><button onClick={() => { setStudentQuery(attempt.student); setFingerprintAttempts((items) => items.map((item) => item.id === attempt.id ? { ...item, status: 'Resolved' } : item)); }} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold transition hover:border-sky-300 hover:text-sky-600 dark:border-white/10">Open student</button><button onClick={() => setFingerprintAttempts((items) => items.map((item) => item.id === attempt.id ? { ...item, status: 'Resolved' } : item))} className="rounded-lg bg-sky-500 px-3 py-2 text-[10px] font-bold text-white hover:bg-sky-600">Mark resolved</button></> : <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"><Check size={13} />Resolved</span>}</div></div>)}</div></section>
    </div>
  );

  const renderRecords = () => (
    <div className="space-y-6">
      {recordReturnView && <BackButton label={`Back to ${recordReturnView}`} target={recordReturnView} onBeforeBack={() => { setStudentQuery(''); setStatusFilter('All'); setRecordReturnView(null); }} />}
      <HeaderBlock eyebrow="Class history" title="Attendance records" copy="Search, filter, and review fingerprint attendance records." />
      <section className={`${card} overflow-hidden`}><div className="flex flex-col gap-4 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between dark:border-white/10"><select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold dark:border-white/10 dark:bg-[#121a29]">{classes.map((item) => <option key={item.code}>{item.code}</option>)}</select><Filters /></div><StatusTable /></section>
      <section className={`${card} overflow-hidden`}><div className="flex items-center justify-between gap-3 border-b border-slate-100 p-5 dark:border-white/10"><div><h3 className="font-extrabold">Student correction requests</h3><p className={`mt-1 text-xs ${muted}`}>Approve or reject reports of incorrectly recorded attendance.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">{pendingCorrections.length} pending</span></div>{correctionRequests.length ? <div className="divide-y divide-slate-100 dark:divide-white/5">{correctionRequests.map((request) => <div key={request.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-extrabold">{request.student}</p><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${request.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : request.status === 'Rejected' ? 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'}`}>{request.status}</span></div><p className={`mt-1 text-xs ${muted}`}>{request.studentId} · {request.course} · {request.date}</p><p className="mt-2 text-xs font-semibold">Recorded {request.recordedStatus} → requests {request.expectedStatus}</p><p className={`mt-1 text-xs ${muted}`}>{request.reason}</p></div>{request.status === 'Pending' && <div className="flex gap-2"><button onClick={() => reviewCorrection(request, 'Rejected')} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-500 hover:border-rose-300 hover:text-rose-600 dark:border-white/10">Reject</button><button onClick={() => reviewCorrection(request, 'Approved')} className="rounded-xl bg-sky-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-sky-600">Approve correction</button></div>}</div>)}</div> : <div className={`p-10 text-center text-sm ${muted}`}><FileCheck2 className="mx-auto mb-3 opacity-35" />No correction requests submitted.</div>}</section>
    </div>
  );

  const updateExcuseStatus = async (request, status) => {
    setExcuses((items) => items.map((item) => item.id === request.id ? { ...item, status } : item));
    try {
      const updatedRequest = await reviewExcuseRequest(request.id, status, currentUser.userid);
      setExcuses((items) => items.map((item) => item.id === request.id ? updatedRequest : item));
    } catch {
      // The optimistic update remains in the shared cache for the local demo.
    }
  };

  const renderExcuses = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Attendance support" title="Excuse reviews" copy="Review student explanations without changing their original fingerprint record." />
      <section className={`${card} min-h-[520px] overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 p-5 dark:border-white/10">
          <div><h3 className="font-extrabold">Student requests</h3><p className={`mt-1 text-xs ${muted}`}>Review submitted absence explanations.</p></div>
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">{pendingExcuses.length} pending</span>
        </div>
        {excuses.length ? (
          <div className="grid gap-4 p-5 xl:grid-cols-2">{excuses.map((request) => <article key={request.id} className="rounded-2xl border border-slate-200 p-5 shadow-sm transition hover:shadow-md dark:border-white/10 dark:bg-white/[0.02]"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-sky-50 text-xs font-black text-sky-700 dark:bg-sky-400/10 dark:text-sky-300">{request.student.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><h3 className="font-extrabold">{request.student}</h3><p className={`mt-0.5 text-xs ${muted}`}>{request.studentId} · {request.course}</p></div></div><span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${request.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : request.status === 'Rejected' ? 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' : 'bg-sky-50 text-sky-700 dark:bg-sky-400/10 dark:text-sky-300'}`}>{request.status}</span></div><div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-white/[0.03]"><p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>{request.date}</p><p className="mt-2 text-sm font-semibold">{request.reason}</p>{request.details && <p className={`mt-2 text-xs leading-5 ${muted}`}>{request.details}</p>}</div>{request.status === 'Pending' && <div className="mt-4 flex gap-2"><button onClick={() => updateExcuseStatus(request, 'Approved')} className="flex-1 rounded-xl bg-sky-400 py-2.5 text-xs font-bold text-white hover:bg-sky-500">Approve</button><button onClick={() => updateExcuseStatus(request, 'Rejected')} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-500 hover:border-rose-300 hover:text-rose-600 dark:border-white/10">Reject</button></div>}</article>)}</div>
        ) : (
          <div className={`grid min-h-[410px] place-items-center p-10 text-center ${muted}`}><div><FileCheck2 className="mx-auto mb-4 opacity-35" size={36} /><p className="text-sm font-semibold">No absence requests submitted yet.</p></div></div>
        )}
      </section>
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <HeaderBlock eyebrow="Semester 2 · Week 5" title="Teaching schedule" copy="Your admin-assigned weekly timetable. Open a class to control its attendance session." />
        <span className="inline-flex w-fit items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-300"><ShieldCheck size={15} />Official timetable · Read only</span>
      </div>
      <section className={`${card} overflow-hidden`}>
        <div className="grid min-w-[820px] grid-cols-[80px_repeat(5,1fr)] border-b border-slate-200 dark:border-white/10"><div className={`p-4 text-xs ${muted}`}>UTC+7</div>{['Monday 28', 'Tuesday 29', 'Wednesday 30', 'Thursday 31', 'Friday 01'].map((day) => <div key={day} className="border-l border-slate-200 p-4 text-center text-xs font-bold dark:border-white/10">{day}</div>)}</div>
        <div className="overflow-x-auto"><div className="relative grid min-h-[580px] min-w-[820px] grid-cols-[80px_repeat(5,1fr)] grid-rows-6">{[8,9,10,11,12,13].map((hour) => <React.Fragment key={hour}><div className={`border-b border-slate-100 p-3 text-xs dark:border-white/10 ${muted}`}>{String(hour).padStart(2, '0')}:00</div>{[1,2,3,4,5].map((day) => <div key={day} className="border-b border-l border-slate-100 dark:border-white/10" />)}</React.Fragment>)}
          {assignedTimetable.map((entry) => {
            const day = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(entry.day) + 1;
            const row = Math.max(1, Math.min(6, Number(entry.start.split(':')[0]) - 7));
            return <button key={entry.id} onClick={() => { setSelectedClass(entry.classCode); setAttendanceReturnView('schedule'); setActiveView('takeAttendance'); }} style={{ gridColumn: day + 1, gridRow: row }} className="z-10 m-2 self-start rounded-lg border-l-2 border-sky-400 bg-gradient-to-br from-sky-50 to-violet-50 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:from-sky-400/10 dark:to-violet-400/10"><b className="block text-xs">{entry.subject}</b><span className={`mt-1 block text-[10px] ${muted}`}>{entry.start}–{entry.end} · {entry.room}</span><span className="mt-2 inline-flex text-[10px] font-bold text-sky-600 dark:text-sky-300">Open attendance session</span></button>;
          })}
          {!assignedTimetable.length && <div className="pointer-events-none absolute inset-0 grid place-items-center pl-20"><div className={`max-w-sm rounded-2xl bg-white/90 p-6 text-center shadow-sm backdrop-blur dark:bg-[#121a29]/90 ${muted}`}><CalendarDays className="mx-auto mb-3 opacity-40" size={30} /><p className="text-sm font-bold text-slate-700 dark:text-slate-200">No classes assigned yet</p><p className="mt-1 text-xs">Ask an administrator to assign your name to an official timetable entry.</p></div></div>}
        </div></div>
      </section>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><HeaderBlock eyebrow="Attendance analytics" title="Reports" copy="Review class performance and export the current attendance dataset." /><button onClick={downloadReport} className="flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-white hover:bg-sky-500"><Download size={16} />Export CSV</button></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{myReports.map((item) => <article key={item.id || item.code} className={`${card} p-5`}><p className={`text-xs font-bold ${muted}`}>{item.code}</p><h3 className="mt-1 text-sm font-extrabold">{item.name}</h3><p className="mt-5 text-3xl font-black">{item.rate}%</p><div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-sky-400" style={{ width: `${item.rate}%` }} /></div><p className={`mt-2 text-[10px] ${muted}`}>{item.students} enrolled students</p></article>)}</div>
      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center lg:justify-between dark:border-white/10">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-400/10 dark:text-amber-300"><TriangleAlert size={19} /></span>
            <div><div className="flex flex-wrap items-center gap-2"><h3 className="font-extrabold">At-risk students</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:bg-white/10 dark:text-slate-300">{filteredAtRiskStudents.length} students</span></div><p className={`mt-1 text-xs ${muted}`}>Students below the 90% attendance threshold.</p></div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block sm:w-64"><Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} /><input value={riskQuery} onChange={(event) => setRiskQuery(event.target.value)} placeholder="Search student or ID" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-xs outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-white/5" /></label>
            <select value={riskCourseFilter} onChange={(event) => setRiskCourseFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold outline-none transition focus:border-sky-400 dark:border-white/10 dark:bg-[#121a29]"><option value="All">All courses</option>{[...new Set(myAtRisk.map((student) => student.course))].map((course) => <option key={course} value={course}>{course}</option>)}</select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed text-left text-xs">
            <thead className="bg-slate-100 text-slate-700 dark:bg-white/[0.05] dark:text-slate-300"><tr><th className="w-[22%] px-5 py-3 font-bold">Student</th><th className="w-[18%] px-5 py-3 font-bold">Course</th><th className="w-[19%] px-5 py-3 font-bold">Attendance</th><th className="px-4 py-3 font-bold">Present</th><th className="px-4 py-3 font-bold">Late</th><th className="px-4 py-3 font-bold">Absent</th><th className="px-4 py-3 font-bold">Risk</th><th className="w-[12%] px-5 py-3 text-right font-bold">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {filteredAtRiskStudents.map((student) => {
                const risk = student.rate < 75 ? 'Critical' : student.rate < 85 ? 'High' : 'Watch';
                const riskStyle = risk === 'Critical' ? 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300' : risk === 'High' ? 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300';
                return <tr key={`${student.id}-${student.course}`} className="transition hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-100 to-violet-100 font-extrabold text-violet-700 dark:from-sky-400/15 dark:to-violet-400/15 dark:text-violet-300">{student.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><div><p className="font-extrabold">{student.name}</p><p className={`mt-0.5 text-[10px] ${muted}`}>{student.id}</p></div></div></td>
                  <td className="px-5 py-4"><p className="font-bold">{student.course}</p><p className={`mt-0.5 truncate text-[10px] ${muted}`}>{student.courseName}</p></td>
                  <td className="px-5 py-4"><div className="flex items-center justify-between gap-2"><span className="font-extrabold">{student.rate}%</span><span className={`text-[10px] ${muted}`}>of 90%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full ${student.rate < 75 ? 'bg-rose-400' : student.rate < 85 ? 'bg-amber-400' : 'bg-violet-400'}`} style={{ width: `${student.rate}%` }} /></div></td>
                  <td className="px-4 py-4 font-bold text-emerald-600 dark:text-emerald-300">{student.present}</td><td className="px-4 py-4 font-bold text-amber-600 dark:text-amber-300">{student.late}</td><td className="px-4 py-4 font-bold text-rose-600 dark:text-rose-300">{student.absent}</td>
                  <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${riskStyle}`}>{risk}</span></td>
                  <td className="px-5 py-4 text-right"><button onClick={() => { setStudentQuery(student.name); setSelectedClass(student.course); setRecordReturnView('reports'); setActiveView('records'); }} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700 dark:border-white/10 dark:text-slate-300 dark:hover:bg-sky-400/10 dark:hover:text-sky-300">View record</button></td>
                </tr>;
              })}
              {!filteredAtRiskStudents.length && <tr><td colSpan="8" className={`px-5 py-12 text-center ${muted}`}>No at-risk students match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
      <section className={`${card} overflow-hidden`}><div className="flex flex-col gap-4 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10"><div><h3 className="font-extrabold">Report preview</h3><p className={`mt-1 text-xs ${muted}`}>The CSV export follows these active filters.</p></div><Filters /></div><StatusTable /></section>
    </div>
  );

  const Toggle = ({ setting, label }) => {
    const enabled = teacherSettings[setting];
    return <button role="switch" aria-checked={enabled} aria-label={label} onClick={() => setTeacherSettings((current) => ({ ...current, [setting]: !enabled }))} className={`relative h-6 w-11 rounded-full transition ${enabled ? 'bg-sky-400' : 'bg-slate-200 dark:bg-white/15'}`}><span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow transition ${enabled ? 'translate-x-5' : ''}`} /></button>;
  };

  const renderSettings = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Preferences" title="Settings" copy="Manage teacher alerts, appearance, and account security." />
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className={`${card} overflow-hidden`}><div className="border-b border-slate-100 p-5 dark:border-white/10"><h3 className="font-extrabold">Teacher notifications</h3><p className={`mt-1 text-xs ${muted}`}>Choose which teaching updates you receive.</p></div><div className="divide-y divide-slate-100 px-5 dark:divide-white/10">{[['scannerAlerts','Scanner session alerts','Notify me about scanner connection or session issues.'],['excuseAlerts','New excuse requests','Alert me when a student submits an absence explanation.'],['weeklySummary','Weekly class summary','Send a weekly overview of attendance across my classes.'],['loginAlerts','New device login alerts','Notify me when my account is used on another device.']].map(([setting,title,copy]) => <div key={setting} className="flex items-center justify-between gap-5 py-4"><div><p className="text-sm font-bold">{title}</p><p className={`mt-1 text-xs ${muted}`}>{copy}</p></div><Toggle setting={setting} label={title} /></div>)}</div></section>
        <div className="space-y-5"><section className={`${card} p-5`}><h3 className="font-extrabold">Appearance</h3><p className={`mt-1 text-xs ${muted}`}>Choose a bright campus-inspired theme.</p><div className="mt-4 grid grid-cols-2 gap-2">{[[false,'Daylight',Sun],[true,'Soft sky',Moon]].map(([dark,label,icon]) => <button key={label} onClick={() => setIsDark(dark)} className={`flex items-center justify-center gap-2 rounded-xl border py-3 text-xs font-bold ${isDark === dark ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-600'}`}>{React.createElement(icon, { size: 15 })}{label}</button>)}</div></section></div>
      </div>
      <AccountSecurity
        user={currentUser}
        storageKey={`teacherSecurity:${currentUser.userid || teacher.username}`}
        card={card}
        muted={muted}
      />
      <section className={`${card} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
        <div><h3 className="font-extrabold">Account session</h3><p className={`mt-1 text-xs ${muted}`}>Sign out safely from this device.</p></div>
        <button onClick={onLogout} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300"><LogOut size={16} />Sign out</button>
      </section>
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Teacher account" title="My profile" copy="Personal, employment, and teaching information." />
      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`${card} overflow-hidden xl:sticky xl:top-5`}>
          <div className="h-20 bg-gradient-to-r from-[#9fcce6] via-[#c6e0ef] to-[#e8f2f8]" />
          <div className="px-5 pb-5">
            <div className="relative -mt-9 h-[76px] w-[76px]">
              {profilePhoto ? <img src={profilePhoto} alt={`${teacher.name} profile`} className="h-[76px] w-[76px] rounded-full border-4 border-white object-cover shadow-md dark:border-[#121a29]" /> : <div className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white bg-violet-50 text-xl font-black text-violet-700 shadow-md dark:border-[#121a29] dark:bg-violet-400/15 dark:text-violet-300">{initials}</div>}
              <button onClick={() => profilePhotoInputRef.current?.click()} aria-label="Change profile picture" title="Change profile picture" className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-sky-500 text-white shadow-md transition hover:scale-110 hover:bg-sky-600 dark:border-[#121a29]"><Camera size={13} /></button>
              <input ref={profilePhotoInputRef} type="file" accept="image/*" onChange={updateProfilePhoto} className="hidden" />
            </div>
            <div className="mt-3 flex items-center gap-2"><h3 className="min-w-0 truncate text-lg font-black">{teacher.name}</h3><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" title="Active" /></div>
            <p className={`mt-1 break-all text-xs ${muted}`}>{teacher.email}</p>
            <span className="mt-3 inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">Active teacher</span>
            <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => profilePhotoInputRef.current?.click()} className="rounded-lg bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-700 transition hover:bg-sky-100 dark:bg-sky-400/10 dark:text-sky-300">Choose photo</button>{profilePhoto && <button onClick={() => setProfilePhotoEditorSource(profilePhoto)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-sky-300 hover:text-sky-600 dark:border-white/10 dark:text-slate-300">Edit crop</button>}{profilePhoto && <button onClick={removeProfilePhoto} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:text-slate-400">Remove</button>}</div>
            {profilePhotoError && <p className="mt-2 text-[10px] font-semibold text-rose-500">{profilePhotoError}</p>}
            <div className="mt-5 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Teacher ID</p>
              <div className="mt-1 flex items-center justify-between gap-2"><b className="truncate text-xs">{teacher.id}</b><button onClick={() => navigator.clipboard?.writeText(teacher.id)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold transition hover:border-violet-400 hover:text-violet-600 dark:border-white/10">Copy</button></div>
            </div>
            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-white/10">
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"><ShieldCheck size={17} className="text-emerald-500" /><div><p className="text-xs font-bold">Attendance access enabled</p><p className={`text-[10px] ${muted}`}>4 assigned classes</p></div></div>
            </div>
          </div>
        </aside>
        <div className="min-w-0 space-y-5">
          {[
            ['Personal information', 'Verified', [['Full name',teacher.name],['Username',teacher.username],['Email address',teacher.email]]],
            ['Employment details', 'Lecturer', [['Teacher ID',teacher.id],['Department','Computer Science'],['Role','Lecturer']]],
            ['Teaching details', 'Semester 2', [['Assigned classes','4'],['Assigned students','156'],['Current semester','Semester 2']]],
          ].map(([title,status,fields]) => <section key={title} className={`${card} overflow-hidden`}><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10"><h3 className="text-sm font-extrabold">{title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status === 'Verified' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300'}`}>{status}</span></div><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([label,value]) => <div key={label} className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/5"><p className={`text-[10px] ${muted}`}>{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>)}</div></section>)}
        </div>
      </div>
    </div>
  );

  const content = {
    dashboard: renderOverview, classes: renderClasses, takeAttendance: renderTakeAttendance,
    records: renderRecords, excuses: renderExcuses, schedule: renderSchedule,
    reports: renderReports, profile: renderProfile, settings: renderSettings,
  };

  return (
    <div className={`${isDark ? 'soft-sky' : ''} teacher-dashboard campus-dashboard`}>
      <ProfilePhotoEditor key={profilePhotoEditorSource || 'closed'} source={profilePhotoEditorSource} name={teacher.name} onCancel={() => setProfilePhotoEditorSource('')} onSave={saveProfilePhoto} />
      {requestToast && <button onClick={() => { setActiveView('excuses'); setRequestToast(''); }} className="fixed right-5 top-5 z-[120] flex max-w-sm items-start gap-3 rounded-2xl border border-violet-200 bg-white p-4 text-left shadow-2xl transition hover:-translate-y-0.5 dark:border-violet-400/20 dark:bg-[#121a29]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300"><FileCheck2 size={17} /></span><span><b className="block text-sm">New absence request</b><span className={`mt-1 block text-xs leading-5 ${muted}`}>{requestToast}</span></span></button>}
      <div className="campus-shell flex min-h-screen text-slate-800">
        {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden" />}
        <aside className={`campus-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/80 transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${collapsed ? 'lg:w-20' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <button onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className="absolute -right-3 top-[68px] z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition hover:scale-110 hover:border-sky-400 hover:bg-sky-400 hover:text-white dark:border-white/15 dark:bg-[#151d2c] lg:flex">{collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</button>
          <div className={`flex h-[92px] items-center justify-between px-4 ${collapsed ? 'lg:px-3' : ''}`}><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-sky-500 shadow-sm"><Fingerprint size={25} /></span><div className={collapsed ? 'lg:hidden' : ''}><p className="text-base font-black tracking-tight">Smart Attendance</p><p className={`mt-0.5 text-[8px] font-black uppercase tracking-[0.2em] ${muted}`}>Teacher portal</p></div></div><button onClick={() => setMobileOpen(false)} className="p-2 text-slate-500 lg:hidden"><X size={20} /></button></div>
          <nav className={`flex-1 overflow-y-auto ${collapsed ? 'lg:px-2' : 'px-4'} py-4`}>{navGroups.map((group) => <div key={group.label} className="mb-7"><div className={`mb-2 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.12em] ${muted} ${collapsed ? 'lg:hidden' : ''}`}><span>{group.label}</span><MoreHorizontal size={15} /></div><div className="space-y-1">{group.items.map(([id,label,icon]) => <button key={id} title={collapsed ? label : undefined} onClick={() => { if (id === 'records') setRecordReturnView(null); if (id === 'takeAttendance') setAttendanceReturnView(null); setActiveView(id); setMobileOpen(false); }} className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all hover:translate-x-1 ${activeView === id ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10' : 'text-slate-500 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all group-hover:scale-105 ${activeView === id ? 'bg-sky-400 text-white' : 'group-hover:bg-sky-400 group-hover:text-white'}`}>{React.createElement(icon, { size: 17 })}</span><span className={collapsed ? 'lg:hidden' : ''}>{label}</span></button>)}</div></div>)}
          </nav>
          <div className={`border-t border-slate-200 p-4 dark:border-white/10 ${collapsed ? 'lg:px-2' : ''}`}><button onClick={() => { setActiveView('settings'); setMobileOpen(false); }} title={collapsed ? 'Settings' : undefined} className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all hover:translate-x-1 ${collapsed ? 'lg:justify-center' : ''} ${activeView === 'settings' ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10' : 'text-slate-500 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-all group-hover:rotate-45 ${activeView === 'settings' ? 'bg-sky-400 text-white' : 'group-hover:bg-sky-400 group-hover:text-white'}`}><Settings size={17} /></span><span className={collapsed ? 'lg:hidden' : ''}>Settings</span></button></div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mx-auto w-full max-w-[1600px]">
            <header className="relative mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setMobileOpen(true)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 lg:hidden dark:border-white/10 dark:bg-white/5"><Menu size={18} /></button>
                <p className="text-xl font-black">{viewNames[activeView]}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative hidden sm:block">
                  <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
                  <input ref={searchRef} value={globalQuery} onFocus={() => setSearchOpen(true)} onChange={(event) => { setGlobalQuery(event.target.value); setSearchOpen(true); }} placeholder="Search anything" className="w-64 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-12 text-sm outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-sky-400/10" />
                  <kbd className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ${muted}`}>/</kbd>
                  {searchOpen && globalQuery.trim() && <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#121a29]">{globalResults.length ? globalResults.map((result, index) => { const Icon = result.icon; return <button key={`${result.label}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => openResult(result)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-sky-50 dark:hover:bg-sky-400/10"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/5"><Icon size={15} /></span><span><b className="block text-xs">{result.label}</b><span className={`text-[10px] ${muted}`}>{result.detail}</span></span></button>; }) : <p className={`p-5 text-center text-xs ${muted}`}>No matching pages or classes.</p>}</div>}
                </div>
                <button aria-label="Notifications" aria-expanded={notificationsOpen} onClick={openTeacherNotifications} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:border-sky-400 hover:text-sky-600 dark:border-white/10 dark:bg-white/5">
                  <Bell size={18} />
                  {(unreadExcuseRequests.length > 0 || pendingCorrections.length > 0) && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0d1422]" />}
                </button>
                <button onClick={() => { setActiveView('profile'); setNotificationsOpen(false); setSearchOpen(false); }} aria-label="Open my profile" title="My profile" className={`group grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-white shadow-sm transition hover:scale-105 hover:border-sky-400 dark:bg-white/5 ${activeView === 'profile' ? 'border-sky-400 ring-2 ring-sky-100 dark:ring-sky-400/10' : 'border-white ring-1 ring-slate-200 dark:border-[#121a29] dark:ring-white/15'}`}>
                  {profilePhoto ? <img src={profilePhoto} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-gradient-to-br from-sky-100 to-violet-100 text-xs font-black text-violet-700 dark:from-sky-400/15 dark:to-violet-400/15 dark:text-violet-300">{initials}</span>}
                </button>
                {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#121a29]"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold">Notifications</h3><div className="flex items-center gap-2">{(displayedTeacherRequests.length > 0 || !teacherGeneralNotificationDismissed) && <button onClick={clearTeacherNotifications} className="text-[11px] font-bold text-violet-600 hover:text-violet-800 dark:text-violet-300">Clear all</button>}<button onClick={() => setNotificationsOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={16} /></button></div></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{pendingCorrections.map((request) => <button key={request.id} onClick={() => { setRecordReturnView(null); setActiveView('records'); setNotificationsOpen(false); }} className="w-full rounded-xl bg-amber-50 p-3 text-left dark:bg-amber-400/10"><b className="text-xs">{request.student} requested a correction</b><p className={`mt-1 text-[10px] ${muted}`}>{request.course} · {request.date} · {request.recordedStatus} → {request.expectedStatus}</p></button>)}{displayedTeacherRequests.map((request) => <button key={request.id} onClick={() => { setActiveView('excuses'); setNotificationsOpen(false); }} className="w-full rounded-xl bg-violet-50 p-3 text-left dark:bg-violet-400/10"><b className="text-xs">{request.student} requested an absence</b><p className={`mt-1 text-[10px] ${muted}`}>{request.course} · {request.date}</p></button>)}{!teacherGeneralNotificationDismissed && <button onClick={() => { setAttendanceReturnView(null); setActiveView('takeAttendance'); setNotificationsOpen(false); }} className="w-full rounded-xl bg-sky-50 p-3 text-left dark:bg-sky-400/10"><b className="text-xs">CS301 starts at 08:00</b><p className={`mt-1 text-[10px] ${muted}`}>The scanner is ready to open.</p></button>}{!pendingCorrections.length && !displayedTeacherRequests.length && teacherGeneralNotificationDismissed && <p className={`rounded-xl bg-slate-50 p-4 text-center text-xs dark:bg-white/5 ${muted}`}>You’re all caught up.</p>}</div></div>}
              </div>
            </header>
            {content[activeView]?.()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TeacherDashboard;
