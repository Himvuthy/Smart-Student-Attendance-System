export const OFFICIAL_TIMETABLE_KEY = 'officialTimetable';

export const defaultOfficialTimetable = [
  { id: 'schedule-1', classCode: 'CS301', subject: 'Data Structures', day: 'Monday', start: '08:00', end: '09:30', room: 'A201', teacher: 'Mr. Vuthy Him' },
  { id: 'schedule-2', classCode: 'CS309', subject: 'Web Development', day: 'Wednesday', start: '08:00', end: '09:30', room: 'Lab C302', teacher: 'Mr. Vuthy Him' },
  { id: 'schedule-3', classCode: 'CS312', subject: 'Software Engineering', day: 'Tuesday', start: '10:00', end: '11:30', room: 'A108', teacher: 'Mr. Vuthy Him' },
  { id: 'schedule-4', classCode: 'CS305', subject: 'Database Systems', day: 'Thursday', start: '11:00', end: '12:30', room: 'B105', teacher: 'Mr. Vuthy Him' },
  { id: 'schedule-5', classCode: 'CS301', subject: 'Data Structures', day: 'Tuesday', start: '13:00', end: '14:30', room: 'A201', teacher: 'Mr. Vuthy Him' },
];

export const readOfficialTimetable = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(OFFICIAL_TIMETABLE_KEY) || 'null');
    return Array.isArray(stored) ? stored : defaultOfficialTimetable;
  } catch {
    return defaultOfficialTimetable;
  }
};

export const writeOfficialTimetable = (entries) => {
  localStorage.setItem(OFFICIAL_TIMETABLE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent('official-timetable-updated', { detail: entries }));
};
