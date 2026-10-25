import { Header, Page } from '../components/ui';
import { SHORTCUT_NAME } from '../lib/health';

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Create the Shortcut',
    body: (
      <>
        Open the <b>Shortcuts</b> app → tap <b>+</b> → tap the name at the top → <b>Rename</b> to exactly <code>{SHORTCUT_NAME}</code>.
      </>
    ),
  },
  {
    title: 'Read the workout time',
    body: (
      <>
        Add these actions (use the search bar at the bottom):
        <ol className="mt-1 list-decimal space-y-0.5 pl-5">
          <li><b>Get Clipboard</b></li>
          <li><b>Split Text</b> — split <i>Clipboard</i> by <b>Custom</b> and type <code>|</code></li>
          <li><b>Get Item from List</b> — <b>Item At Index</b>, index <code>2</code></li>
          <li><b>Get Dates from Input</b> (from <i>Item from List</i>)</li>
          <li><b>Set Variable</b> — name it <code>Start</code></li>
          <li><b>Get Item from List</b> — tap the list and choose <i>Split Text</i>; <b>Item At Index</b>, index <code>3</code></li>
          <li><b>Get Dates from Input</b></li>
          <li><b>Set Variable</b> — name it <code>End</code></li>
        </ol>
      </>
    ),
  },
  {
    title: 'Heart rate',
    body: (
      <ol className="list-decimal space-y-0.5 pl-5">
        <li><b>Find Health Samples</b> where <b>Type</b> is <b>Heart Rate</b>; tap <b>Add Filter</b>: <b>Start Date</b> is after <i>Start</i>; add another: <b>Start Date</b> is before <i>End</i>. Sort by <b>Start Date</b>, <b>Oldest First</b>.</li>
        <li><b>Get Details of Health Sample</b> → <b>Value</b></li>
        <li><b>Combine Text</b> — combine <i>Value</i> with <b>New Lines</b></li>
      </ol>
    ),
  },
  {
    title: 'Calories',
    body: (
      <ol className="list-decimal space-y-0.5 pl-5">
        <li><b>Find Health Samples</b> where <b>Type</b> is <b>Active Energy</b>, with the same two Start/End filters</li>
        <li><b>Get Details of Health Sample</b> → <b>Value</b></li>
        <li><b>Calculate Statistics</b> → <b>Sum</b> of <i>Value</i></li>
      </ol>
    ),
  },
  {
    title: 'Send it back to Gym Log',
    body: (
      <>
        <ol className="list-decimal space-y-0.5 pl-5">
          <li>
            <b>Text</b> action with three lines: <code>GYMLOG</code>, then <code>KCAL:</code> followed by the <i>Statistics</i> variable, then the <i>Combined Text</i> variable
          </li>
          <li><b>Copy to Clipboard</b> (the <i>Text</i>)</li>
        </ol>
        The first run asks for Apple Health access — allow Heart Rate and Active Energy.
      </>
    ),
  },
  {
    title: 'Using it',
    body: (
      <>
        Start <b>Traditional Strength Training</b> in the Workout app on your Watch when you start lifting, and end it when you finish (that gives continuous heart rate). Then in Gym Log open the workout → <b>Get from Health</b> → when the Shortcut is done tap <b>◀ Gym Log</b> in the top-left corner → <b>Paste data</b>.
      </>
    ),
  },
];

export function WatchSetup() {
  return (
    <Page pushed>
      <Header back title="Apple Watch Setup" />
      <div className="space-y-3 px-4 pb-12">
        <div className="text-sm text-muted">
          Web apps can’t read Apple Health directly, so a free Shortcut does it for Gym Log. You set it up once (about 5 minutes).
        </div>
        {STEPS.map((s, i) => (
          <div key={s.title} className="rounded-2xl bg-card p-4">
            <div className="mb-1 flex items-center gap-2 font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-bold">{i + 1}</span>
              {s.title}
            </div>
            <div className="text-sm leading-relaxed text-white/85 [&_code]:rounded [&_code]:bg-card2 [&_code]:px-1">{s.body}</div>
          </div>
        ))}
      </div>
    </Page>
  );
}
