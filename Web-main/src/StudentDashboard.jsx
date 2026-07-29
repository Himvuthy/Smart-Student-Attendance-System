import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  Bell, BookOpen, CalendarDays, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Download, FileCheck2, Fingerprint, GraduationCap, HelpCircle, LayoutDashboard, LogOut, MapPin, Menu,
  Moon, MoreHorizontal, Pencil, Plus, Search, Send, Settings, ShieldCheck, Sun, Trash2, TrendingUp, X, XCircle
} from 'lucide-react';
import AccountSecurity from './AccountSecurity';
import ProfilePhotoEditor from './ProfilePhotoEditor';
import { createExcuseRequest, EXCUSE_CACHE_KEY, fetchExcuseRequests, mergeExcuseCache, readExcuseCache } from './excuseRequests';
import { ATTENDANCE_CORRECTIONS_KEY, readAttendanceCorrections, submitAttendanceCorrection } from './attendanceCorrections';
import { OFFICIAL_TIMETABLE_KEY, readOfficialTimetable } from './officialTimetable';
import { downloadCsv } from './csvExport';

// Mock constants removed in favor of live DB fetches

const viewNames = { dashboard: 'Overview', attendance: 'My attendance', schedule: 'Class schedule', courseBreakdown: 'Course breakdown', excuseRequests: 'Excuse requests', attendanceReport: 'Attendance report', help: 'Help center', profile: 'My profile', settings: 'Settings' };

const statusStyles = {
  Present: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300',
  Late: 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
  Absent: 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300',
};

const Badge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${statusStyles[status] || statusStyles.Absent}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />{status}
  </span>
);

const studentViews = new Set(Object.keys(viewNames));

const timetableToCalendarItems = (entries) => entries.map((entry) => {
  const day = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].indexOf(entry.day) + 1;
  const [startHour, startMinute] = String(entry.start || '08:00').split(':').map(Number);
  const [endHour, endMinute] = String(entry.end || '09:00').split(':').map(Number);
  const durationMinutes = Math.max(60, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
  return {
    id: `official-${entry.id}`,
    kind: 'official',
    day: day > 0 ? day : 1,
    row: Math.max(1, startHour - 7),
    span: Math.max(1, Math.round(durationMinutes / 60)),
    title: entry.subject,
    time: `${entry.start} - ${entry.end}`,
    room: entry.room,
    tone: 'bg-sky-50/80 border-sky-300',
  };
});

const readSavedReminders = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('studentCalendarItems') || '[]');
    return Array.isArray(saved)
      ? saved.filter((item) => item.kind === 'reminder' || String(item.id).startsWith('item-'))
      : [];
  } catch {
    return [];
  }
};

const API_BASE = import.meta.env.VITE_API_URL || 'https://smart-student-attendance-system-nkka.onrender.com';

const nav = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'attendance', label: 'My attendance', icon: CalendarDays },
  { id: 'schedule', label: 'Class schedule', icon: BookOpen },
];

const attendanceNav = [
  { id: 'courseBreakdown', label: 'Course breakdown', icon: GraduationCap },
  { id: 'excuseRequests', label: 'Excuse requests', icon: FileCheck2 },
  { id: 'attendanceReport', label: 'Attendance report', icon: Download },
];

