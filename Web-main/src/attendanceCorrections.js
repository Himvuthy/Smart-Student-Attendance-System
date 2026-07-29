export const ATTENDANCE_CORRECTIONS_KEY = 'attendanceCorrectionRequests';

export const readAttendanceCorrections = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(ATTENDANCE_CORRECTIONS_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((request, index, requests) =>
      requests.findIndex((candidate) => candidate.id === request.id) === index,
    );
  } catch {
    return [];
  }
};

export const writeAttendanceCorrections = (requests) => {
  localStorage.setItem(ATTENDANCE_CORRECTIONS_KEY, JSON.stringify(requests));
  window.dispatchEvent(new CustomEvent('attendance-corrections-updated', { detail: requests }));
};

export const submitAttendanceCorrection = (request) => {
  const current = readAttendanceCorrections();
  const existing = current.find((item) =>
    item.studentId === request.studentId &&
    item.course === request.course &&
    item.date === request.date &&
    item.status === 'Pending',
  );
  if (existing) return existing;

  const next = [{ ...request, id: `correction-${Date.now()}`, status: 'Pending', submittedAt: new Date().toISOString() }, ...current];
  writeAttendanceCorrections(next);
  return next[0];
};

export const reviewAttendanceCorrection = (id, status) => {
  const next = readAttendanceCorrections().map((request) => request.id === id ? { ...request, status, reviewedAt: new Date().toISOString() } : request);
  writeAttendanceCorrections(next);
  return next.find((request) => request.id === id);
};
