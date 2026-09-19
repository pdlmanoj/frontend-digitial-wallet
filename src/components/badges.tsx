import { Badge, type BadgeTone } from './ui'
import type { TxStatus } from '../types'

// The API only uses pending / success / failed (the roadmap mentions
// completed / reversed, but they are not implemented in the backend).
const statusTone: Record<TxStatus, BadgeTone> = {
  pending: 'warning',
  success: 'success',
  failed: 'danger',
}

const statusLabel: Record<TxStatus, string> = {
  pending: 'Pending',
  success: 'Success',
  failed: 'Failed',
}

export function TransactionStatusBadge({ status }: { status: TxStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>
}

export function WalletStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge tone="success">Active</Badge>
  ) : (
    <Badge tone="warning">Inactive</Badge>
  )
}