import { useRef, useState } from 'react';
import { ImageOff, Trash2, Upload } from 'lucide-react';
import { api } from '../api';
import type { Station } from '../types';
import { useToast } from './Toast';
import { Button } from './ui';
import { cn } from '../lib';

/**
 * Manages a station's logo. Uploading replaces the old Cloudinary asset (the
 * API deletes it server-side) and stores the new hosted URL.
 */
export default function ImageUploader({ station, onChange }: { station: Station; onChange: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const preview = station.image_hosted || station.image_url;

  const upload = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('error', 'Please choose an image file');
    setBusy(true);
    try {
      await api.upload(`/stations/${station.id}/image`, file);
      toast('success', station.image_hosted ? 'Logo replaced (old one deleted)' : 'Logo uploaded');
      onChange();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.del(`/stations/${station.id}/image`);
      toast('success', 'Logo removed from Cloudinary');
      onChange();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Remove failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex gap-4">
      <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-ink-200 bg-ink-50 dark:border-ink-700 dark:bg-ink-850">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageOff size={22} className="text-ink-300" />
        )}
      </div>
      <div className="flex-1">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            upload(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            'flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed text-center text-xs transition',
            drag
              ? 'border-signal-400 bg-signal-50 text-signal-600 dark:bg-signal-500/10'
              : 'border-ink-300 text-ink-400 hover:border-signal-300 dark:border-ink-700',
          )}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={18} className="mb-1" />
          <span className="font-medium">
            {busy ? 'Working…' : station.image_hosted ? 'Drop to replace logo' : 'Drop or click to upload'}
          </span>
          <span className="font-mono text-[10px] text-ink-400">PNG / JPG · stored on Cloudinary</span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        {station.image_hosted && (
          <Button variant="ghost" onClick={remove} loading={busy} className="mt-2 text-red-500">
            <Trash2 size={14} /> Remove logo
          </Button>
        )}
      </div>
    </div>
  );
}
