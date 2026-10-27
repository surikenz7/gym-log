import { formatDistanceToNowStrict } from 'date-fns';
import { motion } from 'framer-motion';
import { Music, Plus, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../cloud/account';
import type { PublicProfile } from '../cloud/social';
import { hasStory, liveNote, type Note } from '../cloud/stories';
import { refreshStories, useStories, useStoryRing, type StoryEntry } from '../cloud/storyStore';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { playSong, primeAudio, stopSong, type Song } from '../lib/music';
import { confirmDialog, toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import { MusicPicker, SongRow } from './MusicPicker';
import { Sheet } from './ui';
import { Avatar } from './WorkoutFeed';

export const meRef = () => {
  const a = useAccount.getState();
  return { uid: a.uid!, nick: a.nick ?? '', avatar: useSettings.getState().avatar ?? null };
};

/** Sends a reply to someone's story or note as a chat message. */
export async function replyInChat(them: { uid: string; nick: string; avatar?: string | null }, text: string) {
  const s = await import('../cloud/social');
  const me = meRef();
  const chat = await s.openChat(me, { ...them, nickLower: them.nick.toLowerCase() } as PublicProfile);
  await s.sendMessage(chat, me.uid, { kind: 'text', text });
}

/** Little thought bubble above an avatar, like Instagram notes. */
export function NoteBubble({ note, placeholder, onClick }: { note: Note | null; placeholder?: string; onClick: () => void }) {
  if (!note && !placeholder) return null;
  return (
    <button onClick={onClick} className="press absolute left-1/2 top-0 z-10 w-max max-w-[92px] -translate-x-1/2">
      <div className={`relative rounded-2xl px-2.5 py-1.5 text-center text-[11px] leading-tight shadow-lg ${note ? 'bg-card2 text-white' : 'bg-card2/80 text-muted'}`}>
        {note?.song && (
          <div className="mb-0.5 flex items-center justify-center gap-1 truncate text-[9px] text-muted">
            <Music size={9} className="shrink-0" /> <span className="truncate">{note.song.title}</span>
          </div>
        )}
        <div className="line-clamp-2 break-words">{note ? note.text || '🎵' : placeholder}</div>
        <span className={`absolute -bottom-1 left-5 h-2.5 w-2.5 rounded-full ${note ? 'bg-card2' : 'bg-card2/80'}`} />
        <span className={`absolute -bottom-2.5 left-3.5 h-1.5 w-1.5 rounded-full ${note ? 'bg-card2' : 'bg-card2/80'}`} />
      </div>
    </button>
  );
}

/** Write / change / delete your own note (text up to 60 characters and an optional song). */
export function NoteEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const mine = useStories((s) => liveNote(s.me));
  const [text, setText] = useState('');
  const [song, setSong] = useState<Song | null>(null);
  const [music, setMusic] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return stopSong();
    setText(mine?.text ?? '');
    setSong(mine?.song ?? null);
  }, [open]);
  const save = async (note: Note | null) => {
    setBusy(true);
    try {
      await (await import('../cloud/stories')).setNote(meRef().uid, note);
      useStories.setState((s) => ({ me: { ...(s.me ?? {}), note } }));
      haptic('success');
      onClose();
      toast(note ? t('Note shared') : t('Note deleted'));
    } catch {
      toast(navigator.onLine ? t('Something went wrong') : t('No internet connection'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t('Your note')}>
      <div className="space-y-3 px-4 pb-4 pt-1">
        <div className="text-center text-xs text-muted">{t('Friends see it above your picture for 24 hours.')}</div>
        <div className="relative mx-auto w-full max-w-[300px]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 60))}
            rows={2}
            placeholder={t('Share a thought…')}
            className="w-full resize-none rounded-3xl bg-card2 px-5 py-4 text-center text-lg outline-none"
          />
          <div className="absolute bottom-2 right-4 text-[10px] text-muted">{text.length}/60</div>
        </div>
        {song ? <SongRow song={song} onRemove={() => setSong(null)} /> : (
          <button onClick={() => setMusic(true)} className="press flex w-full items-center justify-center gap-2 rounded-xl bg-card2 py-3 text-sm font-semibold">
            <Music size={16} /> {t('Add music')}
          </button>
        )}
        <button disabled={busy || (!text.trim() && !song)} onClick={() => void save({ text: text.trim(), song, at: Date.now() })} className="press cut-sm grad w-full py-3 font-display font-bold uppercase tracking-wider disabled:opacity-40">
          {t('Share note')}
        </button>
        {mine && (
          <button
            disabled={busy}
            onClick={async () => {
              if (await confirmDialog(t('Delete note?'), '', t('Delete'), true)) void save(null);
            }}
            className="w-full py-2 text-sm font-semibold text-danger"
          >
            {t('Delete note')}
          </button>
        )}
      </div>
      <MusicPicker
        open={music}
        onClose={() => setMusic(false)}
        onPick={(s) => {
          setSong(s);
          setMusic(false);
        }}
      />
    </Sheet>
  );
}

/** A friend's note: bigger, with its song playing, and a reply that goes to your chat. */
export function NoteView({ entry, onClose }: { entry: StoryEntry | null; onClose: () => void }) {
  const note = liveNote(entry?.meta);
  const [text, setText] = useState('');
  useEffect(() => {
    if (!entry) return stopSong();
    setText('');
    if (note?.song) playSong(note.song);
  }, [entry?.uid]);
  const send = async () => {
    if (!entry || !note || !text.trim()) return;
    try {
      await replyInChat(entry, `${t('Replied to your note')} „${note.text || '🎵 ' + (note.song?.title ?? '')}“: ${text.trim()}`);
      haptic('success');
      toast(t('Sent'));
      onClose();
    } catch {
      toast(t('No internet connection'));
    }
  };
  return (
    <Sheet open={!!entry} onClose={onClose}>
      {entry && note && (
        <div className="flex flex-col items-center gap-3 px-4 pb-4 pt-12">
          <div className="relative">
            <div className="absolute -top-11 left-1/2 w-max max-w-[260px] -translate-x-1/2 rounded-3xl bg-card2 px-4 py-2.5 text-center text-base shadow-xl">{note.text || '🎵'}</div>
            <Avatar size={96} src={entry.avatar ?? null} initial={entry.nick} deco={null} />
          </div>
          <div className="text-center">
            <div className="font-semibold">@{entry.nick}</div>
            <div className="text-xs text-muted">{formatDistanceToNowStrict(note.at, { addSuffix: true })}</div>
          </div>
          {note.song && (
            <div className="w-full">
              <SongRow song={note.song} />
            </div>
          )}
          <div className="flex w-full items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Reply to @{nick}…', { nick: entry.nick })} className="h-11 min-w-0 flex-1 rounded-full bg-card2 px-4 text-base outline-none" />
            <button onClick={send} disabled={!text.trim()} className="press grad flex h-11 w-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40" aria-label={t('Send')}>
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function TrayItem({ uid, nick, avatar, note, label, mine, onNote }: { uid: string; nick: string; avatar?: string | null; note: Note | null; label: string; mine?: boolean; onNote: () => void }) {
  const nav = useNavigate();
  const ring = useStoryRing(uid);
  const open = () => {
    haptic();
    if (ring) {
      primeAudio();
      nav(`/stories/${uid}`);
    } else if (mine) nav('/story/new');
    else onNote();
  };
  return (
    <div className="relative flex w-[76px] shrink-0 flex-col items-center pt-10">
      <NoteBubble note={note} placeholder={mine ? t('Note…') : undefined} onClick={onNote} />
      <button onClick={open} className="press relative">
        {mine ? <Avatar size={62} story={ring} deco={null} /> : <Avatar size={62} src={avatar ?? null} initial={nick} deco={null} story={ring} />}
        {mine && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              haptic();
              nav('/story/new');
            }}
            className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-bg bg-accent text-[#fff]"
          >
            <Plus size={14} strokeWidth={3} />
          </span>
        )}
      </button>
      <div className={`mt-2 w-full truncate text-center text-[11px] ${ring === 'new' ? 'font-semibold text-white' : 'text-muted'}`}>{label}</div>
    </div>
  );
}

/** Stories + notes row at the top of Home (signed-in only). */
export function StoryTray() {
  const uid = useAccount((a) => (a.status === 'signedIn' ? a.uid : null));
  const nick = useAccount((a) => a.nick);
  const following = useAccount((a) => a.following);
  const me = useStories((s) => s.me);
  const friends = useStories((s) => s.friends);
  const seen = useStories((s) => s.seen);
  const [editNote, setEditNote] = useState(false);
  const [viewNote, setViewNote] = useState<StoryEntry | null>(null);
  useEffect(() => {
    if (!uid) return;
    void refreshStories();
    const onVisible = () => document.visibilityState === 'visible' && void refreshStories();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [uid]);
  if (!uid) return null;
  // unwatched stories first, then watched, then people with only a note
  const rank = (f: StoryEntry) => (hasStory(f.meta) ? ((seen[f.uid] ?? 0) < f.meta.last! ? 0 : 1) : 2);
  const list = friends.filter((f) => following.includes(f.uid)).sort((a, b) => rank(a) - rank(b) || (b.meta.last ?? 0) - (a.meta.last ?? 0));
  return (
    <>
      <motion.div className="-mx-4 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <TrayItem uid={uid} nick={nick ?? ''} note={liveNote(me)} label={t('Your story')} mine onNote={() => setEditNote(true)} />
        {list.map((f) => (
          <TrayItem key={f.uid} uid={f.uid} nick={f.nick} avatar={f.avatar} note={liveNote(f.meta)} label={f.nick} onNote={() => (primeAudio(), setViewNote(f))} />
        ))}
      </motion.div>
      <NoteEditor open={editNote} onClose={() => setEditNote(false)} />
      <NoteView entry={viewNote} onClose={() => setViewNote(null)} />
    </>
  );
}
