import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AudioX } from 'audio_x';
import { Loader2, Pause, Play, Radio, X } from 'lucide-react';
import type { Station } from './types';
import { cn } from './lib';

interface Current {
  id: number;
  name: string;
  url: string;
}
interface PlayerState {
  current: Current | null;
  state: string; // playbackState from audio_x
  play: (s: Station) => void;
  toggle: () => void;
  stop: () => void;
}

const Ctx = createContext<PlayerState>(null as unknown as PlayerState);
export const usePlayer = () => useContext(Ctx);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<AudioX | null>(null);
  const [current, setCurrent] = useState<Current | null>(null);
  const [state, setState] = useState<string>('idle');

  useEffect(() => {
    const audio = new AudioX();
    try {
      audio.init({ mode: 'REACT', autoPlay: false, useDefaultEventListeners: true });
    } catch {
      /* already initialised */
    }
    audioRef.current = audio;
    const unsub = audio.subscribe('AUDIO_X_STATE', (s: { playbackState?: string }) => {
      if (s?.playbackState) setState(s.playbackState);
    });
    return () => {
      try {
        unsub?.();
        audio.pause();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const play = (s: Station) => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrent({ id: s.id, name: s.name, url: s.stream_url });
    audio.addMediaAndPlay({
      source: s.stream_url,
      title: s.name,
      artist: (s.countries || []).join(', ') || 'Sunoh Radio',
      id: String(s.id),
      duration: 0,
    } as never);
  };

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (state === 'playing' || state === 'buffering') audio.pause();
    else audio.play();
  };

  const stop = () => {
    audioRef.current?.pause();
    setCurrent(null);
    setState('idle');
  };

  return (
    <Ctx.Provider value={{ current, state, play, toggle, stop }}>
      {children}
      {current && <MiniPlayer current={current} state={state} toggle={toggle} stop={stop} />}
    </Ctx.Provider>
  );
}

function MiniPlayer({
  current,
  state,
  toggle,
  stop,
}: {
  current: Current;
  state: string;
  toggle: () => void;
  stop: () => void;
}) {
  const busy = state === 'buffering' || state === 'stalled';
  const playing = state === 'playing';
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-ink-800 bg-ink-950/95 px-4 py-2.5 text-ink-100 backdrop-blur animate-fade-up">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3">
        <button
          onClick={toggle}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-signal-500 text-ink-950 transition hover:bg-signal-400"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Radio size={13} className="shrink-0 text-signal-400" />
            <span className="truncate text-sm font-semibold">{current.name}</span>
            {playing && (
              <span className="eq flex h-3 items-end text-signal-400">
                <span /><span /><span /><span />
              </span>
            )}
          </div>
          <div className="truncate font-mono text-[11px] text-ink-500">{current.url}</div>
        </div>
        <span
          className={cn(
            'hidden rounded-full px-2 py-0.5 text-[11px] font-medium capitalize sm:inline-block',
            state === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-ink-800 text-ink-400',
          )}
        >
          {state}
        </span>
        <button onClick={stop} className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100" aria-label="Stop">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
