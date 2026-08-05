import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'https://smart-student-attendance-system-nkka.onrender.com';

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#8b5cf6] dark:border-white/10 dark:bg-[#151d2c]';

export default function AccountSecurity({ user, card, muted }) {
  const [modal, setModal] = useState(null);
  const [passwords, setPasswords] = useState({ current: '', next: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const closeModal = () => {
    setModal(null);
    setPasswords({ current: '', next: '', confirm: '' });
    setFeedback({ type: '', text: '' });
  };

  const changePassword = async (event) => {
    event.preventDefault();
    setFeedback({ type: '', text: '' });
    if (passwords.next.length < 8) {
      setFeedback({ type: 'error', text: 'Your new password must contain at least 8 characters.' });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      setFeedback({ type: 'error', text: 'The new passwords do not match.' });
      return;
    }
    if (passwords.current === passwords.next) {
      setFeedback({ type: 'error', text: 'Choose a password different from your current password.' });
      return;
    }
    if (!user?.userid) {
      setFeedback({ type: 'error', text: 'Your session has expired. Please sign in again.' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.userid,
          currentPassword: passwords.current,
          newPassword: passwords.next,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to change password.');
      setPasswords({ current: '', next: '', confirm: '' });
      setFeedback({ type: 'success', text: 'Password changed successfully.' });
    } catch (error) {
      setFeedback({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const renderFeedback = () => feedback.text ? (
    <div className={`mt-4 rounded-xl px-3 py-2.5 text-xs font-semibold ${
      feedback.type === 'error'
        ? 'bg-rose-50 text-rose-600 dark:bg-rose-400/10 dark:text-rose-300'
        : feedback.type === 'success'
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300'
          : 'bg-violet-50 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300'
    }`}>{feedback.text}</div>
  ) : null;

  return (
    <>
      <section className={`${card} overflow-hidden`}>
        <div className="flex items-center gap-3 border-b border-slate-100 p-5 dark:border-white/10">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-400/10 dark:text-violet-300">
            <ShieldCheck size={19} />
          </span>
          <div>
            <h3 className="font-extrabold">Account security</h3>
            <p className={`mt-0.5 text-xs ${muted}`}>Protect your dashboard and sign-in details.</p>
          </div>
        </div>
        <div className="divide-y divide-slate-100 px-5 dark:divide-white/10">
          <div className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <KeyRound size={18} className="mt-0.5 text-violet-500" />
              <div><p className="text-sm font-bold">Change password</p><p className={`mt-1 text-xs ${muted}`}>Use at least 8 characters and avoid reused passwords.</p></div>
            </div>
            <button onClick={() => { setFeedback({ type: '', text: '' }); setModal('password'); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold transition hover:border-violet-400 hover:text-violet-600 dark:border-white/10">
              Change password
            </button>
          </div>
        </div>
      </section>

      {modal && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}>
          <section role="dialog" aria-modal="true" aria-labelledby="security-dialog-title" className={`${card} w-full max-w-md p-5 shadow-2xl`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="security-dialog-title" className="text-lg font-black">Change password</h3>
                <p className={`mt-1 text-xs leading-5 ${muted}`}>Confirm your current password before choosing a new one.</p>
              </div>
              <button onClick={closeModal} aria-label="Close security dialog" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10"><X size={18} /></button>
            </div>

            <form onSubmit={changePassword} className="mt-5 space-y-4">
                {[['current', 'Current password'], ['next', 'New password'], ['confirm', 'Confirm new password']].map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="mb-1.5 block text-xs font-bold">{label}</span>
                    <span className="relative block">
                      <input required type={showPasswords ? 'text' : 'password'} value={passwords[key]} onChange={(event) => setPasswords((current) => ({ ...current, [key]: event.target.value }))} className={`${inputClass} pr-11`} />
                      <button type="button" onClick={() => setShowPasswords((visible) => !visible)} aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-violet-500">{showPasswords ? <EyeOff size={17} /> : <Eye size={17} />}</button>
                    </span>
                  </label>
                ))}
                {renderFeedback()}
                <button disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#526fd5] to-[#8257df] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60">
                  {saving ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}{saving ? 'Updating…' : 'Update password'}
                </button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
