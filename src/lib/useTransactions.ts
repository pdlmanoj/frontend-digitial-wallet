import { useCallback, useEffect, useState } from 'react'
import { transactionApi } from './api'
import type { PaginatedResponse, ServerTransaction } from '../types'

/** Loads the authenticated user's deposit/withdraw history from the API. */
export function useTransactions(page: number, pageSize: number) {
  const [data, setData] = useState<PaginatedResponse<ServerTransaction> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (force = false) => {
      setLoading(true)
      setError(null)
      try {
        const response = await transactionApi.recent(page, pageSize, force)
        setData(response)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions')
      } finally {
        setLoading(false)
      }
    },
    [page, pageSize],
  )

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(() => load(true), [load])

  return {
    transactions: data?.results ?? [],
    pagination: data?.pagination ?? null,
    loading,
    error,
    refresh,
  }
}
