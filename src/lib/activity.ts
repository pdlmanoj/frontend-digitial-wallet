import type { LocalTransaction } from '../types'

// The backend does not expose transaction history yet, so the app keeps a
// lightweight log of the transactions performed in this browser session.
// This is stored in localStorage so it survives a page refresh.
const STORAGE_KEY = 'dw.activity'

export function getActivity(): LocalTransaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as LocalTransaction[]
    if (!Array.isArray(parsed)) return []
    return parsed.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  } catch {
    return []
  }
}

export function addActivity(entry: Omit<LocalTransaction, 'id' | 'createdAt'>): void {
  const all = getActivity()
  const row: LocalTransaction = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([row, ...all]))
}

export function clearActivity(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// The deposit/withdraw endpoints randomly report success or failure in the
// response message. Derive a status from the words used so we can log it.
export function statusFromMessage(msg: string): 'success' | 'failed' {
  if (/failed|FAILED/i.test(msg)) return 'failed'
  if (/success|SUCCESS|successfully/i.test(msg)) return 'success'
  return 'success'
}