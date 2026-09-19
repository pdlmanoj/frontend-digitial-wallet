import { useCallback, useEffect, useState } from 'react'
import { walletApi } from './api'
import type { WalletBalance } from '../types'

/**
 * Loads the authenticated user's wallet from /wallet/check-balance.
 * The API returns HTTP 400 when the user has no wallet yet, which we treat
 * as `wallet === null` rather than an error.
 */
export function useWalletBalance() {
  const [wallet, setWallet] = useState<WalletBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await walletApi.balance()
      setWallet(result)
    } catch (err) {
      if (err instanceof Error && /no wallet/i.test(err.message)) {
        setWallet(null)
        setError(null)
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load wallet')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { wallet, loading, error, refresh }
}