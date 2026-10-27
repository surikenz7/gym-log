import { Music, Pause, Play, Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../i18n';
import { playSong, searchSongs, stopSong, usePlaying, type Song } from '../lib/music';
import { Sheet } from './ui';

/** Cover + title + artist row; the button plays the 30-second preview. */
export function SongRow({ song, onClick, onRemove }: { song: Song; onClick?: () => void; onRemove?: () => void }) {
  const playing = usePlaying() === song.id;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-card2 p-2">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left" disabled={!onClick}>
        {song.art ? <img src={song.art} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent"><Music size={20} /></div>}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{song.title}</div>
          <div className="truncate text-xs text-muted">{song.artist}</div>
        </div>
      </button>
      <button onClick={() => (playing ? stopSong() : playSong(song, false))} className="press flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10" aria-label={t('Play')}>
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      {onRemove && (
        <button onClick={onRemove} className="press p-1.5 text-muted" aria-label={t('Remove')}>
          <X size={18} />
        </button>
      )}
    </div>
  );
}

/** Song search (iTunes previews). */
export function MusicPicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (s: Song) => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<Song[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return stopSong();
    const ctl = new AbortController();
    const id = setTimeout(() => {
      if (!q.trim()) return setList(null);
      setError(false);
      searchSongs(q, ctl.signal)
        .then(setList)
        .catch((e) => (e as Error).name !== 'AbortError' && setError(true));
    }, 350);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [q, open]);

  return (
    <Sheet open={open} onClose={onClose} title={t('Add music')} tall>
      <div className="px-4 pt-1">
        <div className="flex items-center gap-2 rounded-xl bg-card2 px-3">
          <Search size={18} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search songs or artists')} className="h-11 flex-1 bg-transparent text-base outline-none" autoFocus={false} />
        </div>
      </div>
      <div className="mt-3 space-y-1.5 px-4 pb-6">
        {list === null && !error && <div className="py-10 text-center text-sm text-muted">{t('Search for a song. You get a 30-second clip.')}</div>}
        {error && <div className="py-10 text-center text-sm text-muted">{t('No internet connection')}</div>}
        {list?.length === 0 && <div className="py-10 text-center text-sm text-muted">{t('No songs found')}</div>}
        {list?.map((s) => (
          <SongRow
            key={s.id}
            song={s}
            onClick={() => {
              stopSong();
              onPick(s);
            }}
          />
        ))}
        {list && list.length > 0 && <div className="pt-2 text-center text-[10px] text-muted">{t('Previews from Apple Music')}</div>}
      </div>
    </Sheet>
  );
}
