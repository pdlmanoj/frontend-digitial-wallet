export function formatMoney(
  amount: string | number | null | undefined,
  currency = 'NPR',
): string {
  const value = Number(amount ?? 0)
  if (Number.isNaN(value)) return `${currency} 0.00`
  return `${currency} ${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDOB(iso: string): string {
  const date = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function isValidPhone(value: string): boolean {
  return /^[0-9]{10}$/.test(value)
}

// The deposit/withdraw endpoints report success/failure in the response text.
export function statusFromMessage(msg: string): 'success' | 'failed' {
  if (/failed|FAILED/i.test(msg)) return 'failed'
  if (/success|SUCCESS|successfully/i.test(msg)) return 'success'
  return 'success'
}