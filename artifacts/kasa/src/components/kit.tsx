import { type ReactNode, useEffect } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, Inbox, X } from 'lucide-react';
import { STATUS_LABEL } from '@/lib/format';

export const btn =
  'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition active:translate-y-px hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-md border border-input bg-card px-4 py-2.5 text-sm font-semibold text-foreground transition active:translate-y-px hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-md border border-destructive/40 bg-card px-3 py-2 text-sm font-semibold text-destructive transition active:translate-y-px hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50';
export const inputCls =
  'w-full rounded-md border border-input bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/25 disabled:opacity-60';
export const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground';

export function Logo({ light = false, to = '/' }: { light?: boolean; to?: string }) {
  return (
    <Link href={to} className="inline-flex items-center gap-2.5" data-testid="link-logo">
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
        <rect width="64" height="64" rx="14" fill={light ? '#e0a21c' : '#0f3d44'} />
        <path d="M14 46V18h6l12 17 12-17h6v28h-6V28L32 44 20 28v18z" fill={light ? '#0f3d44' : '#f6efe0'} />
        <rect x="14" y="50" width="36" height="3" rx="1.5" fill={light ? '#0f3d44' : '#e0a21c'} />
      </svg>
      <span className={`font-display text-xl font-bold ${light ? 'text-sidebar-foreground' : 'text-foreground'}`}>
        MMT Kasa
      </span>
    </Link>
  );
}

export function StatusBadge({ status }: { status: 'PENDING' | 'COMPLETED' | 'CANCELLED' }) {
  const paid = status === 'COMPLETED';
  const cancelled = status === 'CANCELLED';
  return (
    <span
      data-testid={`status-${status.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
        cancelled ? 'bg-muted text-muted-foreground' : paid ? 'bg-paid-soft text-paid' : 'bg-pending-soft text-pending'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cancelled ? 'bg-muted-foreground' : paid ? 'bg-paid' : 'bg-pending'}`} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Skeleton({ className = 'h-6 w-full' }: { className?: string }) {
  return <div className={`skel ${className}`} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" data-testid="loading-list">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" data-testid="error-box">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className={btnDanger} data-testid="button-retry">
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn'; children: ReactNode }) {
  return (
    <div className={`rounded-md border-l-4 p-4 text-sm ${tone === 'warn' ? 'border-pending bg-pending-soft/60' : 'border-primary bg-secondary/70'}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="ruled rounded-lg border border-dashed border-input bg-card/60 px-6 py-12 text-center" data-testid="empty-state">
      <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="rise mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
      <div className="min-w-0 max-w-full [overflow-wrap:anywhere]">
        <h1 className="text-3xl font-bold">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-foreground/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal className="rise w-full max-w-md rounded-t-xl bg-card p-5 shadow-xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Kapat" className="rounded p-1 hover:bg-secondary" data-testid="button-close-modal">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
