import { format, formatDistanceToNowStrict, isToday } from 'date-fns';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { Bell, Camera, ChevronRight, Download, Flame, ImagePlus, Lock, MessageCircle, Palette, Search, Send, Trophy, UserCheck, UserPlus, Users } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAccount } from '../cloud/account';
import type { Chat as ChatT, FollowStatus, InboxItem, Message, PublicProfile } from '../cloud/social';
import { CHAT_THEMES, chatThemeOf, photoBg } from '../components/ChatThemes';
import { useBadges, useSocial } from '../cloud/socialStore';
import { RankBadge, TierName } from '../components/RankBadge';
import { RatingPill, PhotoStrip, TaggedChips, useFriendProfiles } from '../components/WorkoutExtras';
import { Avatar, WorkoutCard } from '../components/WorkoutFeed';
import { ReactionBar } from '../components/Reactions';
import { NoteBubble, NoteView } from '../components/StoryTray';
import { openStory, useStories, useStoryRing } from '../cloud/storyStore';
import { liveNote } from '../cloud/stories';
import { primeAudio } from '../lib/music';
import { Button, Header, Page, Portal, Sheet } from '../components/ui';
import { t } from '../i18n';
import { haptic } from '../lib/haptics';
import { fileToJpeg } from '../lib/photo';
import { packRoutine, saveSharedRoutine } from '../lib/share';
import { toast } from '../state/dialog';
import { useSettings } from '../state/settings';
import type { Routine, Workout } from '../types';
import { ExerciseBlocks, StatGrid } from './WorkoutDetail';

const social = () => import('../cloud/social');
const meRef = () => {
  const a = useAccount.getState();
  return { uid: a.uid!, nick: a.nick ?? '', avatar: useSettings.getState().avatar ?? null };
};

function SignedOut() {
  return <div className="px-6 py-16 text-center text-muted">{t('Create an account in Settings to use the social features.')}</div>;
}

/* =================================================================== Profile card */

