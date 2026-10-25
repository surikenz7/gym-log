import { AnimatePresence, motion, useDragControls } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useRotated } from '../lib/orientation';
import { useDialog, useToast } from '../state/dialog';

export const spring = { type: 'spring', damping: 32, stiffness: 380 } as const;

export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}

/** Scrollable page with a fade/slide-in. `pushed` pages slide in from the right. */
export function Page({ children, pushed, className = '' }: { children: ReactNode; pushed?: boolean; className?: string }) {
  return (
    <motion.div
      className={`scroll-area h-full ${className}`}
      initial={{ opacity: 0, x: pushed ? 40 : 0, y: pushed ? 0 : 8 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Header({
  title,
  back,
  left,
  right,
  large,
}: {
  title?: ReactNode;
  back?: boolean | string;
  left?: ReactNode;
  right?: ReactNode;
  large?: boolean;
}) {
  const nav = useNavigate();
  return (
    <div className="sticky top-0 z-20 bg-bg/85 backdrop-blur-xl pt-safe">
      <div className="flex h-12 items-center gap-2 px-3">
        <div className="flex min-w-[64px] items-center">
          {back ? (
            <button className="press -ml-1 flex items-center text-accent" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}>
              <ChevronLeft size={26} />
            </button>
          ) : (
            left
          )}
        </div>
        <div className={`flex-1 truncate text-center font-display text-[17px] font-semibold uppercase tracking-wider ${large ? 'opacity-0' : ''}`}>{title}</div>
        <div className="flex min-w-[64px] items-center justify-end gap-3">{right}</div>
      </div>
      {large && (
        <h1 className="flex items-center gap-2.5 px-4 pb-2 font-display text-4xl font-bold uppercase tracking-tight">
          <span className="deco-raw h-7 w-1.5 -skew-x-12 bg-accent" />
          {title}
        </h1>
      )}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  tall?: boolean;
}) {
  const controls = useDragControls();
  const rotated = useRotated();
  return (
    <Portal>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-50 bg-black/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              key="sheet"
              className={`fixed inset-x-0 bottom-0 z-[51] flex flex-col rounded-t-3xl bg-card pb-safe shadow-2xl ${tall ? 'h-[88%]' : 'max-h-[88%]'}`}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={spring}
              drag={rotated ? false : 'y'}
              dragControls={controls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.7 }}
              onDragEnd={(_, i) => {
                if (i.offset.y > 90 || i.velocity.y > 600) onClose();
              }}
            >
              <div className="touch-none cursor-grab pb-1 pt-2.5" onPointerDown={(e) => controls.start(e)}>
                <div className="mx-auto h-1.5 w-10 rounded-full bg-line" />
                {title && <div className="px-4 pt-3 text-center font-display text-lg font-semibold uppercase tracking-wider">{title}</div>}
              </div>
              <div className="scroll-area flex-1 pb-4">{children}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function SheetItem({
  icon,
  label,
  onClick,
  danger,
  right,
}: {
  icon?: ReactNode;
  label: ReactNode;
  onClick: () => void;
  danger?: boolean;
  right?: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-5 py-3.5 text-left active:bg-card2 ${danger ? 'text-danger' : ''}`}
    >
      {icon && <span className={danger ? 'text-danger' : 'text-muted'}>{icon}</span>}
      <span className="flex-1">{label}</span>
      {right}
    </button>
  );
}

export function DialogHost() {
  const { current, close } = useDialog();
  return (
    <Portal>
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.id}
            className={`fixed inset-0 z-[60] flex bg-black/60 px-6 ${current.kind === 'sheet' ? 'items-end pb-6' : 'items-center justify-center'}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(null)}
          >
            <motion.div
              className="w-full max-w-sm overflow-hidden cut bg-card2 text-center"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
            >
              {(current.title || current.message) && (
                <div className="px-5 pb-4 pt-5">
                  {current.title && <div className="text-[17px] font-semibold">{current.title}</div>}
                  {current.message && <div className="mt-1.5 text-sm text-muted">{current.message}</div>}
                </div>
              )}
              <div className={`border-t border-line ${current.actions.length === 2 ? 'grid grid-cols-2 divide-x divide-line' : 'divide-y divide-line'}`}>
                {current.actions.map((a) => (
                  <button
                    key={a.value}
                    onClick={() => close(a.value)}
                    className={`w-full py-3.5 text-[17px] active:bg-line ${
                      a.style === 'danger' ? 'font-semibold text-danger' : a.style === 'primary' ? 'font-semibold text-accent' : a.style === 'cancel' ? 'text-muted' : 'text-accent'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

export function ToastHost() {
  const { msg, key } = useToast();
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center pt-safe">
        <AnimatePresence>
          {msg && (
            <motion.div
              key={key}
              className="mt-3 rounded-full bg-card2 px-4 py-2.5 text-sm font-medium shadow-xl ring-1 ring-line"
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -40, opacity: 0 }}
              transition={spring}
            >
              {msg}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Portal>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
}) {
  const v = {
    primary: 'grad font-display uppercase tracking-wider',
    secondary: 'bg-card2 text-white font-display uppercase tracking-wider',
    danger: 'bg-danger/15 text-danger',
    ghost: 'text-accent',
  }[variant];
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`press flex items-center justify-center gap-2 cut-sm px-4 py-3 font-semibold disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function Empty({ icon, title, text, children }: { icon: ReactNode; title: string; text?: string; children?: ReactNode }) {
  return (
    <motion.div
      className="flex flex-col items-center px-8 py-16 text-center"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="mb-4 text-muted">{icon}</div>
      <div className="font-display text-2xl font-bold uppercase">{title}</div>
      {text && <div className="mt-1 text-sm text-muted">{text}</div>}
      {children && <div className="mt-5">{children}</div>}
    </motion.div>
  );
}

/** Re-renders every `ms` and returns the current timestamp. */
export function useNow(ms = 1000, enabled = true) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => force((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms, enabled]);
  return Date.now();
}

