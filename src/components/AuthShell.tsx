import type { ReactNode } from 'react'
import { Wallet as WalletIcon } from 'lucide-react'

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <WalletIcon className="h-5 w-5" />
          </div>
          <p className="text-lg font-bold tracking-tight text-slate-900">
            Digital Wallet
          </p>
        </div>

        <div className="card px-6 py-8 sm:px-8">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>

        {footer && <div className="mt-5 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  )
}