const StudentDashboard = ({ onLogout }) => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
  
  // Real DB state
  const [studentProfile, setStudentProfile] = useState({
    name: currentUser.fullname || 'Loading...',
    id: currentUser.studentid ? `STU-${String(currentUser.studentid).padStart(5, '0')}` : '...',
    email: currentUser.email || '...',
    username: currentUser.username || '...',
  });
  const student = studentProfile; // For legacy usage
  
  const [mySchedule, setMySchedule] = useState([]);
  const [myAttendance, setMyAttendance] = useState([]);
  const [myCourseStats, setMyCourseStats] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    if (!currentUser.eid) return;
    let isMounted = true;
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        const baseUrl = API_BASE.replace(/\/$/, "");
        const [profRes, schedRes, attRes, statsRes] = await Promise.all([
          fetch(`${baseUrl}/api/student/${currentUser.eid}/profile`),
          fetch(`${baseUrl}/api/student/${currentUser.eid}/schedule`),
          fetch(`${baseUrl}/api/student/${currentUser.eid}/attendance`),
          fetch(`${baseUrl}/api/student/${currentUser.eid}/attendance/stats`)
        ]);

        if (!isMounted) return;

        if (profRes.ok) {
          const prof = await profRes.json();
          setStudentProfile({
            name: prof.fullname,
            id: prof.studentid ? `STU-${String(prof.studentid).padStart(5, '0')}` : '...',
            email: prof.email,
            username: prof.username,
            raw: prof
          });
        }
        if (schedRes.ok) {
          const rawSched = await schedRes.json();
          setMySchedule(rawSched.map(s => ({
            id: s.scheduleid,
            day: s.dayofweek,
            short: s.dayofweek.substring(0,3),
            time: `${s.starttime.substring(0,5)} - ${s.endtime.substring(0,5)}`,
            subject: s.subject,
            code: s.classcode,
            room: 'Room TBA',
            lecturer: s.teacher_name || 'TBA',
            accent: 'indigo',
            start: s.starttime.substring(0,5),
            end: s.endtime.substring(0,5),
          })));
        }
        if (attRes.ok) {
          const rawAtt = await attRes.json();
          setMyAttendance(rawAtt.map(a => ({
            id: a.attendanceid,
            date: new Date(a.sessiondate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            subject: a.subject,
            code: a.classcode,
            time: a.status === 'Absent' ? '--' : new Date(a.attendedat).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            status: a.status
          })));
        }
        if (statsRes.ok) {
          const rawStats = await statsRes.json();
          setMyCourseStats(rawStats.map(s => ({
            code: s.classcode,
            name: s.subject,
            sessions: parseInt(s.sessions, 10) || 0,
            present: parseInt(s.present, 10) || 0,
            late: parseInt(s.late, 10) || 0,
            absent: parseInt(s.absent, 10) || 0,
            rate: parseFloat(s.rate) || 0,
            color: 'bg-sky-400'
          })));
        }
      } catch (e) {
        console.error('Error fetching student data:', e);
      } finally {
        if (isMounted) setIsLoadingData(false);
      }
    };
    fetchData();
    return () => { isMounted = false; };
  }, [currentUser.eid]);

  const belongsToStudent = useCallback((request) => String(request.studentUserId || '') === String(currentUser.userid || '')
    || (!request.studentUserId && request.studentId === studentProfile.id), [currentUser.userid, studentProfile.id]);
  const [activeView, setActiveView] = useState(() => {
    const saved = localStorage.getItem('studentActiveView');
    return studentViews.has(saved) ? saved : 'dashboard';
  });
  const [isDark, setIsDark] = useState(() => localStorage.getItem('appTheme') === 'soft-sky');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('studentSidebarCollapsed') === 'true');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [reviewToast, setReviewToast] = useState('');
  const [seenReviewStatuses, setSeenReviewStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`studentSeenExcuseReviews:${currentUser.userid || student.id}`) || '[]'); } catch { return []; }
  });
  const [dismissedReviewStatuses, setDismissedReviewStatuses] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`studentDismissedExcuseNotifications:${currentUser.userid || student.id}`) || '[]'); } catch { return []; }
  });
  const [dismissedCorrectionReviews, setDismissedCorrectionReviews] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`studentDismissedCorrectionNotifications:${student.id}`) || '[]'); } catch { return []; }
  });
  const [studentGeneralNotificationDismissed, setStudentGeneralNotificationDismissed] = useState(() => localStorage.getItem(`studentGeneralNotificationDismissed:${currentUser.userid || student.id}`) === 'true');
  const [globalQuery, setGlobalQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const profilePhotoInputRef = useRef(null);
  const profilePhotoKey = `studentProfilePhoto:${student.id}`;
  const [profilePhoto, setProfilePhoto] = useState(() => localStorage.getItem(profilePhotoKey) || currentUser.profilepicture || '');
  const [profilePhotoError, setProfilePhotoError] = useState('');
  const [profilePhotoEditorSource, setProfilePhotoEditorSource] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [reportTab, setReportTab] = useState('summary');
  const [reportQuery, setReportQuery] = useState('');
  const [reportRateFilter, setReportRateFilter] = useState('All');
  const [reportSort, setReportSort] = useState({ key: 'name', direction: 'asc' });
  const [reportPage, setReportPage] = useState(1);
  const [profileTab, setProfileTab] = useState('personal');
  const [calendarMode, setCalendarMode] = useState('week');
  const [calendarMonth, setCalendarMonth] = useState(6);
  const [selectedDay, setSelectedDay] = useState(28);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [calendarItems, setCalendarItems] = useState(() => [
    ...readSavedReminders(),
  ]);

  useEffect(() => {
    setCalendarItems([
      ...timetableToCalendarItems(mySchedule),
      ...readSavedReminders(),
    ]);
  }, [mySchedule]);
  const [reminderDraft, setReminderDraft] = useState({ title: '', day: 1, hour: 8, room: '' });
  const [visibleClasses, setVisibleClasses] = useState({
    'Data Structures': true, 'Database Systems': true, 'Web Development': true,
    'Software Engineering': true, 'Computer Networks': true, 'Project Consultation': true,
  });
  const [excuseDraft, setExcuseDraft] = useState({ date: '', course: 'CS301', reason: 'Medical', details: '' });
  const [excuseSubmitting, setExcuseSubmitting] = useState(false);
  const [excuseFeedback, setExcuseFeedback] = useState('');
  const [excuseRequests, setExcuseRequests] = useState(() => {
    try {
      const shared = readExcuseCache().filter(belongsToStudent);
      return shared.length ? shared : JSON.parse(localStorage.getItem('studentExcuseRequests') || '[]');
    } catch { return []; }
  });
  const [correctionRequests, setCorrectionRequests] = useState(() => readAttendanceCorrections().filter((request) => request.studentId === student.id));
  const [correctionRecord, setCorrectionRecord] = useState(null);
  const [correctionDraft, setCorrectionDraft] = useState({ expectedStatus: 'Present', reason: '' });
  const [checkInConfirmationVisible, setCheckInConfirmationVisible] = useState(() => localStorage.getItem(`studentCheckInConfirmationDismissed:${student.id}`) !== 'true');
  const [lowAttendanceNotificationDismissed, setLowAttendanceNotificationDismissed] = useState(() => localStorage.getItem(`studentLowAttendanceNotificationDismissed:${student.id}`) === 'true');
  const [studentSettings, setStudentSettings] = useState(() => {
    const defaults = {
      checkInReminders: true,
      missedAttendanceAlerts: true,
      excuseUpdates: true,
      weeklySummary: false,
      loginAlerts: true,
      language: 'English',
      reminderTime: '15 minutes before',
    };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('studentSettings') || '{}') }; } catch { return defaults; }
  });
  const initials = student.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  const attendanceTotals = useMemo(() => {
    let present = 0, late = 0, absent = 0, total = 0;
    myCourseStats.forEach(c => {
      present += c.present; late += c.late; absent += c.absent; total += c.sessions;
    });
    const totals = { Present: present, Late: late, Absent: absent, total };
    correctionRequests.filter((request) => request.status === 'Approved').forEach((request) => {
      if (request.recordedStatus === request.expectedStatus) return;
      if (totals[request.recordedStatus] > 0) totals[request.recordedStatus] -= 1;
      totals[request.expectedStatus] = (totals[request.expectedStatus] || 0) + 1;
    });
    totals.rate = total > 0 ? Number(((totals.Present / totals.total) * 100).toFixed(1)) : 100;
    return totals;
  }, [correctionRequests, myCourseStats]);
  const displayCourseStats = useMemo(() => myCourseStats.map((course) => {
    const adjusted = { ...course };
    correctionRequests
      .filter((request) => request.status === 'Approved' && request.course === course.code)
      .forEach((request) => {
        const from = request.recordedStatus.toLowerCase();
        const to = request.expectedStatus.toLowerCase();
        if (from === to) return;
        if (typeof adjusted[from] === 'number' && adjusted[from] > 0) adjusted[from] -= 1;
        if (typeof adjusted[to] === 'number') adjusted[to] += 1;
      });
    adjusted.rate = Number(((adjusted.present / adjusted.sessions) * 100).toFixed(1));
    return adjusted;
  }), [correctionRequests]);
  const lowAttendanceCourses = displayCourseStats.filter((course) => course.rate < 90);
  const reviewedExcuses = excuseRequests.filter((request) => ['Approved', 'Rejected'].includes(request.status));
  const reviewedCorrections = correctionRequests.filter((request) => ['Approved', 'Rejected'].includes(request.status)).slice(0, 3);
  const displayedCorrectionReviews = reviewedCorrections.filter((request) => !dismissedCorrectionReviews.includes(`${request.id}:${request.status}`));
  const displayedStudentReviews = reviewedExcuses.filter((request) => !dismissedReviewStatuses.includes(`${request.id}:${request.status}`));
  const unreadExcuseReviews = displayedStudentReviews.filter((request) => !seenReviewStatuses.includes(`${request.id}:${request.status}`));
  const knownReviewStatusesRef = useRef(new Map());

  useEffect(() => {
    localStorage.setItem('studentActiveView', activeView);
  }, [activeView]);

  useEffect(() => {
    localStorage.setItem('appTheme', isDark ? 'soft-sky' : 'daylight');
  }, [isDark]);

  useEffect(() => {
    localStorage.setItem('studentSidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    const reminders = calendarItems.filter((item) => item.kind === 'reminder' || String(item.id).startsWith('item-'));
    localStorage.setItem('studentCalendarItems', JSON.stringify(reminders));
  }, [calendarItems]);

  useEffect(() => {
    const syncTimetable = (event) => {
      if (event.type === 'storage' && event.key !== OFFICIAL_TIMETABLE_KEY) return;
      setCalendarItems((items) => [
        ...timetableToCalendarItems(readOfficialTimetable()),
        ...items.filter((item) => item.kind === 'reminder' || String(item.id).startsWith('item-')),
      ]);
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
      setCorrectionRequests(readAttendanceCorrections().filter((request) => request.studentId === student.id));
    };
    window.addEventListener('storage', syncCorrections);
    window.addEventListener('attendance-corrections-updated', syncCorrections);
    return () => {
      window.removeEventListener('storage', syncCorrections);
      window.removeEventListener('attendance-corrections-updated', syncCorrections);
    };
  }, [student.id]);

  useEffect(() => {
    localStorage.setItem('studentExcuseRequests', JSON.stringify(excuseRequests));
    mergeExcuseCache(excuseRequests);
  }, [excuseRequests]);

  useEffect(() => {
    let cancelled = false;
    const refreshRequests = () => {
      if (!currentUser.userid) return;
      fetchExcuseRequests(currentUser.userid)
        .then((requests) => {
          if (!cancelled) {
            setExcuseRequests((current) => requests.length || !current.length ? requests : current);
            if (requests.length) mergeExcuseCache(requests);
          }
        })
        .catch(() => {});
    };
    refreshRequests();
    const refreshInterval = window.setInterval(refreshRequests, 5000);
    const syncRequests = (event) => {
      if ((event.type === 'storage' && event.key === EXCUSE_CACHE_KEY) || event.type === 'excuse-requests-updated') {
        const next = readExcuseCache().filter(belongsToStudent);
        setExcuseRequests((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
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
  }, [belongsToStudent, currentUser.userid]);

  useEffect(() => {
    const changedRequest = excuseRequests.find((request) => {
      const previousStatus = knownReviewStatusesRef.current.get(String(request.id));
      const notificationKey = `${request.id}:${request.status}`;
      return ['Approved', 'Rejected'].includes(request.status)
        && previousStatus !== request.status
        && !seenReviewStatuses.includes(notificationKey)
        && !dismissedReviewStatuses.includes(notificationKey);
    });
    if (changedRequest && studentSettings.excuseUpdates) {
      setReviewToast(`Your ${changedRequest.course} absence request was ${changedRequest.status.toLowerCase()}.`);
    }
    knownReviewStatusesRef.current = new Map(excuseRequests.map((request) => [String(request.id), request.status]));
  }, [excuseRequests, studentSettings.excuseUpdates, seenReviewStatuses, dismissedReviewStatuses]);

  useEffect(() => {
    if (!reviewToast) return undefined;
    const timeout = window.setTimeout(() => setReviewToast(''), 5000);
    return () => window.clearTimeout(timeout);
  }, [reviewToast]);

  const openStudentNotifications = () => {
    setNotificationsOpen((value) => !value);
    setSearchOpen(false);
    const seen = [...new Set([...seenReviewStatuses, ...displayedStudentReviews.map((request) => `${request.id}:${request.status}`)])];
    setSeenReviewStatuses(seen);
    localStorage.setItem(`studentSeenExcuseReviews:${currentUser.userid || student.id}`, JSON.stringify(seen));
  };

  const clearStudentNotifications = () => {
    const dismissed = [...new Set([...dismissedReviewStatuses, ...reviewedExcuses.map((request) => `${request.id}:${request.status}`)])];
    const dismissedCorrections = [...new Set([...dismissedCorrectionReviews, ...reviewedCorrections.map((request) => `${request.id}:${request.status}`)])];
    setDismissedReviewStatuses(dismissed);
    setDismissedCorrectionReviews(dismissedCorrections);
    setStudentGeneralNotificationDismissed(true);
    setCheckInConfirmationVisible(false);
    setLowAttendanceNotificationDismissed(true);
    setReviewToast('');
    localStorage.setItem(`studentDismissedExcuseNotifications:${currentUser.userid || student.id}`, JSON.stringify(dismissed));
    localStorage.setItem(`studentDismissedCorrectionNotifications:${student.id}`, JSON.stringify(dismissedCorrections));
    localStorage.setItem(`studentGeneralNotificationDismissed:${currentUser.userid || student.id}`, 'true');
    localStorage.setItem(`studentCheckInConfirmationDismissed:${student.id}`, 'true');
    localStorage.setItem(`studentLowAttendanceNotificationDismissed:${student.id}`, 'true');
  };

  useEffect(() => {
    localStorage.setItem('studentSettings', JSON.stringify(studentSettings));
  }, [studentSettings]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        event.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const effectiveRecords = useMemo(() => myAttendance.map((record) => {
    const approved = correctionRequests.find((request) => (
      request.course === record.code
      && request.date === record.date
      && request.status === 'Approved'
    ));
    return approved ? { ...record, status: approved.expectedStatus, corrected: true } : record;
  }), [correctionRequests]);

  const filteredRecords = useMemo(() => effectiveRecords.filter((record) => {
    const matchesSearch = `${record.subject} ${record.code} ${record.date}`.toLowerCase().includes(query.toLowerCase());
    return matchesSearch && (statusFilter === 'All' || record.status === statusFilter);
  }), [effectiveRecords, query, statusFilter]);

  const filteredReportCourses = useMemo(() => {
    const matchingCourses = displayCourseStats.filter((course) => {
      const matchesSearch = `${course.name} ${course.code}`.toLowerCase().includes(reportQuery.trim().toLowerCase());
      const matchesRate = reportRateFilter === 'All'
        || (reportRateFilter === 'On track' && course.rate >= 90)
        || (reportRateFilter === 'At risk' && course.rate < 90);
      return matchesSearch && matchesRate;
    });
    return [...matchingCourses].sort((a, b) => {
      const left = a[reportSort.key];
      const right = b[reportSort.key];
      const comparison = typeof left === 'string' ? left.localeCompare(right) : left - right;
      return reportSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [displayCourseStats, reportQuery, reportRateFilter, reportSort]);
  const reportPageSize = 3;
  const reportPageCount = Math.max(1, Math.ceil(filteredReportCourses.length / reportPageSize));
  const visibleReportCourses = filteredReportCourses.slice((reportPage - 1) * reportPageSize, reportPage * reportPageSize);

  const searchResults = useMemo(() => {
    const text = globalQuery.trim().toLowerCase();
    if (!text) return [];
    const pages = [...nav, ...attendanceNav, { id: 'help', label: 'Help center', icon: HelpCircle }, { id: 'settings', label: 'Settings', icon: Settings }, { id: 'profile', label: 'My profile', icon: GraduationCap }].map((item) => ({ title: item.label, subtitle: 'Page', view: item.id, icon: item.icon }));
    const classes = mySchedule.map((item) => ({ title: item.subject, subtitle: `${item.code} · ${item.room}`, view: 'schedule', icon: BookOpen }));
    const attendance = effectiveRecords.map((item) => ({ title: item.subject, subtitle: `${item.date} · ${item.status}`, view: 'attendance', filter: item.subject, icon: CalendarDays }));
    return [...pages, ...classes, ...attendance].filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(text)).slice(0, 6);
  }, [effectiveRecords, globalQuery]);

  const openSearchResult = (result) => {
    setActiveView(result.view);
    if (result.filter) setQuery(result.filter);
    setGlobalQuery('');
    setSearchOpen(false);
  };

  const openNewReminder = () => {
    setEditingEventId(null);
    setReminderDraft({ title: '', day: 1, hour: 8, room: '' });
    setReminderOpen(true);
  };

  const openEditReminder = (item) => {
    setEditingEventId(item.id);
    setReminderDraft({ title: item.title, day: item.day, hour: item.row + 7, room: item.room || '' });
    setSelectedEvent(null);
    setReminderOpen(true);
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
      localStorage.setItem(profilePhotoKey, photo);
      setProfilePhotoEditorSource('');
      setProfilePhotoError('');
    } catch {
      setProfilePhotoError('The edited photo could not be saved. Please try a smaller image.');
    }
  };

  const removeProfilePhoto = () => {
    setProfilePhoto('');
    setProfilePhotoError('');
    localStorage.removeItem(profilePhotoKey);
  };

  const openCorrectionRequest = (record) => {
    setCorrectionRecord(record);
    setCorrectionDraft({ expectedStatus: record.status === 'Present' ? 'Late' : 'Present', reason: '' });
  };

  const submitCorrection = (event) => {
    event.preventDefault();
    const request = submitAttendanceCorrection({
      studentId: student.id,
      studentUserId: currentUser.userid || null,
      student: student.name,
      course: correctionRecord.code,
      subject: correctionRecord.subject,
      date: correctionRecord.date,
      recordedStatus: correctionRecord.status,
      expectedStatus: correctionDraft.expectedStatus,
      reason: correctionDraft.reason.trim(),
    });
    setCorrectionRequests((items) => items.some((item) => item.id === request.id) ? items : [request, ...items]);
    setCorrectionRecord(null);
    setCorrectionDraft({ expectedStatus: 'Present', reason: '' });
  };

  const card = 'campus-card rounded-2xl border border-white/80 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md';
  const muted = 'text-slate-600 dark:text-slate-300';

  const HeaderBlock = ({ eyebrow, title, copy }) => (
    <div>
      {eyebrow && <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">{eyebrow}</p>}
      <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">{title}</h2>
      {copy && <p className={`mt-1 text-sm ${muted}`}>{copy}</p>}
    </div>
  );

  const AttendanceTable = ({ compact = false }) => (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-sm ${compact ? 'min-w-[680px]' : 'min-w-[820px]'}`}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-100/80 text-xs uppercase tracking-wider text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
            <th className="px-5 py-4 font-bold">Date</th>
            <th className="px-5 py-4 font-bold">Class</th>
            <th className="px-5 py-4 font-bold">Scan time</th>
            <th className="px-5 py-4 font-bold">Status</th>
            {!compact && <th className="px-5 py-4 text-right font-bold">Correction</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
          {(compact ? myAttendance.slice(0, 4) : filteredRecords).map((record) => (
            <tr key={`${record.id || record.date}-${record.code}`} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
              <td className={`px-5 py-4 font-medium ${muted}`}>{record.date}</td>
              <td className="px-5 py-4">
                <p className="font-bold text-slate-800 dark:text-slate-100">{record.subject}</p>
                <p className={`mt-0.5 text-xs ${muted}`}>{record.code}</p>
              </td>
              <td className={`px-5 py-4 font-medium ${muted}`}>{record.time}</td>
              <td className="px-5 py-4"><Badge status={record.status} /></td>
              {!compact && <td className="px-5 py-4 text-right">{correctionRequests.some((request) => request.course === record.code && request.date === record.date && request.status === 'Pending') ? <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">Pending review</span> : <button onClick={() => openCorrectionRequest(record)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-white/10 dark:text-slate-300 dark:hover:bg-sky-400/10">Request correction</button>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {!compact && filteredRecords.length === 0 && <p className={`p-8 text-center text-sm ${muted}`}>No attendance records match your filters.</p>}
    </div>
  );

  const renderOverview = () => {
    const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const todaysClasses = mySchedule.filter((item) => item.day === todayDayName);
    
    const presentPct = attendanceTotals.total > 0 ? Math.round((attendanceTotals.Present / attendanceTotals.total) * 100) : 0;
    const latePct = attendanceTotals.total > 0 ? Math.round((attendanceTotals.Late / attendanceTotals.total) * 100) : 0;
    const absentPct = attendanceTotals.total > 0 ? Math.round((attendanceTotals.Absent / attendanceTotals.total) * 100) : 0;

    const weeklyAnalytics = (() => {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      if (!effectiveRecords || effectiveRecords.length === 0) {
        return [
          { d: 'Thu', v: 75, isToday: false }, { d: 'Fri', v: 92, isToday: false }, { d: 'Sat', v: 68, isToday: false },
          { d: 'Sun', v: 85, isToday: false }, { d: 'Mon', v: 95, isToday: false }, { d: 'Tue', v: 88, isToday: false },
          { d: 'Wed', v: 100, isToday: true }
        ];
      }

      const distinctDates = [...new Set(effectiveRecords.map(r => new Date(r.date).toDateString()))];
      distinctDates.sort((a, b) => new Date(b) - new Date(a));
      const recentDates = distinctDates.slice(0, 7).reverse();

      while (recentDates.length < 7) {
        const earliestDate = recentDates.length > 0 ? new Date(recentDates[0]) : new Date();
        earliestDate.setDate(earliestDate.getDate() - 1);
        recentDates.unshift(earliestDate.toDateString());
      }

      const todayStr = new Date().toDateString();
      return recentDates.map((dateStr, i) => {
        const d = new Date(dateStr);
        const dayRecords = effectiveRecords.filter(r => new Date(r.date).toDateString() === dateStr);
        const presentCount = dayRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
        const v = dayRecords.length > 0 ? Math.round((presentCount / dayRecords.length) * 100) : 0;
        return { d: days[d.getDay()], v, isToday: dateStr === todayStr || (i === 6 && !recentDates.includes(todayStr)) };
      });
    })();

    return (
    <div className="space-y-4">
      {checkInConfirmationVisible && <section className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-400/10 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500 text-white"><Fingerprint size={19} /></span><div><p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">Fingerprint attendance confirmed</p><p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Data Structures · Today at 07:56 AM · Marked Present</p></div></div><button onClick={() => { setCheckInConfirmationVisible(false); localStorage.setItem(`studentCheckInConfirmationDismissed:${student.id}`, 'true'); }} className="self-end rounded-lg p-2 text-emerald-600 transition hover:bg-emerald-100 sm:self-auto dark:hover:bg-emerald-400/10"><X size={16} /></button></section>}
      {lowAttendanceCourses.length > 0 && <button onClick={() => setActiveView('courseBreakdown')} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-amber-400/20 dark:bg-amber-400/10"><span><b className="block text-sm text-amber-900 dark:text-amber-200">Attendance warning</b><span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">{lowAttendanceCourses.map((course) => `${course.code} is ${course.rate}%`).join(' · ')}. Review your attendance before it falls further.</span></span><ChevronRight size={17} className="shrink-0 text-amber-600" /></button>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Attendance Rate', value: `${attendanceTotals.rate}%`, note: 'Excellent standing', progress: attendanceTotals.rate, icon: TrendingUp },
          { label: 'Present Sessions', value: String(attendanceTotals.Present), note: 'View attendance', icon: CheckCircle2 },
          { label: 'Late Arrivals', value: String(attendanceTotals.Late), note: 'View details', icon: Clock3 },
          { label: 'Next Class', value: todaysClasses.length > 0 ? todaysClasses[0].time.split(' - ')[0] : 'None', note: todaysClasses.length > 0 ? todaysClasses[0].subject : 'No more classes today', icon: BookOpen },
        ].map(({ label, value, note, progress, icon }) => (
          <div key={label} className={`${card} flex min-h-44 flex-col p-5`}>
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-slate-200 p-2 text-slate-600 dark:border-white/10 dark:text-slate-300">{React.createElement(icon, { size: 18 })}</div>
              <p className={`text-sm font-semibold ${muted}`}>{label}</p>
              {progress && <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">Active</span>}
            </div>
            <p className="mt-5 text-4xl font-black tracking-tight">{value}</p>
            <div className="mt-auto pt-3">
              {progress ? (
                <><div className="mb-2 flex justify-between text-xs font-bold"><span>Progress</span><span>{progress}%</span></div><div className="h-2 rounded-full bg-slate-100 dark:bg-white/10"><div className="h-full rounded-full bg-[#60a5fa]" style={{ width: `${progress}%` }} /></div></>
              ) : (
                <button onClick={() => label === 'Next Class' ? setActiveView('schedule') : setActiveView('attendance')} className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold transition hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"><span>{note}</span><ChevronRight size={15} /></button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
        <div className={`${card} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10">
            <div><h3 className="font-extrabold">Attendance Analytics</h3><p className={`mt-0.5 text-xs ${muted}`}>Weekly fingerprint check-in performance</p></div>
            <div className="flex rounded-xl border border-slate-200 p-1 text-xs font-bold dark:border-white/10"><span className="rounded-lg bg-white px-3 py-1.5 shadow-sm dark:bg-white/10">Weekly</span><span className={`px-3 py-1.5 ${muted}`}>Monthly</span></div>
          </div>
          <div className="p-5">
            <div className="relative h-64 pl-9">
              <div className="absolute inset-y-0 left-9 right-0 flex flex-col justify-between text-[10px] text-slate-400">
                {[100, 75, 50, 25, 0].map((n) => <div key={n} className="relative border-t border-slate-100 dark:border-white/10"><span className="absolute -left-9 -top-2">{n}%</span></div>)}
              </div>
              <div className="absolute inset-0 left-11 flex items-end justify-around gap-3 pt-4">
                {weeklyAnalytics.map(({ d, v, isToday }) => (
                  <div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className={`text-[10px] font-bold ${isToday ? 'rounded-md bg-sky-100 px-2 py-1 text-sky-800 shadow-sm' : muted}`}>{v}%</span>
                    <div className={`w-full max-w-16 rounded-xl ${isToday ? 'bg-gradient-to-t from-[#3b82f6] to-[#93c5fd] shadow-lg shadow-sky-400/20' : 'bg-[repeating-linear-gradient(135deg,#f1f0f4_0px,#f1f0f4_4px,#e7e5eb_4px,#e7e5eb_6px)] dark:bg-[repeating-linear-gradient(135deg,#20283a_0px,#20283a_4px,#2b3448_4px,#2b3448_6px)]'}`} style={{ height: `${v > 0 ? Math.max(v * 1.75, 4) : 0}px` }} />
                    <span className={`text-xs font-medium ${muted}`}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10"><h3 className="font-extrabold">Today’s Classes</h3><span className={`flex items-center gap-2 text-xs ${muted}`}><span className="h-2 w-2 rounded-full bg-emerald-400" />{todaysClasses.length} sessions</span></div>
            <div className="space-y-3 p-4">
              {todaysClasses.length === 0 ? (
                <p className={`text-center text-sm ${muted}`}>No classes scheduled for today.</p>
              ) : todaysClasses.map((item, index) => (
                <div key={item.id || item.code} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-black text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">{item.code.slice(0, 2)}</div>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold">{item.subject}</p><p className={`truncate text-xs ${muted}`}>{item.room} · {item.lecturer}</p></div>
                  <div className="text-right"><p className="text-xs font-black">{item.time.split(' - ')[0]}</p><p className="mt-1 text-[10px] font-bold text-emerald-600">{index ? 'Later' : 'Next'}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className={`${card} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10"><h3 className="font-extrabold">Attendance Breakdown</h3><Fingerprint size={18} className={muted} /></div>
            <div className="p-4"><div className="flex h-11 overflow-hidden rounded-lg"><div className="bg-sky-400 transition-all duration-500" style={{ width: `${presentPct}%` }} /><div className="bg-sky-200 transition-all duration-500" style={{ width: `${latePct}%` }} /><div className="bg-slate-200 transition-all duration-500 dark:bg-white/10" style={{ width: `${absentPct}%` }} /></div><div className={`mt-3 flex flex-wrap gap-4 text-[11px] font-semibold ${muted}`}><span><b className="mr-1 text-sky-500">■</b>Present {presentPct}%</span><span><b className="mr-1 text-sky-300">■</b>Late {latePct}%</span><span><b className="mr-1 text-slate-300">■</b>Absent {absentPct}%</span></div></div>
          </div>
        </div>
      </section>

      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10"><div><h3 className="font-extrabold">Recent Attendance</h3><p className={`mt-0.5 text-xs ${muted}`}>Latest fingerprint check-ins</p></div><button onClick={() => setActiveView('attendance')} className="rounded-lg border border-slate-200 p-2 text-slate-500 dark:border-white/10"><Search size={17} /></button></div>
        <AttendanceTable compact />
      </section>
    </div>
  );
  };

  const renderAttendance = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Academic record" title="My attendance" copy="Review your fingerprint check-ins and attendance standing." />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { name: 'Present', value: attendanceTotals.Present, total: attendanceTotals.total, color: 'bg-emerald-500', icon: Check },
          { name: 'Late', value: attendanceTotals.Late, total: attendanceTotals.total, color: 'bg-amber-500', icon: Clock3 },
          { name: 'Absent', value: attendanceTotals.Absent, total: attendanceTotals.total, color: 'bg-rose-500', icon: X },
        ].map(({ name, value, total, color, icon }) => (
          <div className={`${card} p-5`} key={name}>
            <div className="flex items-center justify-between"><p className={`text-sm font-bold ${muted}`}>{name}</p>{React.createElement(icon, { size: 18, className: color.replace('bg-', 'text-') })}</div>
            <p className="mt-2 text-3xl font-black">{value}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full ${color}`} style={{ width: `${(value / total) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className={`${card} overflow-hidden`}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-5 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-extrabold">Attendance history</h3><p className={`mt-1 text-xs ${muted}`}>Semester 2 · 2025–2026</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search class..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-sky-400 dark:border-white/10 dark:bg-white/5 sm:w-52" />
            </label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium outline-none focus:border-sky-400 dark:border-white/10 dark:bg-[#182133]">
              {['All', 'Present', 'Late', 'Absent'].map((status) => <option key={status}>{status}</option>)}
            </select>
          </div>
        </div>
        <AttendanceTable />
      </div>
      {correctionRequests.length > 0 && <section className={`${card} overflow-hidden`}><div className="border-b border-slate-100 p-5 dark:border-white/10"><h3 className="font-extrabold">Correction requests</h3><p className={`mt-1 text-xs ${muted}`}>Track requests submitted for incorrectly recorded attendance.</p></div><div className="divide-y divide-slate-100 dark:divide-white/5">{correctionRequests.map((request) => <div key={request.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold">{request.course} · {request.date}</p><p className={`mt-1 text-xs ${muted}`}>Recorded {request.recordedStatus} → requested {request.expectedStatus}</p></div><span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${request.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : request.status === 'Rejected' ? 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'}`}>{request.status}</span></div>)}</div></section>}
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setCalendarMonth((value) => (value + 11) % 12)} className="rounded-xl border border-slate-200 bg-white p-2.5 hover:border-sky-300 hover:text-sky-600 dark:border-white/10 dark:bg-white/5"><ChevronLeft size={17} /></button>
          <div className="min-w-36 text-center"><p className="text-sm font-extrabold">{['January','February','March','April','May','June','July','August','September','October','November','December'][calendarMonth]} 2026</p><p className={`mt-0.5 text-[11px] ${muted}`}>Semester 2 · Week 5</p></div>
          <button onClick={() => setCalendarMonth((value) => (value + 1) % 12)} className="rounded-xl border border-slate-200 bg-white p-2.5 hover:border-sky-300 hover:text-sky-600 dark:border-white/10 dark:bg-white/5"><ChevronRight size={17} /></button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`hidden text-xs sm:inline ${muted}`}><b className="text-slate-900 dark:text-white">9</b> classes · <b className="text-slate-900 dark:text-white">13.5h</b></span>
          <button onClick={() => { setCalendarMonth(6); setSelectedDay(28); setCalendarMode('week'); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:border-sky-300 dark:border-white/10 dark:bg-white/5">Today</button>
          <div className="flex rounded-xl bg-slate-200/60 p-1 text-xs font-bold dark:bg-white/5">{['week', 'month'].map((mode) => <button key={mode} onClick={() => setCalendarMode(mode)} className={`rounded-lg px-3 py-1.5 capitalize transition ${calendarMode === mode ? 'bg-white shadow-sm dark:bg-white/10' : muted}`}>{mode}</button>)}</div>
          <button onClick={openNewReminder} className="flex items-center gap-2 rounded-xl bg-[#60a5fa] px-3 py-2 text-xs font-bold text-white hover:bg-[#3b82f6]"><Plus size={15} />Add reminder</button>
        </div>
      </section>

      <div className={`${card} min-h-[calc(100vh-150px)] w-full overflow-hidden lg:grid lg:grid-cols-[230px_minmax(0,1fr)]`}>
        <aside className="border-b border-slate-200 bg-slate-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02] lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between">
            <button onClick={() => setCalendarMonth((value) => (value + 11) % 12)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-sky-600 dark:hover:bg-white/5"><ChevronLeft size={16} /></button>
            <p className="text-xs font-extrabold">{['January','February','March','April','May','June','July','August','September','October','November','December'][calendarMonth]} 2026</p>
            <button onClick={() => setCalendarMonth((value) => (value + 1) % 12)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-sky-600 dark:hover:bg-white/5"><ChevronRight size={16} /></button>
          </div>
          <div className="mt-3 grid grid-cols-7 gap-y-1.5 text-center">
            {['M','T','W','T','F','S','S'].map((day, index) => <span key={`${day}-${index}`} className={`text-[9px] font-bold ${muted}`}>{day}</span>)}
            {[...Array(31)].map((_, i) => <button key={i} onClick={() => setSelectedDay(i + 1)} className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition hover:bg-sky-100 hover:text-sky-700 dark:hover:bg-sky-400/15 ${selectedDay === i + 1 ? 'bg-[#60a5fa] font-bold text-white shadow-sm' : ''}`}>{i + 1}</button>)}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4 dark:border-white/10">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">My classes</p>
            <div className="mt-3 space-y-1.5">
              {['Data Structures','Database Systems','Web Development','Software Engineering','Computer Networks'].map((name) => (
                <button key={name} onClick={() => setVisibleClasses((value) => ({ ...value, [name]: !value[name] }))} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11px] font-semibold transition hover:bg-white dark:hover:bg-white/5 ${visibleClasses[name] ? '' : 'opacity-40'}`}><span className={`flex h-4 w-4 items-center justify-center rounded border ${visibleClasses[name] ? 'border-[#60a5fa] bg-[#60a5fa] text-white' : 'border-slate-300 dark:border-white/20'}`}>{visibleClasses[name] && <Check size={10} />}</span><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /><span className="truncate">{name}</span></button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 border-t border-slate-200 pt-4 dark:border-white/10">
            <div className="rounded-xl bg-white p-2.5 dark:bg-white/5"><p className="text-lg font-black">9</p><p className={`text-[9px] ${muted}`}>Classes</p></div>
            <div className="rounded-xl bg-white p-2.5 dark:bg-white/5"><p className="text-lg font-black">13.5h</p><p className={`text-[9px] ${muted}`}>This week</p></div>
          </div>
        </aside>

        <div className="overflow-x-auto">
          {calendarMode === 'month' ? (
            <div className="min-w-[760px] p-5">
              <div className="grid grid-cols-7 border-l border-t border-slate-200 dark:border-white/10">
                {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map((day) => <div key={day} className={`border-b border-r border-slate-200 p-3 text-center text-xs font-bold dark:border-white/10 ${muted}`}>{day}</div>)}
                {[...Array(35)].map((_, i) => {
                  const day = i + 1;
                  const hasClass = [1,3,7,8,10,14,15,17,21,22,24,28,29,31].includes(day);
                  return <button key={i} onClick={() => setSelectedDay(day)} className={`min-h-24 border-b border-r border-slate-200 p-2 text-left align-top transition hover:bg-sky-50 dark:border-white/10 dark:hover:bg-sky-400/5 ${selectedDay === day ? 'bg-sky-50 ring-2 ring-inset ring-[#60a5fa] dark:bg-sky-400/10' : ''}`}><span className="text-xs font-bold">{day <= 31 ? day : ''}</span>{day <= 31 && hasClass && <div className="mt-3 rounded-md bg-sky-100 p-2 text-[10px] font-bold text-sky-700 dark:bg-sky-400/15 dark:text-sky-300">Class scheduled</div>}</button>;
                })}
              </div>
            </div>
          ) : (
          <div className="min-w-[850px]">
            <div className="grid grid-cols-[64px_repeat(5,1fr)] border-b border-slate-200 dark:border-white/10">
              <div className={`p-3 text-center text-[10px] ${muted}`}>UTC+7</div>
              {[['28','Monday'],['29','Tuesday'],['30','Wednesday'],['31','Thursday'],['01','Friday']].map(([date, day]) => <div key={day} className={`border-l border-slate-200 p-3 text-center dark:border-white/10 ${day === 'Tuesday' ? 'bg-sky-50/50 dark:bg-sky-400/5' : ''}`}><p className="text-sm font-black">{date}</p><p className={`text-[10px] ${muted}`}>{day}</p></div>)}
            </div>
            <div className="relative grid min-h-[640px] grid-cols-[64px_repeat(5,1fr)] grid-rows-[repeat(8,minmax(76px,1fr))]">
              {[8,9,10,11,12,13,14,15].map((hour, row) => <React.Fragment key={hour}><div style={{ gridColumn: 1, gridRow: row + 1 }} className={`border-b border-slate-100 px-2 pt-3 text-[10px] dark:border-white/10 ${muted}`}>{String(hour > 12 ? hour - 12 : hour).padStart(2,'0')} {hour >= 12 ? 'PM' : 'AM'}</div>{[1,2,3,4,5].map((day) => <div key={day} style={{ gridColumn: day + 1, gridRow: row + 1 }} className="border-b border-l border-slate-100 dark:border-white/10" />)}</React.Fragment>)}
              {calendarItems.filter((event) => visibleClasses[event.title] !== false).map((event) => {
                const quietTone = {
                  'Data Structures': 'bg-sky-50/80 border-sky-300 dark:bg-sky-400/10 dark:border-sky-400/60',
                  'Database Systems': 'bg-sky-50/80 border-sky-300 dark:bg-sky-400/10 dark:border-sky-400/60',
                  'Web Development': 'bg-sky-50/80 border-sky-300 dark:bg-sky-400/10 dark:border-sky-400/60',
                  'Software Engineering': 'bg-sky-50/80 border-sky-300 dark:bg-sky-400/10 dark:border-sky-400/60',
                  'Computer Networks': 'bg-sky-50/80 border-sky-300 dark:bg-sky-400/10 dark:border-sky-400/60',
                  'Project Consultation': 'bg-sky-50/80 border-sky-300 dark:bg-sky-400/10 dark:border-sky-400/60',
                }[event.title] || 'bg-sky-50/80 border-sky-300 dark:bg-sky-400/10 dark:border-sky-400/60';
                return (
                  <button key={event.id} onClick={() => setSelectedEvent(event)} style={{ gridColumn: event.day + 1, gridRow: `${event.row} / span ${event.span}` }} className={`z-10 m-2 self-start overflow-hidden rounded-md border-l-2 p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${quietTone}`}>
                    <p className="truncate text-[11px] font-extrabold">{event.title}</p><p className={`mt-1 text-[8px] font-semibold ${muted}`}><Clock3 size={9} className="mr-1 inline" />{event.time}</p><p className={`mt-1 truncate text-[8px] ${muted}`}><MapPin size={9} className="mr-1 inline" />{event.room}</p>
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>
      </div>
      {selectedEvent && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}>
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#151d2c]">
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${muted}`}>{selectedEvent.kind === 'official' ? 'Official timetable' : 'Personal reminder'}</p>
                <h3 className="mt-2 text-xl font-black">{selectedEvent.title}</h3>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button>
            </div>
            <div className={`mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm dark:bg-white/5 ${muted}`}>
              <p className="flex items-center gap-2"><Clock3 size={16} />{selectedEvent.time}</p>
              <p className="flex items-center gap-2"><MapPin size={16} />{selectedEvent.room || 'No room assigned'}</p>
              <p className="flex items-center gap-2"><CalendarDays size={16} />{selectedEvent.kind === 'official' ? 'Managed by the administrator' : 'Personal weekly reminder'}</p>
            </div>
            {selectedEvent.kind !== 'official' && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button onClick={() => openEditReminder(selectedEvent)} className="flex items-center justify-center gap-2 rounded-xl bg-sky-50 py-3 text-sm font-bold text-sky-700 hover:bg-sky-100 dark:bg-sky-400/10 dark:text-sky-300"><Pencil size={15} />Edit</button>
                <button onClick={() => { if (window.confirm(`Delete "${selectedEvent.title}"?`)) { setCalendarItems((items) => items.filter((item) => item.id !== selectedEvent.id)); setSelectedEvent(null); } }} className="flex items-center justify-center gap-2 rounded-xl bg-rose-50 py-3 text-sm font-bold text-rose-600 hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300"><Trash2 size={15} />Delete</button>
              </div>
            )}
          </div>
        </div>
      )}
      {reminderOpen && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onClick={() => setReminderOpen(false)}><form onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); const updatedItem = { day: Number(reminderDraft.day), row: Math.max(1, Number(reminderDraft.hour) - 7), span: editingEventId ? (calendarItems.find((item) => item.id === editingEventId)?.span || 1) : 1, title: reminderDraft.title, time: `${String(reminderDraft.hour).padStart(2,'0')}:00 reminder`, room: reminderDraft.room, tone: editingEventId ? (calendarItems.find((item) => item.id === editingEventId)?.tone || 'bg-sky-100 border-sky-400 dark:bg-sky-400/15') : 'bg-sky-100 border-sky-400 dark:bg-sky-400/15' }; setCalendarItems((items) => editingEventId ? items.map((item) => item.id === editingEventId ? { ...item, ...updatedItem } : item) : [...items, { ...updatedItem, id: `item-${Date.now()}` }]); setVisibleClasses((value) => ({ ...value, [reminderDraft.title]: true })); setReminderOpen(false); setEditingEventId(null); setReminderDraft({ title: '', day: 1, hour: 8, room: '' }); }} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#151d2c]"><div className="flex items-center justify-between"><h3 className="text-xl font-black">{editingEventId ? 'Edit calendar item' : 'Add reminder'}</h3><button type="button" onClick={() => { setReminderOpen(false); setEditingEventId(null); }} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button></div><div className="mt-5 space-y-4"><label className="block text-xs font-bold">Title<input required value={reminderDraft.title} onChange={(e) => setReminderDraft((value) => ({ ...value, title: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm outline-none focus:border-[#60a5fa] dark:border-white/10" placeholder="Study group" /></label><div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold">Day<select value={reminderDraft.day} onChange={(e) => setReminderDraft((value) => ({ ...value, day: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#151d2c]">{['Monday','Tuesday','Wednesday','Thursday','Friday'].map((day, i) => <option key={day} value={i + 1}>{day}</option>)}</select></label><label className="text-xs font-bold">Start time<select value={reminderDraft.hour} onChange={(e) => setReminderDraft((value) => ({ ...value, hour: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#151d2c]">{[8,9,10,11,12,13,14,15].map((hour) => <option key={hour} value={hour}>{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}</option>)}</select></label></div><label className="block text-xs font-bold">Room or note<input value={reminderDraft.room} onChange={(e) => setReminderDraft((value) => ({ ...value, room: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm outline-none focus:border-[#60a5fa] dark:border-white/10" placeholder="Library" /></label></div><button type="submit" className="mt-6 w-full rounded-xl bg-[#60a5fa] py-3 text-sm font-bold text-white hover:bg-[#3b82f6]">{editingEventId ? 'Save changes' : 'Save reminder'}</button></form></div>}
    </div>
  );

  const renderProfile = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Student account" title="My profile" copy="Personal, academic, and biometric information." />
      <div className="grid items-start gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`${card} overflow-hidden xl:sticky xl:top-5`}>
          <div className="h-20 bg-gradient-to-r from-[#9fcce6] via-[#c6e0ef] to-[#e8f2f8]" />
          <div className="px-5 pb-5">
            <div className="relative -mt-9 h-[76px] w-[76px]">
              {profilePhoto ? <img src={profilePhoto} alt={`${student.name} profile`} className="h-[76px] w-[76px] rounded-full border-4 border-white object-cover shadow-md dark:border-[#121a29]" /> : <div className="grid h-[76px] w-[76px] place-items-center rounded-full border-4 border-white bg-violet-50 text-xl font-black text-violet-700 shadow-md dark:border-[#121a29] dark:bg-violet-400/15 dark:text-violet-300">{initials}</div>}
              <button onClick={() => profilePhotoInputRef.current?.click()} aria-label="Change profile picture" title="Change profile picture" className="absolute bottom-0 right-0 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-sky-500 text-white shadow-md transition hover:scale-110 hover:bg-sky-600 dark:border-[#121a29]"><Camera size={13} /></button>
              <input ref={profilePhotoInputRef} type="file" accept="image/*" onChange={updateProfilePhoto} className="hidden" />
            </div>
            <div className="mt-3 flex items-center gap-2"><h3 className="min-w-0 truncate text-lg font-black">{student.name}</h3><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" title="Active" /></div>
            <p className={`mt-1 break-all text-xs ${muted}`}>{student.email}</p>
            <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">Active student</span>
            <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => profilePhotoInputRef.current?.click()} className="rounded-lg bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-700 transition hover:bg-sky-100 dark:bg-sky-400/10 dark:text-sky-300">Choose photo</button>{profilePhoto && <button onClick={() => setProfilePhotoEditorSource(profilePhoto)} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-sky-300 hover:text-sky-600 dark:border-white/10 dark:text-slate-300">Edit crop</button>}{profilePhoto && <button onClick={removeProfilePhoto} className="rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-500 transition hover:border-rose-300 hover:text-rose-600 dark:border-white/10 dark:text-slate-400">Remove</button>}</div>
            {profilePhotoError && <p className="mt-2 text-[10px] font-semibold text-rose-500">{profilePhotoError}</p>}
            <div className="mt-5 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Student ID</p>
              <div className="mt-1 flex items-center justify-between gap-2"><b className="truncate text-xs">{student.id}</b><button onClick={() => navigator.clipboard?.writeText(student.id)} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold transition hover:border-violet-400 hover:text-violet-600 dark:border-white/10">Copy</button></div>
            </div>
            <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 dark:border-white/10">
              <div className="flex items-center gap-3 rounded-xl px-3 py-2.5"><Fingerprint size={17} className="text-emerald-500" /><div><p className="text-xs font-bold">Fingerprint enrolled</p><p className={`text-[10px] ${muted}`}>Ready for attendance</p></div></div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5">
          <div className="flex gap-6 border-b border-slate-200 dark:border-white/10" role="tablist" aria-label="Student profile sections">
            {[['personal', 'Personal information'], ['academic', 'Academic information']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={profileTab === id} onClick={() => setProfileTab(id)} className={`border-b-2 pb-3 text-sm transition ${profileTab === id ? 'border-violet-500 font-bold text-violet-600 dark:text-violet-300' : `border-transparent font-semibold hover:text-violet-600 ${muted}`}`}>{label}</button>
            ))}
          </div>
          {(profileTab === 'personal' ? [
            ['Personal information', 'Student record', [['Full name', student.name], ['Username', student.username], ['Email address', student.email]]],
            ['Identification details', 'Verified', [['Student ID', student.id], ['Account type', 'Active student'], ['Department', 'Computer Science']]],
            ['Biometric details', 'Enrolled', [['Fingerprint status', 'Ready for attendance'], ['Verification method', 'Fingerprint scanner'], ['Record status', 'Active']]],
          ] : [
            ['Academic details', 'Semester 2', [['Department', 'Computer Science'], ['Program', 'Bachelor of Computer Science'], ['Academic year', 'Year 3'], ['Current semester', 'Semester 2']]],
            ['Enrollment status', 'Active', [['Program status', 'Active student'], ['Attendance access', 'Enabled'], ['Current term', 'Academic year 2025–2026']]],
          ]).map(([title, status, fields]) => (
            <section key={title} className={`${card} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/10"><h3 className="text-sm font-extrabold">{title}</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${status === 'Verified' || status === 'Enrolled' || status === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : muted}`}>{status}</span></div>
              <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/5"><p className={`text-[10px] ${muted}`}>{label}</p><p className="mt-1 break-words text-sm font-bold">{value}</p></div>)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCourseBreakdown = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Semester performance" title="Attendance by course" copy="See which classes are strongest and where your attendance needs attention." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {displayCourseStats.map((course) => (
            <article key={course.code} className={`${card} group overflow-hidden shadow-[0_10px_28px_rgba(39,55,105,0.11)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(73,85,160,0.17)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.28)]`}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-xs font-black text-violet-700 transition duration-300 group-hover:scale-105 dark:bg-violet-400/10 dark:text-violet-300">{course.name.slice(0, 2).toUpperCase()}</span>
                  <button aria-label={`More options for ${course.name}`} className={`rounded-lg p-1.5 transition hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-400/10 ${muted}`}><MoreHorizontal size={17} /></button>
                </div>
                <p className={`mt-5 text-[10px] font-black uppercase tracking-[0.15em] ${muted}`}>{course.code}</p>
                <h3 className="mt-1 font-black">{course.name}</h3>
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs"><span className={`font-semibold ${muted}`}>Attendance</span><span className="font-black">{course.rate}%</span></div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100"><div className="h-full rounded-full bg-gradient-to-r from-[#8fcdf5] to-[#bfe3ff] transition-all duration-500" style={{ width: `${course.rate}%` }} /></div>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-white/5">
                  <div><b className="block text-xs">{course.present}</b><span className={`text-[9px] font-semibold ${muted}`}>Present</span></div>
                  <div><b className="block text-xs">{course.late}</b><span className={`text-[9px] font-semibold ${muted}`}>Late</span></div>
                  <div><b className="block text-xs">{course.absent}</b><span className={`text-[9px] font-semibold ${muted}`}>Absent</span></div>
                </div>
                <div className="mt-5 flex gap-2">
                  <button onClick={() => setActiveView('attendance')} className="flex-1 rounded-xl bg-gradient-to-r from-[#bfe3ff] to-[#dcefff] py-2.5 text-xs font-bold text-slate-700 shadow-sm transition hover:brightness-105">View attendance</button>
                  <button onClick={() => setActiveView('attendanceReport')} aria-label={`Open attendance report for ${course.name}`} className="rounded-xl border border-slate-200 px-3 text-violet-600 transition hover:border-violet-300 dark:border-white/10"><FileCheck2 size={16} /></button>
                </div>
              </div>
            </article>
        ))}
      </div>
    </div>
  );

  const submitExcuseRequest = async (event) => {
    event.preventDefault();
    if (excuseSubmitting) return;
    setExcuseSubmitting(true);
    setExcuseFeedback('');
    const submittedDraft = { ...excuseDraft };
    const temporaryRequest = {
      ...submittedDraft,
      id: Date.now(),
      studentUserId: currentUser.userid || null,
      studentId: student.id,
      student: student.name,
      status: 'Pending',
      submitted: new Date().toLocaleDateString(),
    };
    setExcuseRequests((items) => [temporaryRequest, ...items]);
    setExcuseDraft({ date: '', course: 'CS301', reason: 'Medical', details: '' });

    if (!currentUser.userid) {
      setExcuseFeedback('Request saved locally. It will sync when you sign in again.');
      setExcuseSubmitting(false);
      return;
    }
    try {
      const savedRequest = await createExcuseRequest({
        studentUserId: currentUser.userid,
        studentId: student.id,
        studentName: student.name,
        ...submittedDraft,
      });
      setExcuseRequests((items) => [savedRequest, ...items.filter((item) => item.id !== temporaryRequest.id)]);
      mergeExcuseCache([savedRequest]);
      setExcuseFeedback('Your absence request was submitted successfully.');
    } catch {
      setExcuseFeedback('Request saved locally. It will sync when the server is available.');
    } finally {
      setExcuseSubmitting(false);
    }
  };

  const renderExcuseRequests = () => (
    <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
      <form onSubmit={submitExcuseRequest} className={`${card} p-6`}>
        <HeaderBlock eyebrow="Absence support" title="Request an excuse" copy="Submit an explanation for a missed class." />
        <div className="mt-6 space-y-4">
          <label className="block text-xs font-bold">Absence date<input type="date" required value={excuseDraft.date} onChange={(e) => setExcuseDraft((value) => ({ ...value, date: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10" /></label>
          <label className="block text-xs font-bold">Course<select value={excuseDraft.course} onChange={(e) => setExcuseDraft((value) => ({ ...value, course: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#151d2c]">{displayCourseStats.map((course) => <option key={course.code} value={course.code}>{course.code} — {course.name}</option>)}</select></label>
          <label className="block text-xs font-bold">Reason<select value={excuseDraft.reason} onChange={(e) => setExcuseDraft((value) => ({ ...value, reason: e.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#151d2c]">{['Medical','Family emergency','University activity','Transportation','Other'].map((reason) => <option key={reason}>{reason}</option>)}</select></label>
          <label className="block text-xs font-bold">Explanation<textarea required rows="4" value={excuseDraft.details} onChange={(e) => setExcuseDraft((value) => ({ ...value, details: e.target.value }))} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-transparent p-3 text-sm dark:border-white/10" placeholder="Explain your absence..." /></label>
          {excuseFeedback && <p role="status" className="rounded-xl bg-sky-50 px-3 py-2.5 text-xs font-semibold text-sky-800">{excuseFeedback}</p>}
          <button disabled={excuseSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#60a5fa] py-3 text-sm font-bold text-white hover:bg-[#3b82f6] disabled:cursor-wait disabled:opacity-60"><Send size={16} />{excuseSubmitting ? 'Submitting…' : 'Submit request'}</button>
        </div>
      </form>
      <section className={`${card} overflow-hidden`}>
        <div className="border-b border-slate-100 p-5 dark:border-white/10"><h3 className="font-extrabold">My requests</h3><p className={`mt-1 text-xs ${muted}`}>Track submitted absence explanations.</p></div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {excuseRequests.length ? excuseRequests.map((request) => <div key={request.id} className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{request.course} · {request.reason}</p><p className={`mt-1 text-xs ${muted}`}>{request.date} · Submitted {request.submitted}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${request.status === 'Approved' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : request.status === 'Rejected' ? 'bg-rose-50 text-rose-700 dark:bg-rose-400/10 dark:text-rose-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'}`}>{request.status}</span></div><p className={`mt-3 text-sm ${muted}`}>{request.details}</p></div>) : <div className={`p-10 text-center text-sm ${muted}`}><FileCheck2 className="mx-auto mb-3 opacity-40" />No excuse requests submitted yet.</div>}
        </div>
      </section>
    </div>
  );

  const downloadReport = (courses = displayCourseStats) => {
    const rows = [['Course','Sessions','Present','Late','Absent','Rate'], ...courses.map((course) => [course.name, course.sessions, course.present, course.late, course.absent, `${course.rate}%`])];
    downloadCsv('attendance-report-semester-2.csv', rows);
  };

  const renderAttendanceReport = () => (
    <div className="space-y-6">
      <HeaderBlock eyebrow="Official record" title="Attendance report" copy="Semester 2 · Academic year 2025–2026" />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Overall attendance', value: `${attendanceTotals.rate}%`, detail: 'Current semester attendance', icon: TrendingUp },
          { label: 'Total sessions', value: String(attendanceTotals.total), detail: 'Recorded class sessions', icon: CalendarDays },
          { label: 'Present sessions', value: String(attendanceTotals.Present), detail: 'Verified fingerprint check-ins', icon: CheckCircle2 },
          { label: 'Missed sessions', value: String(attendanceTotals.Absent), detail: 'Absences this semester', icon: XCircle },
        ].map(({ label, value, detail, icon }) => (
          <article key={label} className={`${card} p-5`}>
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200">{React.createElement(icon, { size: 18 })}</span>
              <p className="text-sm font-semibold">{label}</p>
            </div>
            <p className="mt-5 text-3xl font-black tracking-tight">{value}</p>
            <p className={`mt-1 text-xs ${muted}`}>{detail}</p>
          </article>
        ))}
      </section>

      <section>
        <div className="flex border-b border-slate-200 dark:border-white/10" role="tablist" aria-label="Attendance report views">
          {[['summary', 'Attendance summary'], ['record', 'Semester record']].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={reportTab === id}
              onClick={() => setReportTab(id)}
              className={`border-b-2 px-1 pb-3 text-sm transition-colors first:mr-6 ${reportTab === id ? 'border-[#60a5fa] font-bold text-[#2563eb]' : `border-transparent font-medium hover:text-[#2563eb] ${muted}`}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">{reportTab === 'summary' ? 'Course attendance' : 'Official semester record'}</p>
            <p className={`mt-1 text-xs ${muted}`}>{reportTab === 'summary' ? 'A detailed breakdown of every enrolled course' : 'Semester 2 attendance totals for your enrolled courses'}</p>
          </div>
          <button onClick={() => downloadReport(filteredReportCourses)} disabled={!filteredReportCourses.length} className="flex items-center justify-center gap-2 rounded-xl bg-[#60a5fa] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#3b82f6] hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0">
            <Download size={16} />Export CSV
          </button>
        </div>

        <div className={`${card} overflow-hidden`}>
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <label className="relative block w-full sm:max-w-sm">
              <Search size={16} className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} />
              <input
                value={reportQuery}
                onChange={(event) => { setReportQuery(event.target.value); setReportPage(1); }}
                placeholder="Search course or code"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[#60a5fa] focus:ring-2 focus:ring-sky-200/60 dark:border-white/10 dark:bg-white/5"
              />
            </label>
            <select
              value={reportRateFilter}
              onChange={(event) => { setReportRateFilter(event.target.value); setReportPage(1); }}
              aria-label="Filter courses by attendance rate"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-[#60a5fa] focus:ring-2 focus:ring-sky-200/60 dark:border-white/10 dark:bg-[#151d2c]"
            >
              <option>All</option>
              <option>On track</option>
              <option>At risk</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-100/80 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300">
                <tr>{[
                  ['name', 'Course'], ['sessions', 'Sessions'], ['present', 'Present'],
                  ['late', 'Late'], ['absent', 'Absent'], ['rate', 'Rate'],
                ].map(([key, heading]) => (
                  <th key={key} className="px-5 py-4">
                    <button
                      onClick={() => {
                        setReportSort((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
                        setReportPage(1);
                      }}
                      className="inline-flex items-center gap-1.5 transition hover:text-[#2563eb]"
                    >
                      {heading}<span aria-hidden="true" className={reportSort.key === key ? 'text-[#2563eb]' : 'opacity-40'}>{reportSort.key === key ? (reportSort.direction === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </button>
                  </th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {visibleReportCourses.map((course) => (
                  <tr key={course.code} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`h-2.5 w-2.5 rounded-full ${course.color}`} />
                        <div><p className="font-bold">{course.name}</p><p className={`mt-0.5 text-xs ${muted}`}>{course.code}</p></div>
                      </div>
                    </td>
                    <td className="px-5 py-4">{course.sessions}</td>
                    <td className="px-5 py-4">{course.present}</td>
                    <td className="px-5 py-4">{course.late}</td>
                    <td className="px-5 py-4">{course.absent}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-bold ${course.rate >= 90 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300'}`}>{course.rate}%</span>
                    </td>
                  </tr>
                ))}
                {!visibleReportCourses.length && (
                  <tr><td colSpan="6" className={`px-5 py-12 text-center text-sm ${muted}`}>No courses match your search or filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
            <p className={`text-xs ${muted}`}>{filteredReportCourses.length ? `Showing ${(reportPage - 1) * reportPageSize + 1}–${Math.min(reportPage * reportPageSize, filteredReportCourses.length)} of ${filteredReportCourses.length} courses` : 'Showing 0 courses'}</p>
            <div className="flex items-center gap-2">
              <button aria-label="Previous report page" onClick={() => setReportPage((page) => Math.max(1, page - 1))} disabled={reportPage === 1} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 transition hover:border-[#60a5fa] hover:text-[#2563eb] disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200 dark:border-white/10 dark:disabled:text-slate-600"><ChevronLeft size={15} /></button>
              {Array.from({ length: reportPageCount }, (_, index) => index + 1).map((page) => <button key={page} onClick={() => setReportPage(page)} aria-label={`Report page ${page}`} aria-current={reportPage === page ? 'page' : undefined} className={`grid h-8 min-w-8 place-items-center rounded-lg px-2 text-xs font-bold transition ${reportPage === page ? 'bg-[#60a5fa] text-white' : 'border border-slate-200 hover:border-[#60a5fa] hover:text-[#2563eb] dark:border-white/10'}`}>{page}</button>)}
              <button aria-label="Next report page" onClick={() => setReportPage((page) => Math.min(reportPageCount, page + 1))} disabled={reportPage === reportPageCount} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 transition hover:border-[#60a5fa] hover:text-[#2563eb] disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-slate-200 dark:border-white/10 dark:disabled:text-slate-600"><ChevronRight size={15} /></button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const renderHelp = () => (
    <div className="space-y-6"><HeaderBlock eyebrow="Student support" title="How can we help?" copy="Quick answers for attendance, fingerprints, schedules, and account access." /><div className="grid gap-4 md:grid-cols-2">{[['Fingerprint not recognized','Clean the scanner, dry your finger, and try again. Contact your administrator after three failed attempts.'],['Attendance is incorrect','Open My Attendance, note the class and date, then submit an excuse request with the details.'],['Missing class schedule','Schedules are assigned through enrollment. Ask your administrator to verify that you are enrolled in the class.'],['Account or login issue','Contact the system administrator to reset your credentials or verify your student account.']].map(([title, copy]) => <article key={title} className={`${card} p-5`}><HelpCircle className="text-[#60a5fa]" size={20} /><h3 className="mt-3 font-extrabold">{title}</h3><p className={`mt-2 text-sm leading-6 ${muted}`}>{copy}</p></article>)}</div></div>
  );

  const renderSettings = () => {
    const updateSetting = (key, value) => setStudentSettings((current) => ({ ...current, [key]: value }));
    const Toggle = ({ setting, label }) => {
      const checked = studentSettings[setting];
      return (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => updateSetting(setting, !checked)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#60a5fa]' : 'bg-slate-200 dark:bg-white/15'}`}
        >
          <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      );
    };
    const notificationRows = [
      ['checkInReminders', 'Class check-in reminders', 'Notify me before fingerprint check-in opens.'],
      ['missedAttendanceAlerts', 'Missed attendance alerts', 'Let me know when a class is marked absent or unverified.'],
      ['excuseUpdates', 'Excuse request updates', 'Receive a notification when a teacher reviews my request.'],
      ['weeklySummary', 'Weekly attendance summary', 'Get a short attendance recap at the end of each week.'],
    ];

    return (
      <div className="space-y-6">
        <HeaderBlock eyebrow="Preferences" title="Settings" copy="Manage notifications, appearance, attendance preferences, and account security." />

        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
          <section className={`${card} overflow-hidden`}>
            <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-white/10">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-[#3b82f6] dark:bg-sky-400/10 dark:text-sky-300"><Bell size={19} /></span>
              <div><h3 className="font-extrabold">Attendance notifications</h3><p className={`mt-0.5 text-xs ${muted}`}>Choose which updates you want to receive.</p></div>
            </div>
            <div className="divide-y divide-slate-100 px-5 dark:divide-white/10">
              {notificationRows.map(([setting, title, copy]) => (
                <div key={setting} className="flex items-center justify-between gap-5 py-4">
                  <div><p className="text-sm font-bold">{title}</p><p className={`mt-1 text-xs leading-5 ${muted}`}>{copy}</p></div>
                  <Toggle setting={setting} label={title} />
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-5">
            <section className={`${card} p-5`}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300"><Fingerprint size={19} /></span>
                <div><h3 className="font-extrabold">Fingerprint status</h3><p className={`mt-0.5 text-xs ${muted}`}>Your attendance identity</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-emerald-50/70 p-3 dark:bg-emerald-400/[0.08]">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300"><CheckCircle2 size={15} />Enrolled and ready</span>
                <span className={`text-[10px] ${muted}`}>Verified</span>
              </div>
              <button onClick={() => setActiveView('profile')} className="mt-3 w-full rounded-xl border border-slate-200 py-2.5 text-xs font-bold transition hover:border-[#60a5fa] hover:text-[#2563eb] dark:border-white/10">View student profile</button>
            </section>

            <section className={`${card} p-5`}>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"><ShieldCheck size={19} /></span>
                <div className="flex-1"><h3 className="font-extrabold">Login alerts</h3><p className={`mt-0.5 text-xs ${muted}`}>Notify me about new device sign-ins.</p></div>
                <Toggle setting="loginAlerts" label="Login alerts" />
              </div>
            </section>
          </div>
        </div>

        <AccountSecurity
          user={currentUser}
          storageKey={`studentSecurity:${currentUser.userid || student.username}`}
          card={card}
          muted={muted}
        />

        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-slate-100 p-5 dark:border-white/10"><h3 className="font-extrabold">My preferences</h3><p className={`mt-1 text-xs ${muted}`}>Personalize how the student portal works for you.</p></div>
          <div className="divide-y divide-slate-100 px-5 dark:divide-white/10">
            <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-bold">Appearance</p><p className={`mt-1 text-xs ${muted}`}>Choose a bright campus-inspired theme.</p></div>
              <div className="flex gap-2">
                {[{ dark: false, label: 'Daylight', icon: Sun }, { dark: true, label: 'Soft sky', icon: Moon }].map(({ dark, label, icon }) => (
                  <button key={label} onClick={() => setIsDark(dark)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${isDark === dark ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-slate-200 text-slate-600 hover:border-sky-300'}`}>{React.createElement(icon, { size: 15 })}{label}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-bold">Class reminder time</p><p className={`mt-1 text-xs ${muted}`}>When should the portal remind you about your next class?</p></div>
              <select value={studentSettings.reminderTime} onChange={(event) => updateSetting('reminderTime', event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-[#60a5fa] dark:border-white/10 dark:bg-[#151d2c]">
                {['5 minutes before', '15 minutes before', '30 minutes before', '1 hour before'].map((value) => <option key={value}>{value}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-sm font-bold">Language</p><p className={`mt-1 text-xs ${muted}`}>Choose your preferred dashboard language.</p></div>
              <select value={studentSettings.language} onChange={(event) => updateSetting('language', event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold outline-none focus:border-[#60a5fa] dark:border-white/10 dark:bg-[#151d2c]">
                <option>English</option><option>Khmer</option>
              </select>
            </div>
          </div>
        </section>

        <section className={`${card} flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between`}>
          <div><h3 className="font-extrabold">Account session</h3><p className={`mt-1 text-xs ${muted}`}>You are signed in on this device. Sign out safely when you are finished.</p></div>
          <button onClick={onLogout} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-100 dark:bg-rose-400/10 dark:text-rose-300"><LogOut size={16} />Sign out</button>
        </section>
      </div>
    );
  };

  const content = { dashboard: renderOverview, attendance: renderAttendance, schedule: renderSchedule, courseBreakdown: renderCourseBreakdown, excuseRequests: renderExcuseRequests, attendanceReport: renderAttendanceReport, help: renderHelp, profile: renderProfile, settings: renderSettings };

  return (
    <div className={`${isDark ? 'soft-sky' : ''} student-dashboard campus-dashboard`}>
      <ProfilePhotoEditor key={profilePhotoEditorSource || 'closed'} source={profilePhotoEditorSource} name={student.name} onCancel={() => setProfilePhotoEditorSource('')} onSave={saveProfilePhoto} />
      {correctionRecord && <div className="fixed inset-0 z-[140] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setCorrectionRecord(null)}><form onSubmit={submitCorrection} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#151d2c]"><div className="flex items-start justify-between gap-3"><div><p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Attendance correction</p><h3 className="mt-1 text-lg font-black">{correctionRecord.code} · {correctionRecord.date}</h3></div><button type="button" onClick={() => setCorrectionRecord(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={18} /></button></div><div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs dark:bg-white/5"><span className={muted}>Currently recorded</span><div className="mt-2 flex items-center justify-between"><b>{correctionRecord.subject}</b><Badge status={correctionRecord.status} /></div></div><div className="mt-5 space-y-4"><label className="block text-xs font-bold">Correct status<select value={correctionDraft.expectedStatus} onChange={(event) => setCorrectionDraft((value) => ({ ...value, expectedStatus: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-[#151d2c]">{['Present','Late','Absent'].filter((status) => status !== correctionRecord.status).map((status) => <option key={status}>{status}</option>)}</select></label><label className="block text-xs font-bold">What went wrong?<textarea required rows="4" value={correctionDraft.reason} onChange={(event) => setCorrectionDraft((value) => ({ ...value, reason: event.target.value }))} placeholder="For example: I checked in at 07:56, but the record shows absent." className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-transparent p-3 text-sm outline-none focus:border-sky-400 dark:border-white/10" /></label></div><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setCorrectionRecord(null)} className="rounded-xl border border-slate-200 py-3 text-sm font-bold dark:border-white/10">Cancel</button><button type="submit" className="rounded-xl bg-sky-500 py-3 text-sm font-bold text-white hover:bg-sky-600">Submit correction</button></div></form></div>}
      {reviewToast && <button onClick={() => { setActiveView('excuseRequests'); setReviewToast(''); }} className="fixed right-5 top-5 z-[120] flex max-w-sm items-start gap-3 rounded-2xl border border-violet-200 bg-white p-4 text-left shadow-2xl transition hover:-translate-y-0.5 dark:border-violet-400/20 dark:bg-[#151d2c]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300"><FileCheck2 size={17} /></span><span><b className="block text-sm">Absence request updated</b><span className={`mt-1 block text-xs leading-5 ${muted}`}>{reviewToast}</span></span></button>}
      <div className="campus-shell flex min-h-screen text-slate-800">
        {sidebarOpen && <button aria-label="Close navigation" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm lg:hidden" />}
        <aside className={`campus-sidebar fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/80 transition-all duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${sidebarCollapsed ? 'lg:w-20' : 'lg:w-64'} ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <button
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="absolute -right-3 top-[68px] z-50 hidden h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-[0_3px_10px_rgba(15,23,42,0.16)] transition-all duration-200 hover:scale-110 hover:border-[#60a5fa] hover:bg-[#60a5fa] hover:text-white dark:border-white/15 dark:bg-[#151d2c] lg:flex"
          >
            {sidebarCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
          </button>
          <div className="flex h-20 items-center justify-between border-b border-slate-200 px-4 dark:border-white/10">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#3b82f6] shadow-[0_10px_20px_rgba(59,130,246,0.16)]">
                <Fingerprint size={26} strokeWidth={2.25} />
              </div>
              <div className={sidebarCollapsed ? 'lg:hidden' : ''}>
                <p className="text-[16px] font-black tracking-[-0.04em] text-slate-900 dark:text-white">Smart Attendance</p>
                <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Student portal</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-slate-500 lg:hidden"><X size={20} /></button>
          </div>
          <nav className={`flex-1 overflow-y-auto ${sidebarCollapsed ? 'lg:px-2 lg:py-4' : 'p-4'}`}>
            <div className={`mb-2 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.12em] ${muted} ${sidebarCollapsed ? 'lg:hidden' : ''}`}><span>General</span><MoreHorizontal size={16} /></div>
            <div className="space-y-1">
              {nav.map(({ id, label, icon }) => (
                <button
                  key={id}
                  title={sidebarCollapsed ? label : undefined}
                  onClick={() => { setActiveView(id); setSidebarOpen(false); }}
                  className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all duration-200 ${
                    activeView === id
                      ? 'bg-white text-slate-950 shadow-[0_2px_10px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10'
                      : 'text-slate-500 hover:translate-x-1 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                    activeView === id
                      ? 'bg-[#60a5fa] text-white shadow-sm'
                      : 'text-slate-500 group-hover:rotate-[-4deg] group-hover:scale-105 group-hover:bg-[#60a5fa] group-hover:text-white dark:text-slate-400'
                  }`}>
                    {React.createElement(icon, { size: 17, strokeWidth: 2 })}
                  </span>
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{label}</span>
                </button>
              ))}
            </div>

            <div className={`mb-2 mt-7 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.12em] ${muted} ${sidebarCollapsed ? 'lg:hidden' : ''}`}><span>Attendance</span><MoreHorizontal size={16} /></div>
            <div className="space-y-1">
              {attendanceNav.map(({ id, label, icon }) => (
                <button key={id} title={sidebarCollapsed ? label : undefined} onClick={() => { setActiveView(id); setSidebarOpen(false); }} className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all duration-200 hover:translate-x-1 hover:shadow-sm ${activeView === id ? 'bg-white text-slate-950 shadow-[0_2px_10px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 hover:shadow-md dark:bg-white/10 dark:text-white dark:ring-white/10' : 'text-slate-500 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200 group-hover:-rotate-6 group-hover:scale-110 ${activeView === id ? 'bg-[#60a5fa] text-white shadow-sm group-hover:bg-[#3b82f6]' : 'group-hover:bg-[#60a5fa] group-hover:text-white'}`}>{React.createElement(icon, { size: 17 })}</span>
                  <span className={sidebarCollapsed ? 'lg:hidden' : ''}>{label}</span>
                </button>
              ))}
            </div>

            <div className={`mb-2 mt-7 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-[0.12em] ${muted} ${sidebarCollapsed ? 'lg:hidden' : ''}`}><span>Support</span><MoreHorizontal size={16} /></div>
            <div className="space-y-1">
              <button onClick={() => { setActiveView('help'); setSidebarOpen(false); }} title={sidebarCollapsed ? 'Help center' : undefined} className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all duration-200 ${activeView === 'help' ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10' : 'text-slate-500 hover:translate-x-1 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${activeView === 'help' ? 'bg-[#60a5fa] text-white' : 'group-hover:rotate-[-4deg] group-hover:scale-105 group-hover:bg-[#60a5fa] group-hover:text-white'}`}><HelpCircle size={17} /></span>
                <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Help center</span>
              </button>
            </div>
          </nav>
          <div className="border-t border-slate-200 p-4 dark:border-white/10">
            <div title="Fingerprint enrolled" className={`mb-2 flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300 ${sidebarCollapsed ? 'lg:justify-center' : ''}`}><span className="relative"><Fingerprint size={18} /><span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-50 dark:ring-[#17281f]" /></span><div className={sidebarCollapsed ? 'lg:hidden' : ''}><p className="text-[11px] font-extrabold">Fingerprint ready</p><p className="text-[9px] opacity-75">Enrolled and active</p></div></div>
            <button title={sidebarCollapsed ? 'Settings' : undefined} onClick={() => { setActiveView('settings'); setSidebarOpen(false); }} className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-semibold transition-all duration-200 ${sidebarCollapsed ? 'lg:justify-center' : ''} ${activeView === 'settings' ? 'bg-white text-slate-950 shadow-[0_2px_10px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 dark:bg-white/10 dark:text-white dark:ring-white/10' : 'text-slate-500 hover:translate-x-1 hover:bg-white/70 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white'}`}>
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${activeView === 'settings' ? 'bg-[#60a5fa] text-white' : 'group-hover:rotate-45 group-hover:scale-105 group-hover:bg-[#60a5fa] group-hover:text-white'}`}><Settings size={17} /></span>
              <span className={sidebarCollapsed ? 'lg:hidden' : ''}>Settings</span>
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <main className={`mx-auto w-full ${activeView === 'schedule' ? 'max-w-none p-3 sm:p-4' : 'max-w-[1600px] p-4 sm:p-5'}`}>
            <div className="relative mb-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button aria-label="Open navigation" onClick={() => setSidebarOpen(true)} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5 lg:hidden"><Menu size={20} /></button>
                <p className="text-xl font-black">{viewNames[activeView]}</p>
              </div>
              <div className="relative flex items-center gap-2">
                <form onSubmit={(event) => { event.preventDefault(); if (searchResults[0]) openSearchResult(searchResults[0]); }} className="relative hidden sm:block">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input ref={searchInputRef} value={globalQuery} onFocus={() => setSearchOpen(true)} onChange={(event) => { setGlobalQuery(event.target.value); setSearchOpen(true); }} className="w-64 rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-14 text-sm outline-none transition focus:border-[#60a5fa] focus:ring-2 focus:ring-sky-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-sky-400/10" placeholder="Search anything" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 dark:border-white/10 dark:bg-white/5">↵</span>
                  {searchOpen && globalQuery.trim() && <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#151d2c]">{searchResults.length ? searchResults.map((result, index) => { const ResultIcon = result.icon; return <button type="button" key={`${result.title}-${index}`} onMouseDown={(event) => event.preventDefault()} onClick={() => openSearchResult(result)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-sky-50 dark:hover:bg-sky-400/10"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/5"><ResultIcon size={15} /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold">{result.title}</span><span className={`mt-0.5 block truncate text-[10px] ${muted}`}>{result.subtitle}</span></span>{index === 0 && <span className={`text-[9px] ${muted}`}>Enter</span>}</button>; }) : <p className={`p-5 text-center text-xs ${muted}`}>No matching pages, classes, or records.</p>}</div>}
                </form>
                <button aria-label="Notifications" aria-expanded={notificationsOpen} onClick={openStudentNotifications} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:border-[#60a5fa] hover:text-[#3b82f6] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"><Bell size={18} />{(unreadExcuseReviews.length > 0 || displayedCorrectionReviews.length > 0 || checkInConfirmationVisible || (lowAttendanceCourses.length > 0 && !lowAttendanceNotificationDismissed)) && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0d1422]" />}</button>
                <button onClick={() => { setActiveView('profile'); setNotificationsOpen(false); setSearchOpen(false); }} aria-label="Open my profile" title="My profile" className={`group grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border-2 bg-white shadow-sm transition hover:scale-105 hover:border-sky-400 dark:bg-white/5 ${activeView === 'profile' ? 'border-sky-400 ring-2 ring-sky-100 dark:ring-sky-400/10' : 'border-white ring-1 ring-slate-200 dark:border-[#121a29] dark:ring-white/15'}`}>
                  {profilePhoto ? <img src={profilePhoto} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center bg-gradient-to-br from-sky-100 to-violet-100 text-xs font-black text-violet-700 dark:from-sky-400/15 dark:to-violet-400/15 dark:text-violet-300">{initials}</span>}
                </button>
                {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#151d2c]"><div className="flex items-center justify-between gap-3"><h3 className="text-sm font-extrabold">Notifications</h3><div className="flex items-center gap-2">{(displayedStudentReviews.length > 0 || displayedCorrectionReviews.length > 0 || checkInConfirmationVisible || !studentGeneralNotificationDismissed || !lowAttendanceNotificationDismissed) && <button onClick={clearStudentNotifications} className="text-[11px] font-bold text-violet-600 hover:text-violet-800 dark:text-violet-300">Clear all</button>}<button onClick={() => setNotificationsOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"><X size={16} /></button></div></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">{checkInConfirmationVisible && <button onClick={() => { setActiveView('attendance'); setNotificationsOpen(false); setCheckInConfirmationVisible(false); localStorage.setItem(`studentCheckInConfirmationDismissed:${student.id}`, 'true'); }} className="w-full rounded-xl bg-emerald-50 p-3 text-left dark:bg-emerald-400/10"><p className="text-xs font-bold">Fingerprint attendance confirmed</p><p className={`mt-1 text-[11px] ${muted}`}>CS301 · Present at 07:56 AM</p></button>}{!lowAttendanceNotificationDismissed && lowAttendanceCourses.map((course) => <button key={course.code} onClick={() => { setActiveView('courseBreakdown'); setNotificationsOpen(false); setLowAttendanceNotificationDismissed(true); localStorage.setItem(`studentLowAttendanceNotificationDismissed:${student.id}`, 'true'); }} className="w-full rounded-xl bg-amber-50 p-3 text-left dark:bg-amber-400/10"><p className="text-xs font-bold">Low attendance warning</p><p className={`mt-1 text-[11px] ${muted}`}>{course.code} is currently {course.rate}%</p></button>)}{displayedCorrectionReviews.map((request) => <button key={`${request.id}-${request.status}`} onClick={() => { setActiveView('attendance'); setNotificationsOpen(false); }} className={`w-full rounded-xl p-3 text-left ${request.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-400/10' : 'bg-rose-50 dark:bg-rose-400/10'}`}><p className="text-xs font-bold">Correction request {request.status.toLowerCase()}</p><p className={`mt-1 text-[11px] ${muted}`}>{request.course} · {request.date}</p></button>)}{displayedStudentReviews.map((request) => <button key={`${request.id}-${request.status}`} onClick={() => { setActiveView('excuseRequests'); setNotificationsOpen(false); }} className={`w-full rounded-xl p-3 text-left ${request.status === 'Approved' ? 'bg-emerald-50 dark:bg-emerald-400/10' : 'bg-rose-50 dark:bg-rose-400/10'}`}><p className="text-xs font-bold">Absence request {request.status.toLowerCase()}</p><p className={`mt-1 text-[11px] ${muted}`}>{request.course} · {request.date}</p></button>)}{!studentGeneralNotificationDismissed && <button onClick={() => { setActiveView('schedule'); setNotificationsOpen(false); }} className="w-full rounded-xl bg-sky-50 p-3 text-left dark:bg-sky-400/10"><p className="text-xs font-bold">Fingerprint check-in opens soon</p><p className={`mt-1 text-[11px] ${muted}`}>Web Development · 07:45 AM</p></button>}{!checkInConfirmationVisible && (lowAttendanceNotificationDismissed || !lowAttendanceCourses.length) && !displayedCorrectionReviews.length && !displayedStudentReviews.length && studentGeneralNotificationDismissed && <p className={`rounded-xl bg-slate-50 p-4 text-center text-xs dark:bg-white/5 ${muted}`}>You’re all caught up.</p>}</div></div>}
              </div>
            </div>
            {content[activeView]?.()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
