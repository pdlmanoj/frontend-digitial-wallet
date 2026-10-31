import { useCallback, useEffect, useState } from 'react'
import { userApi } from './api'
import type { ProfileImage } from '../types'

const PROFILE_IMAGE_EVENT = 'dw:profile-image-updated'

function broadcastProfileImage(image: ProfileImage): void {
  window.dispatchEvent(new CustomEvent(PROFILE_IMAGE_EVENT, { detail: image }))
}

export function useProfileImage() {
  const [image, setImage] = useState<ProfileImage>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (force = false) => {
    setLoading(true)
    setError(null)
    try {
      setImage(await userApi.profileImage(force))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile image')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onImageUpdated = (event: Event) => {
      setImage((event as CustomEvent<ProfileImage>).detail)
    }
    window.addEventListener(PROFILE_IMAGE_EVENT, onImageUpdated)
    return () => window.removeEventListener(PROFILE_IMAGE_EVENT, onImageUpdated)
  }, [])

  const refresh = useCallback(() => load(true), [load])

  const upload = useCallback(async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      await userApi.uploadProfileImage(file)
      const next = await userApi.profileImage(true)
      setImage(next)
      broadcastProfileImage(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload image'
      setError(message)
      throw err
    } finally {
      setUploading(false)
    }
  }, [])

  return { image, loading, uploading, error, refresh, upload }
}
