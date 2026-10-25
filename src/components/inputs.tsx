import { useEffect, useRef, useState } from 'react';
import { digitsToSeconds, fmtDuration, fmtNum, parseNum, secondsToDigits } from '../lib/units';

const base =
  'w-full min-w-0 rounded-lg bg-transparent py-1.5 text-center font-semibold tabular-nums outline-none placeholder:text-muted/60 focus:bg-card2';

function selectAll(el: HTMLInputElement) {
  // iOS ignores select() during focus; defer it.
  setTimeout(() => el.setSelectionRange(0, el.value.length), 0);
}

export function NumInput({
  value,
  onChange,
  placeholder,
  integer,
  className = '',
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  integer?: boolean;
  className?: string;
}) {
  const fmt = (v: number | null | undefined) => (v == null ? '' : fmtNum(v));
  const [text, setText] = useState(fmt(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
  }, [value]);
  return (
    <input
      inputMode={integer ? 'numeric' : 'decimal'}
      enterKeyHint="done"
      className={`${base} ${className}`}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        focused.current = true;
        selectAll(e.target);
      }}
      onBlur={() => {
        focused.current = false;
        setText(fmt(value));
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onChange={(e) => {
        const t = e.target.value.replace(integer ? /[^0-9]/g : /[^0-9.,]/g, '').slice(0, 7);
        setText(t);
        onChange(parseNum(t));
      }}
    />
  );
}

/** Microwave-style time entry: typing 1-3-0 gives 1:30. */
export function DurationInput({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [digits, setDigits] = useState<string | null>(null);
  const display = (d: string) => {
    if (!d) return '';
    const p = d.padStart(3, '0');
    const s = p.slice(-2);
    const rest = p.slice(0, -2);
    if (rest.length <= 2) return `${Number(rest)}:${s}`;
    return `${Number(rest.slice(0, -2))}:${rest.slice(-2)}:${s}`;
  };
  return (
    <input
      inputMode="numeric"
      enterKeyHint="done"
      className={`${base} ${className}`}
      value={digits != null ? display(digits) : value == null ? '' : fmtDuration(value)}
      placeholder={placeholder}
      onFocus={(e) => {
        setDigits(value == null ? '' : secondsToDigits(value));
        selectAll(e.target);
      }}
      onBlur={() => setDigits(null)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      onChange={(e) => {
        const d = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(-6);
        setDigits(d);
        onChange(digitsToSeconds(d));
      }}
    />
  );
}
