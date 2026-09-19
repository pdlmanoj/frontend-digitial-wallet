import { useEffect, useId, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type ButtonHTMLAttributes } from 'react'
import { X } from 'lucide-react'

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/40 shadow-sm',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400/30 shadow-sm',
  danger:
    'bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/40 shadow-sm',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${buttonStyles[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

interface FieldProps {
  label: string
  hint?: string
  error?: string
  id?: string
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {}

export function Input({ label, hint, error, id, className = '', ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  return (
    <div>
      <label htmlFor={inputId} className="label">
        {label}
      </label>
      <input id={inputId} className={`input ${error ? 'border-rose-400' : ''} ${className}`} {...rest} />
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {
  options: { value: string; label: string }[]
}

export function Select({ label, hint, error, options, id, className = '', ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  return (
    <div>
      <label htmlFor={selectId} className="label">
        {label}
      </label>
      <select id={selectId} className={`input ${error ? 'border-rose-400' : ''} ${className}`} {...rest}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <p className="field-error">{error}</p> : hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'

const badgeStyles: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  danger: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20',
}

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badgeStyles[tone]}`}
    >
      {children}
    </span>
  )
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

const alertStyles: Record<AlertTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: AlertTone
  title?: string
  children?: ReactNode
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${alertStyles[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className="mt-0.5">{children}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" role="dialog" aria-modal="true" aria-label={title}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}