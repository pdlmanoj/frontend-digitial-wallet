import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { AuthShell } from '../components/AuthShell'
import { Button } from '../components/ui'

export function NotFound() {
  return (
    <AuthShell title="Page not found" subtitle="The page you're looking for doesn't exist.">
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Compass className="h-7 w-7" />
        </div>
        <p className="max-w-xs text-sm text-slate-500">
          You may have followed a broken link, or the page may have moved.
        </p>
        <Link to="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    </AuthShell>
  )
}