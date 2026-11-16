import { supabase } from './supabase'

export type Story = {
  id: string
  authorId: string
  authorName: string
  authorPhotoUrl: string | null
  title: string
  body: string
  photoUrl: string | null
  sport: string | null
  hidden: boolean
  createdAt: string
}

const bucket = 'story-photos'

export async function getStories(): Promise<Story[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('stories')
    .select('id, author_id, title, body, photo_url, sport, hidden, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  const rows = data ?? []
  const authorIds = [...new Set(rows.map((row) => row.author_id as string))]
  const { data: authors } = authorIds.length
    ? await supabase.from('profiles').select('id, first_name, photo_url').in('id', authorIds)
    : { data: [] }
  const byId = new Map((authors ?? []).map((author) => [author.id as string, author]))
  return rows.map((row) => ({
    id: row.id, authorId: row.author_id, title: row.title, body: row.body, photoUrl: row.photo_url,
    sport: row.sport, hidden: row.hidden, createdAt: row.created_at,
    authorName: (byId.get(row.author_id)?.first_name as string | undefined) ?? 'Member',
    authorPhotoUrl: (byId.get(row.author_id)?.photo_url as string | null | undefined) ?? null,
  }))
}

export async function uploadStoryPhoto(userId: string, file: File) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height))
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

export async function postStory(story: { title: string; body: string; photoUrl: string | null; sport: string | null }) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { error } = await supabase.from('stories').insert({
    title: story.title.trim(), body: story.body.trim(), photo_url: story.photoUrl, sport: story.sport,
  })
  if (error) throw error
}

export async function deleteStory(story: Story) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { error } = await supabase.from('stories').delete().eq('id', story.id)
  if (error) throw error
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = story.photoUrl?.indexOf(marker) ?? -1
  if (story.photoUrl && index !== -1) {
    await supabase.storage.from(bucket).remove([decodeURIComponent(story.photoUrl.slice(index + marker.length))])
  }
}

export async function setStoryHidden(storyId: string, hidden: boolean) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { error } = await supabase.from('stories').update({ hidden }).eq('id', storyId)
  if (error) throw error
}
