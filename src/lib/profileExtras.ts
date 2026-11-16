import { useEffect, useState } from 'react'
import { supabase } from './supabase'

// Pro: cover photo and favourite spots on a profile.
export type ProfileExtras = { coverUrl: string | null; favouriteSpots: string[] }
const bucket = 'profile-covers'

export async function getProfileExtras(userId: string): Promise<ProfileExtras | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('profile_extras').select('cover_url, favourite_spots').eq('user_id', userId).maybeSingle()
  if (error || !data) return null
  return { coverUrl: data.cover_url, favouriteSpots: data.favourite_spots ?? [] }
}

export function useProfileExtras(userId: string | null | undefined) {
  const [extras, setExtras] = useState<ProfileExtras | null>(null)
  useEffect(() => {
    if (!userId) return
    let active = true
    void getProfileExtras(userId).then((result) => { if (active) setExtras(result) })
    return () => { active = false }
  }, [userId])
  return extras
}

export async function saveProfileExtras(userId: string, extras: ProfileExtras) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { error } = await supabase.from('profile_extras').upsert({
    user_id: userId,
    cover_url: extras.coverUrl,
    favourite_spots: extras.favouriteSpots.map((spot) => spot.trim()).filter(Boolean).slice(0, 5),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

// Wide cover, max 1600 px, JPEG about 80%.
export async function uploadCover(userId: string, file: File) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available in this browser.')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
  if (!blob) throw new Error('Unable to compress the photo.')
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function removeCoverFile(userId: string, url: string | null) {
  if (!supabase || !url) return
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = url.indexOf(marker)
  if (index === -1) return
  const path = decodeURIComponent(url.slice(index + marker.length))
  if (path.startsWith(`${userId}/`)) await supabase.storage.from(bucket).remove([path])
}
