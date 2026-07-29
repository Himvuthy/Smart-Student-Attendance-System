import React, { useEffect, useRef, useState } from 'react';
import { Check, Minus, Plus, RotateCcw, X } from 'lucide-react';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const ProfilePhotoEditor = ({ source, name, onCancel, onSave }) => {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!source) return undefined;
    const close = (event) => event.key === 'Escape' && onCancel();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [source, onCancel]);

  if (!source) return null;

  const saveCroppedPhoto = async () => {
    setSaving(true);
    try {
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = source;
      });
      const size = 512;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      const coverScale = Math.max(size / image.naturalWidth, size / image.naturalHeight);
      const scale = coverScale * zoom;
      const width = image.naturalWidth * scale;
      const height = image.naturalHeight * scale;
      const maxX = Math.max(0, (width - size) / 2);
      const maxY = Math.max(0, (height - size) / 2);
      const x = (size - width) / 2 + (offsetX / 100) * maxX;
      const y = (size - height) / 2 + (offsetY / 100) * maxY;
      context.fillStyle = '#f8fafc';
      context.fillRect(0, 0, size, size);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, x, y, width, height);
      onSave(canvas.toDataURL('image/jpeg', 0.88));
    } finally {
      setSaving(false);
    }
  };

  const startDrag = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, offsetX, offsetY };
  };

  const drag = (event) => {
    if (!dragRef.current) return;
    setOffsetX(clamp(dragRef.current.offsetX + (event.clientX - dragRef.current.x) * 0.8, -100, 100));
    setOffsetY(clamp(dragRef.current.offsetY + (event.clientY - dragRef.current.y) * 0.8, -100, 100));
  };

  return (
    <div className="fixed inset-0 z-[150] grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section role="dialog" aria-modal="true" aria-labelledby="photo-editor-title" className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#121a29] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><h2 id="photo-editor-title" className="text-lg font-black">Edit profile picture</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Drag to reposition and use the controls to crop {name}’s photo.</p></div>
          <button onClick={onCancel} aria-label="Close photo editor" className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-white"><X size={19} /></button>
        </div>

        <div className="mt-6 grid place-items-center">
          <div
            onPointerDown={startDrag}
            onPointerMove={drag}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            className="relative h-64 w-64 touch-none cursor-grab overflow-hidden rounded-full bg-slate-100 shadow-inner ring-8 ring-sky-50 active:cursor-grabbing dark:bg-white/5 dark:ring-sky-400/10"
          >
            <img src={source} alt="Profile crop preview" draggable="false" className="h-full w-full select-none object-cover will-change-transform" style={{ transform: `translate(${offsetX * 0.45}px, ${offsetY * 0.45}px) scale(${zoom})` }} />
            <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-slate-900/10" />
          </div>
          <p className="mt-3 text-[10px] font-semibold text-slate-400">Drag the image inside the circle</p>
        </div>

        <div className="mt-6 space-y-4 rounded-2xl bg-slate-50 p-4 dark:bg-white/[0.04]">
          <label className="block"><span className="mb-2 flex items-center justify-between text-xs font-bold"><span>Zoom</span><span className="text-slate-400">{Math.round(zoom * 100)}%</span></span><div className="flex items-center gap-3"><Minus size={15} className="text-slate-400" /><input aria-label="Photo zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-full accent-sky-500" /><Plus size={15} className="text-slate-400" /></div></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Horizontal position<input aria-label="Horizontal photo position" type="range" min="-100" max="100" value={offsetX} onChange={(event) => setOffsetX(Number(event.target.value))} className="mt-2 w-full accent-sky-500" /></label>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Vertical position<input aria-label="Vertical photo position" type="range" min="-100" max="100" value={offsetY} onChange={(event) => setOffsetY(Number(event.target.value))} className="mt-2 w-full accent-sky-500" /></label>
          </div>
          <button onClick={() => { setZoom(1); setOffsetX(0); setOffsetY(0); }} className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-500 transition hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-300"><RotateCcw size={13} />Reset crop</button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">Cancel</button>
          <button onClick={saveCroppedPhoto} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-sm font-bold text-white transition hover:bg-sky-600 disabled:opacity-60"><Check size={16} />{saving ? 'Saving…' : 'Save photo'}</button>
        </div>
      </section>
    </div>
  );
};

export default ProfilePhotoEditor;