/** Card under the rank on the Profile tab. */
export function SocialCard() {
  const nav = useNavigate();
  const status = useAccount((a) => a.status);
  const friends = useFriendProfiles();
  const b = useBadges();
  if (status !== 'signedIn') return null;
  const tiles = [
    { id: 'friends', icon: Users, label: t('Friends'), n: 0, sub: friends ? String(friends.length) : '…' },
    { id: 'requests', icon: UserPlus, label: t('Requests'), n: b.requests, sub: '' },
    { id: 'messages', icon: MessageCircle, label: t('Messages'), n: b.messages, sub: '' },
    { id: 'activity', icon: Bell, label: t('Activity'), n: b.activity, sub: '' },
  ];
  return (
    <motion.div className="cut mt-3 bg-card p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={() => nav('/social')} className="flex w-full items-center gap-3 text-left">
        <div className="flex-1">
          <div className="label">{t('Social')}</div>
          <div className="font-display text-xl font-bold">{friends?.length ? t('{n} friends', { n: friends.length }) : t('Find your gym friends')}</div>
        </div>
        <div className="flex -space-x-3">
          {(friends ?? []).slice(0, 4).map((f) => (
            <div key={f.uid} className="rounded-full ring-2 ring-card">
              <Avatar size={34} src={f.avatar ?? null} initial={f.nick} deco={null} />
            </div>
          ))}
        </div>
        <ChevronRight size={18} className="text-muted" />
      </button>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {tiles.map(({ id, icon: Icon, label, n, sub }) => (
          <button key={id} onClick={() => nav(`/social?tab=${id}`)} className="press relative flex flex-col items-center gap-1 rounded-xl bg-card2 py-2.5">
            <Icon size={20} className="text-accent" />
            <span className="text-[11px] font-semibold">{label}</span>
            {sub && <span className="text-[10px] text-muted">{sub}</span>}
            {n > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-[#fff]">{n}</span>}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* =================================================================== Social hub */

type Tab = 'friends' | 'requests' | 'messages' | 'activity';

function ProfileRow({ p, sub, right, i = 0 }: { p: { uid: string; nick: string; avatar?: string | null; deco?: string | null }; sub?: string; right?: React.ReactNode; i?: number }) {
  const nav = useNavigate();
  return (
    <motion.div className="cut-sm flex items-center gap-3 bg-card p-2.5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03 }}>
      <button onClick={() => nav(`/u/${p.uid}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="p-1">
          <Avatar size={42} src={p.avatar ?? null} initial={p.nick} deco={p.deco ?? null} />
        </div>
        <div className="min-w-0">
          <div className="truncate font-semibold">@{p.nick}</div>
          {sub && <div className="truncate text-xs text-muted">{sub}</div>}
        </div>
      </button>
      {right}
    </motion.div>
  );
}

function FriendsTab() {
  const uid = useAccount((a) => a.uid)!;
  const following = useAccount((a) => a.following);
  const followers = useSocial((s) => s.followers);
  const friends = useFriendProfiles();
  const [q, setQ] = useState('');
  const [found, setFound] = useState<PublicProfile | null | undefined>(undefined);
  const search = async () => {
    if (!q.trim()) return;
    setFound(undefined);
    const p = await (await social()).findUser(q.replace(/^@/, '')).catch(() => null);
    setFound(p && p.uid !== uid ? p : null);
  };
  const followsMe = new Set(followers.filter((f) => f.status === 'accepted').map((f) => f.uid));
  return (
    <>
      <div className="cut flex items-center gap-2 bg-card p-2 pl-4">
        <Search size={18} className="shrink-0 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value.replace(/\s/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && void search()}
          placeholder={t('Find a friend by nickname')}
          autoCapitalize="none"
          autoCorrect="off"
          className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-muted"
        />
        <button onClick={() => void search()} className="press grad rounded-lg px-4 py-2 text-sm font-bold">
          {t('Find')}
        </button>
      </div>
      {found === null && <div className="mt-3 text-center text-sm text-muted">{t('Nobody with that nickname.')}</div>}
      {found && (
        <div className="mt-3">
          <ProfileRow p={found} sub={`LVL ${found.level ?? 1} · ${found.title ?? ''}${found.private ? ' · 🔒' : ''}`} />
        </div>
      )}
      <div className="label mb-2 mt-6">
        {t('Friends')} · {friends?.length ?? '…'}
      </div>
      {friends?.length === 0 && <div className="cut bg-card p-5 text-center text-sm text-muted">{t('Search your friend’s nickname above and follow them.')}</div>}
      <div className="space-y-1.5">
        {friends?.map((p, i) => {
          const iFollow = following.includes(p.uid);
          const mutual = iFollow && followsMe.has(p.uid);
          return <ProfileRow key={p.uid} i={i} p={p} sub={mutual ? t('Friends · follow each other') : iFollow ? t('You follow') : t('Follows you')} />;
        })}
      </div>
    </>
  );
}

function RequestsTab() {
  const followers = useSocial((s) => s.followers).filter((f) => f.status === 'pending');
  const isPrivate = useSettings((s) => !!s.privateProfile);
  return (
    <>
      {!isPrivate && <div className="mb-3 rounded-xl bg-card px-4 py-3 text-sm text-muted">{t('Your profile is public, so people can follow you without asking. Make it private in Settings → Account.')}</div>}
      {followers.length === 0 && <div className="cut bg-card p-5 text-center text-sm text-muted">{t('No follow requests.')}</div>}
      <div className="space-y-1.5">
        <AnimatePresence>
          {followers.map((f, i) => (
            <ProfileRow
              key={f.uid}
              i={i}
              p={f}
              sub={formatDistanceToNowStrict(f.at, { addSuffix: true })}
              right={
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => {
                      haptic('success');
                      await (await social()).acceptRequest(meRef(), f.uid);
                    }}
                    className="press grad rounded-lg px-3 py-2 text-sm font-bold"
                  >
                    {t('Accept')}
                  </button>
                  <button onClick={async () => (await social()).removeFollower(meRef().uid, f.uid)} className="press rounded-lg bg-card2 px-3 py-2 text-sm font-semibold">
                    {t('Decline')}
                  </button>
                </div>
              }
            />
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}

function MessagesTab() {
  const uid = useAccount((a) => a.uid)!;
  const chats = useSocial((s) => s.chats);
  const nav = useNavigate();
  const friends = useFriendProfiles();
  return (
    <>
      {chats.length === 0 && <div className="cut bg-card p-5 text-center text-sm text-muted">{t('No messages yet. Open a friend and tap Message.')}</div>}
      <div className="space-y-1.5">
        {chats.map((c, i) => {
          const other = c.members.find((m) => m !== uid) ?? uid;
          const u = !!c.last && c.last.from !== uid && (c.readAt?.[uid] ?? 0) < c.last.at;
          return (
            <motion.button
              key={c.id}
              onClick={() => nav(`/chat/${other}`)}
              className="press cut-sm flex w-full items-center gap-3 bg-card p-2.5 text-left"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 8) * 0.03 }}
            >
              <div className="p-1">
                <Avatar size={44} src={c.avatars?.[other] ?? null} initial={c.nicks[other]} deco={null} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`truncate ${u ? 'font-bold' : 'font-semibold'}`}>@{c.nicks[other]}</div>
                <div className={`truncate text-sm ${u ? 'font-semibold text-white' : 'text-muted'}`}>
                  {c.last ? `${c.last.from === uid ? t('You') + ': ' : ''}${c.last.kind === 'snap' ? '📸 Snap' : c.last.text}` : t('Say hi 👋')}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {c.last && <span className="text-[11px] text-muted">{isToday(c.last.at) ? format(c.last.at, 'HH:mm') : format(c.last.at, 'd MMM')}</span>}
                {u && <span className="h-2.5 w-2.5 rounded-full bg-accent" />}
              </div>
            </motion.button>
          );
        })}
      </div>
      {!!friends?.length && (
        <>
          <div className="label mb-2 mt-6">{t('New message')}</div>
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4" data-no-swipe>
            {friends.map((f) => (
              <button key={f.uid} onClick={() => nav(`/chat/${f.uid}`)} className="press flex w-16 shrink-0 flex-col items-center gap-1">
                <Avatar size={52} src={f.avatar ?? null} initial={f.nick} deco={null} />
                <span className="w-full truncate text-center text-[11px]">@{f.nick}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ActivityTab() {
  const uid = useAccount((a) => a.uid)!;
  const inbox = useSocial((s) => s.inbox);
  const nav = useNavigate();
  useEffect(() => {
    if (inbox.some((i) => !i.read)) {
      const t0 = setTimeout(() => void social().then((s) => s.markInboxRead(uid, inbox)), 1500);
      return () => clearTimeout(t0);
    }
  }, [inbox]);
  const text = (i: InboxItem) =>
    i.kind === 'tag'
      ? t('tagged you in “{name}”', { name: i.workoutName ?? '' })
      : i.kind === 'like'
        ? t('liked your workout “{name}”', { name: i.workoutName ?? '' })
        : i.kind === 'comment'
          ? t('commented on “{name}”: {text}', { name: i.workoutName ?? '', text: i.text ?? '' })
          : i.kind === 'quest'
            ? t('started a Friends Quest with you')
            : i.kind === 'story'
              ? t('liked your story')
            : i.kind === 'follow'
              ? t('started following you')
              : t('accepted your follow request');
  const open = (i: InboxItem) =>
    i.kind === 'story' ? openStory(uid) : nav(
      i.kind === 'tag' && i.workoutId
        ? `/u/${i.from}/w/${i.workoutId}`
        : (i.kind === 'like' || i.kind === 'comment') && i.workoutId
          ? `/history/${i.workoutId}`
          : i.kind === 'quest'
            ? '/compete'
            : `/u/${i.from}`,
    );
  return (
    <>
      {inbox.length === 0 && <div className="cut bg-card p-5 text-center text-sm text-muted">{t('Nothing here yet. When friends follow you, like or comment on your workouts, or tag you, it shows up here.')}</div>}
      <div className="space-y-1.5">
        {inbox.map((i, k) => (
          <motion.button
            key={i.id}
            onClick={() => open(i)}
            className={`press cut-sm flex w-full items-center gap-3 p-2.5 text-left ${i.read ? 'bg-card' : 'bg-accent/10'}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(k, 8) * 0.03 }}
          >
            <div className="p-1">
              <Avatar size={42} src={i.avatar ?? null} initial={i.nick} deco={null} />
            </div>
            <div className="min-w-0 flex-1 text-sm">
              <b>@{i.nick}</b> {text(i)}
              <div className="text-xs text-muted">{formatDistanceToNowStrict(i.at, { addSuffix: true })}</div>
            </div>
            <span className="text-xl">{{ tag: '🏋️', follow: '👋', accepted: '✅', like: '❤️', comment: '💬', quest: '🤝', story: '❤️' }[i.kind]}</span>
          </motion.button>
        ))}
      </div>
    </>
  );
}

export function Social() {
  const status = useAccount((a) => a.status);
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'friends';
  const b = useBadges();
  const tabs: [Tab, string, number][] = [
    ['friends', t('Friends'), 0],
    ['requests', t('Requests'), b.requests],
    ['messages', t('Messages'), b.messages],
    ['activity', t('Activity'), b.activity],
  ];
  return (
    <Page pushed>
      <Header back title={t('Social')} />
      {status !== 'signedIn' ? (
        <SignedOut />
      ) : (
        <div className="px-4 pb-12">
          <div className="relative mb-4 grid grid-cols-4 rounded-2xl bg-card p-1">
            {tabs.map(([id, label, n]) => (
              <button key={id} onClick={() => setParams({ tab: id }, { replace: true })} className={`relative z-10 flex items-center justify-center py-2 text-[13px] font-semibold ${tab === id ? 'text-ink' : 'text-white/70'}`}>
                {tab === id && <motion.span layoutId="social-tab" className="absolute inset-0 -z-10 rounded-xl bg-accent" />}
                {label}
                {n > 0 && <span className={`ml-1 h-2 w-2 rounded-full ${tab === id ? 'bg-ink' : 'bg-danger'}`} />}
              </button>
            ))}
          </div>
          <motion.div key={tab} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
            {tab === 'friends' && <FriendsTab />}
            {tab === 'requests' && <RequestsTab />}
            {tab === 'messages' && <MessagesTab />}
            {tab === 'activity' && <ActivityTab />}
          </motion.div>
        </div>
      )}
    </Page>
  );
}

/* =================================================================== Friend profile */

export function FriendProfile() {
  const { uid } = useParams();
  const a = useAccount();
  const nav = useNavigate();
  const [p, setP] = useState<PublicProfile | null | undefined>(undefined);
  const [status, setStatus] = useState<FollowStatus | null>(null);
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [locked, setLocked] = useState(false);
  const me = uid === a.uid;
  const ring = useStoryRing(uid);
  const entry = useStories((st) => st.friends.find((f) => f.uid === uid) ?? null);
  const [noteOpen, setNoteOpen] = useState(false);

  const load = async () => {
    const s = await social();
    const prof = await s.getProfile(uid!).catch(() => null);
    setP(prof);
    // their story / note (also for people you don't follow, if their account is public)
    if (prof && !me)
      void import('../cloud/stories')
        .then((st) => st.getStoryMeta(prof.uid))
        .then((meta) => meta && useStories.setState((st) => ({ friends: [...st.friends.filter((f) => f.uid !== prof.uid), { uid: prof.uid, nick: prof.nick, avatar: prof.avatar, meta }] })));
    if (a.uid && !me) setStatus(await s.followStatus(a.uid, uid!).catch((): FollowStatus => 'none'));
    try {
      setWorkouts(await s.getWorkouts(uid!));
      setRoutines(await s.getRoutines(uid!));
      setLocked(false);
    } catch {
      setLocked(true);
      setWorkouts([]);
      setRoutines([]);
    }
  };
  useEffect(() => void load(), [uid]);

  const toggleFollow = async () => {
    const s = await social();
    if (status === 'none') {
      const st = await s.follow(meRef(), uid!);
      setStatus(st);
      useAccount.setState({ following: [...new Set([...a.following, uid!])] });
      haptic('success');
      if (st === 'accepted') void load();
      else toast(t('Follow request sent'));
    } else {
      await s.unfollow(a.uid!, uid!);
      setStatus('none');
      useAccount.setState({ following: a.following.filter((x) => x !== uid) });
      haptic();
      if (p?.private) setLocked(true);
    }
  };

  if (p === undefined) return <Page pushed><Header back title={t('Profile')} /></Page>;
  if (p === null)
    return (
      <Page pushed>
        <Header back title={t('Profile')} />
        <div className="px-6 py-16 text-center text-muted">{t('Couldn’t load this profile.')}</div>
      </Page>
    );

  return (
    <Page pushed>
      <Header back title={`@${p.nick}`} />
      <div className="px-4 pb-12">
        <div className="flex flex-col items-center">
          <div className="relative flex flex-col items-center pt-11">
            <NoteBubble note={liveNote(entry?.meta)} onClick={() => (primeAudio(), setNoteOpen(true))} />
            <button
              onClick={() => {
                if (!ring) return;
                primeAudio();
                openStory(p.uid);
              }}
              className="press"
            >
              <Avatar size={104} src={p.avatar ?? null} initial={p.nick} deco={ring ? null : (p.deco ?? null)} story={ring} />
            </button>
          </div>
          <NoteView entry={noteOpen ? entry : null} onClose={() => setNoteOpen(false)} />
          <div className="mt-6 flex items-center gap-2 font-display text-3xl font-bold">
            @{p.nick} {p.private && <Lock size={18} className="text-muted" />}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="grad rounded px-1.5 py-0.5 font-display text-xs font-bold">LVL {p.level ?? 1}</span>
            <span className="font-display text-sm uppercase tracking-wider text-white/70">{p.title}</span>
          </div>
          {!me && a.status === 'signedIn' && (
            <div className="mt-4 flex gap-2">
              <Button variant={status === 'none' ? 'primary' : 'secondary'} className="!px-5" onClick={() => void toggleFollow()}>
                {status === 'accepted' ? <UserCheck size={18} /> : <UserPlus size={18} />}
                {status === 'accepted' ? t('Following') : status === 'pending' ? t('Requested') : p.private ? t('Request') : t('Follow')}
              </Button>
              <Button variant="secondary" className="!px-5" onClick={() => nav(`/chat/${p.uid}`)}>
                <MessageCircle size={18} /> {t('Message')}
              </Button>
            </div>
          )}
        </div>

        <div className="cut mt-5 grid grid-cols-3 divide-x divide-line bg-card py-3 text-center">
          <div>
            <div className="font-display text-2xl font-bold">{p.workouts ?? 0}</div>
            <div className="label !text-[10px]">{t('Workouts')}</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold">
              <Flame size={18} className="text-orange-500" /> {p.streak ?? 0}
            </div>
            <div className="label !text-[10px]">{t('Week streak')}</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold">
              <Trophy size={17} className="text-warn" /> {p.trophies ?? 0}
            </div>
            <div className="label !text-[10px]">{t('Trophies')}</div>
          </div>
        </div>

        <div className="cut mt-3 flex items-center gap-4 bg-card p-4">
          <RankBadge score={p.overall ?? null} size={60} />
          <div>
            <div className="label">{t('Overall rank')}</div>
            <TierName score={p.overall ?? null} className="text-2xl" />
            {p.overall != null && <div className="font-display text-xs text-muted">{p.overall} pts</div>}
          </div>
        </div>

        {locked ? (
          <div className="cut mt-6 flex flex-col items-center gap-2 bg-card px-6 py-8 text-center">
            <Lock size={30} className="text-muted" />
            <div className="font-display text-xl font-bold">{t('This account is private')}</div>
            <div className="text-sm text-muted">{status === 'pending' ? t('Your request is waiting for approval.') : t('Follow to see their workouts and routines.')}</div>
          </div>
        ) : (
          <>
            <div className="label mb-2 mt-6">{t('Routines')}</div>
            {routines === null && <div className="text-sm text-muted">{t('Loading…')}</div>}
            {routines?.length === 0 && <div className="text-sm text-muted">{t('No routines yet.')}</div>}
            <div className="space-y-2">
              {routines?.map((r) => (
                <div key={r.id} className="cut-sm flex items-center gap-3 bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.name}</div>
                    <div className="text-xs text-muted">
                      {r.exercises.length} {t('exercises')} · {r.exercises.reduce((n, e) => n + e.sets.length, 0)} {t('sets')}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await saveSharedRoutine(packRoutine(r));
                      haptic('success');
                      toast(t('Saved “{name}” to your routines', { name: r.name }));
                    }}
                    className="press flex items-center gap-1.5 rounded-lg bg-card2 px-3 py-2 text-sm font-semibold"
                  >
                    <Download size={16} /> {t('Save')}
                  </button>
                </div>
              ))}
            </div>

            <div className="label mb-2 mt-6">{t('Recent workouts')}</div>
            {workouts === null && <div className="text-sm text-muted">{t('Loading…')}</div>}
            {workouts?.length === 0 && <div className="text-sm text-muted">{t('No workouts shared yet.')}</div>}
            <div className="space-y-2">
              {workouts?.map((w, i) => (
                <WorkoutCard key={w.id} w={w} prs={0} index={i} friend author={p} onOpen={() => nav(`/u/${p.uid}/w/${w.id}`)} footer={<ReactionBar owner={p.uid} w={w} author={p} />} />
              ))}
            </div>
          </>
        )}
      </div>
    </Page>
  );
}

/* =================================================================== Friend's workout */

export function FriendWorkout() {
  const { uid, wid } = useParams();
  const [w, setW] = useState<Workout | null | undefined>(undefined);
  const [p, setP] = useState<PublicProfile | null>(null);
  useEffect(() => {
    void social().then(async (s) => {
      setP(await s.getProfile(uid!).catch(() => null));
      setW(await s.getWorkout(uid!, wid!).catch(() => null));
    });
  }, [uid, wid]);
  return (
    <Page pushed>
      <Header back title={w?.name ?? t('Workout')} />
      {w === undefined && <div className="px-6 py-16 text-center text-muted">{t('Loading…')}</div>}
      {w === null && <div className="px-6 py-16 text-center text-muted">{t('This workout isn’t available (yet). It appears once your friend’s app has synced.')}</div>}
      {w && (
        <div className="space-y-3 px-4 pb-10">
          {p && (
            <div className="flex items-center gap-3">
              <div className="p-1">
                <Avatar size={40} src={p.avatar ?? null} initial={p.nick} deco={p.deco ?? null} />
              </div>
              <div>
                <div className="font-semibold">@{p.nick}</div>
                <div className="text-xs text-muted">{format(w.start, 'EEEE, d MMMM yyyy · HH:mm')}</div>
              </div>
              <div className="ml-auto">
                <RatingPill rating={w.rating} />
              </div>
            </div>
          )}
          <div className="font-display text-3xl font-bold uppercase">{w.name}</div>
          <TaggedChips tagged={w.tagged} />
          <StatGrid w={w} prs={0} />
          <div className="cut bg-card">
            <ReactionBar owner={uid!} w={w} author={p ?? undefined} full />
          </div>
          {w.notes && <div className="cut bg-card p-4 text-sm text-white/85">{w.notes}</div>}
          <PhotoStrip photos={w.photos ?? []} />
          <ExerciseBlocks w={w} prs={[]} />
        </div>
      )}
    </Page>
  );
}

/* =================================================================== Chat + snaps */

function SnapViewer({ msg, onDone }: { msg: Message | null; onDone: () => void }) {
  const p = useMotionValue(0);
  const ring = useTransform(p, (v) => `${(1 - v) * 100}`);
  useEffect(() => {
    if (!msg) return;
    p.set(0);
    const c = animate(p, 1, { duration: 10, ease: 'linear', onComplete: onDone });
    return () => c.stop();
  }, [msg?.id]);
  return (
    <Portal>
      <AnimatePresence>
        {msg?.image && (
          <motion.div className="fixed inset-0 z-[85] bg-black" initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} onClick={onDone}>
            <img src={msg.image} alt="" className="h-full w-full object-contain" />
            <svg className="absolute right-4 h-9 w-9 -rotate-90" style={{ top: 'calc(var(--sat) + 12px)' }} viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15" fill="rgb(0 0 0 / 0.4)" stroke="rgb(255 255 255 / 0.25)" strokeWidth="3" />
              <motion.circle cx="18" cy="18" r="15" fill="none" stroke="#fff" strokeWidth="3" pathLength="100" strokeDasharray="100" style={{ strokeDashoffset: ring }} />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function Chat() {
  const { uid: other } = useParams();
  const a = useAccount();
  const [them, setThem] = useState<PublicProfile | null>(null);
  const [chat, setChat] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [viewing, setViewing] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [chatDoc, setChatDoc] = useState<ChatT | null>(null);
  const [themeSheet, setThemeSheet] = useState(false);
  const bgInput = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const cam = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!a.uid) return;
    let stop = () => {};
    void social().then(async (s) => {
      const p = await s.getProfile(other!);
      setThem(p);
      if (!p) return;
      const id = await s.openChat(meRef(), p);
      setChat(id);
      const s1 = s.watchChat(id, setMsgs);
      const s2 = s.watchChatDoc(id, setChatDoc);
      stop = () => (s1(), s2());
    });
    return () => stop();
  }, [other, a.uid]);

  // read receipts + keep the newest message in view
  useEffect(() => {
    if (chat && a.uid) void social().then((s) => s.markChatRead(chat, a.uid!));
  }, [msgs.length, chat]);
  useLayoutEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length]);

  const send = async () => {
    const v = text.trim();
    if (!v || !chat) return;
    setText('');
    haptic();
    await (await social()).sendMessage(chat, a.uid!, { kind: 'text', text: v });
  };
  const sendSnap = async (f: File | undefined) => {
    if (!f || !chat) return;
    setSending(true);
    try {
      const image = await fileToJpeg(f, 1080, 260_000);
      await (await social()).sendMessage(chat, a.uid!, { kind: 'snap', image });
      haptic('success');
      toast(t('Snap sent 📸'));
    } catch {
      toast(t('Couldn’t send that photo'));
    } finally {
      setSending(false);
    }
  };

  const theme = chatThemeOf(chatDoc?.theme);
  const bg = chatDoc?.theme === 'photo' && chatDoc.bgPhoto ? photoBg(chatDoc.bgPhoto) : theme.bg;
  const pickTheme = async (id: string, photo: string | null = null) => {
    setThemeSheet(false);
    if (!chat) return;
    haptic('success');
    await (await social()).setChatTheme(chat, id, photo);
  };

  if (a.status !== 'signedIn')
    return (
      <Page pushed>
        <Header back title={t('Messages')} />
        <SignedOut />
      </Page>
    );

  return (
    <div className="flex h-full flex-col bg-bg">
      <Header
        back
        title={
          them ? (
            <span className="inline-flex items-center gap-2 normal-case">
              <Avatar size={26} src={them.avatar ?? null} initial={them.nick} deco={null} />@{them.nick}
            </span>
          ) : (
            '…'
          )
        }
        right={
          <button onClick={() => setThemeSheet(true)} className="press text-accent" aria-label={t('Chat theme')}>
            <Palette size={22} />
          </button>
        }
      />
      <div ref={list} className="scroll-area flex-1 space-y-1.5 px-3 pb-3 pt-2" style={{ ...bg, backgroundAttachment: 'local' }}>
        {msgs.length === 0 && <div className="py-16 text-center text-sm text-muted">{t('Say hi 👋 — or send a snap of your pump.')}</div>}
        {msgs.map((m, i) => {
          const mine = m.from === a.uid;
          const newDay = i === 0 || format(msgs[i - 1].at, 'yyyyMMdd') !== format(m.at, 'yyyyMMdd');
          return (
            <div key={m.id}>
              {newDay && <div className="py-2 text-center text-[11px] font-semibold text-muted">{isToday(m.at) ? t('Today') : format(m.at, 'EEEE d MMM')}</div>}
              <motion.div className={`flex ${mine ? 'justify-end' : 'justify-start'}`} initial={{ opacity: 0, y: 8, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}>
                {m.kind === 'snap' ? (
                  <button
                    disabled={mine || m.viewed}
                    onClick={() => {
                      haptic();
                      setViewing(m);
                    }}
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold ${mine ? 'bg-card2' : m.viewed ? 'bg-card' : 'grad'}`}
                    style={!mine && !m.viewed ? theme.mine : undefined}
                  >
                    <Camera size={17} />
                    {mine ? (m.viewed ? t('Snap · opened') : t('Snap · delivered')) : m.viewed ? t('Snap · opened') : t('Tap to view snap')}
                  </button>
                ) : (
                  <div className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] ${mine ? 'grad rounded-br-md' : 'rounded-bl-md bg-card2'}`} style={mine ? theme.mine : theme.theirs}>
                    {m.text}
                  </div>
                )}
              </motion.div>
              {i === msgs.length - 1 && <div className={`mt-0.5 text-[10px] text-muted ${mine ? 'text-right' : ''}`}>{format(m.at, 'HH:mm')}</div>}
            </div>
          );
        })}
      </div>
      <div className="flex items-end gap-2 border-t border-line bg-bg/90 px-3 pt-2 backdrop-blur-xl" style={{ paddingBottom: 'max(var(--sab), 10px)' }}>
        <button onClick={() => cam.current?.click()} disabled={sending} className="press grad flex h-11 w-11 shrink-0 items-center justify-center rounded-full" aria-label={t('Send a snap')}>
          {sending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera size={20} />}
        </button>
        <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (void sendSnap(e.target.files?.[0]), (e.target.value = ''))} />
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={t('Message…')}
          className="max-h-28 min-h-11 flex-1 resize-none rounded-3xl bg-card px-4 py-2.5 outline-none placeholder:text-muted"
        />
        <AnimatePresence>
          {text.trim() && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} onClick={() => void send()} className="press grad flex h-11 w-11 shrink-0 items-center justify-center rounded-full" aria-label={t('Send')}>
              <Send size={19} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <Sheet open={themeSheet} onClose={() => setThemeSheet(false)} title={t('Chat theme')}>
        <div className="grid grid-cols-3 gap-2.5 px-4 pt-2">
          {CHAT_THEMES.map((th) => (
            <button key={th.id} onClick={() => void pickTheme(th.id)} className="press flex flex-col items-center gap-1.5">
              <span
                className="relative flex h-24 w-full flex-col justify-end gap-1 overflow-hidden rounded-2xl p-2"
                style={{ ...(th.id === 'default' ? { background: 'rgb(var(--bg))' } : th.bg), boxShadow: (chatDoc?.theme ?? 'default') === th.id ? 'inset 0 0 0 2.5px rgb(var(--accent))' : 'inset 0 0 0 1px rgb(var(--line))' }}
              >
                <span className="h-3 w-3/4 self-start rounded-full bg-card2" style={th.theirs} />
                <span className="h-3 w-2/3 self-end rounded-full" style={th.id === 'default' ? { background: th.swatch } : th.mine} />
              </span>
              <span className="text-[11px] font-semibold">{t(th.name)}</span>
            </button>
          ))}
          <button onClick={() => bgInput.current?.click()} className="press flex flex-col items-center gap-1.5">
            <span
              className="flex h-24 w-full items-center justify-center rounded-2xl border-2 border-dashed border-line text-muted"
              style={chatDoc?.theme === 'photo' && chatDoc.bgPhoto ? { ...photoBg(chatDoc.bgPhoto), borderStyle: 'solid', borderColor: 'rgb(var(--accent))' } : undefined}
            >
              <ImagePlus size={24} />
            </span>
            <span className="text-[11px] font-semibold">{t('Your photo')}</span>
          </button>
        </div>
        <input
          ref={bgInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              await pickTheme('photo', await fileToJpeg(f, 900, 180_000));
            } catch {
              toast(t('Couldn’t read that image'));
            }
          }}
        />
        <div className="px-4 pt-3 text-center text-xs text-muted">{t('Both of you see the theme you pick.')}</div>
      </Sheet>
      <SnapViewer
        msg={viewing}
        onDone={() => {
          const m = viewing;
          setViewing(null);
          if (m && chat) void social().then((s) => s.markSnapViewed(chat, m.id));
        }}
      />
    </div>
  );
}

