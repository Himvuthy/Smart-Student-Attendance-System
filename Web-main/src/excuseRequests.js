const API_BASE = import.meta.env.VITE_API_URL || 'https://smart-student-attendance-system-nkka.onrender.com';
export const EXCUSE_CACHE_KEY = 'attendanceExcuseRequests';

const normalizeStatus = (value) => {
  const status = String(value || 'Pending').trim().toLowerCase();
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  return 'Pending';
};

const normalizeExcuseRequest = (request = {}) => ({
  ...request,
  id: request.id ?? request.requestid,
  student: request.student ?? request.student_name ?? 'Student',
  studentId: request.studentId ?? request.studentid,
  studentUserId: request.studentUserId ?? request.studentuserid,
  course: request.course ?? request.subject ?? 'Unassigned course',
  date: request.date ?? request.requestdate,
  submitted: request.submitted ?? request.createdat,
  status: normalizeStatus(request.status),
});

export const readExcuseCache = (fallback = []) => {
  try {
    const saved = JSON.parse(localStorage.getItem(EXCUSE_CACHE_KEY) || 'null');
    return (Array.isArray(saved) ? saved : fallback).map(normalizeExcuseRequest);
  } catch {
    return fallback;
  }
};

export const writeExcuseCache = (requests) => {
  localStorage.setItem(EXCUSE_CACHE_KEY, JSON.stringify(requests));
  window.dispatchEvent(new CustomEvent('excuse-requests-updated', { detail: requests }));
};

export const mergeExcuseCache = (requests) => {
  const merged = new Map(readExcuseCache().map((request) => [String(request.id), request]));
  requests.forEach((request) => merged.set(String(request.id), request));
  const result = [...merged.values()].sort((a, b) => {
    const right = new Date(b.submittedAt || b.submitted || 0).getTime() || Number(b.id) || 0;
    const left = new Date(a.submittedAt || a.submitted || 0).getTime() || Number(a.id) || 0;
    return right - left;
  });
  writeExcuseCache(result);
  return result;
};

const parseResponse = async (response) => {
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) throw new Error(data.error || 'Request could not be completed');
  return data;
};

export const fetchExcuseRequests = async (studentUserId) => {
  const query = studentUserId ? `?studentUserId=${encodeURIComponent(studentUserId)}` : '';
  const requests = await parseResponse(await fetch(`${API_BASE}/api/excuse-requests${query}`));
  return Array.isArray(requests) ? requests.map(normalizeExcuseRequest) : [];
};

export const createExcuseRequest = async (request) => normalizeExcuseRequest(await parseResponse(await fetch(`${API_BASE}/api/excuse-requests`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    studentUserId: request.studentUserId,
    scheduleid: request.scheduleid || null,
    requestdate: request.requestdate || request.date,
    reason: request.reason,
    details: request.details,
  }),
})));

export const reviewExcuseRequest = async (requestId, status, reviewerUserId) => normalizeExcuseRequest(await parseResponse(await fetch(`${API_BASE}/api/excuse-requests/${requestId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status, reviewerUserId }),
})));
