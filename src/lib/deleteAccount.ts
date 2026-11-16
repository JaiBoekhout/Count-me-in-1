import { supabase } from './supabase'

// Every bucket where members keep files in a folder named after their id.
const buckets = ['avatars', 'pr-proofs', 'activity-covers', 'profile-covers', 'story-photos']

async function removeOwnFiles(userId: string) {
  if (!supabase) return
  for (const bucket of buckets) {
    const { data } = await supabase.storage.from(bucket).list(userId, { limit: 1000 })
    const paths = (data ?? []).map((file) => `${userId}/${file.name}`)
    if (paths.length) await supabase.storage.from(bucket).remove(paths)
  }
}

// Deletes your photos, then your account and everything linked to it.
export async function deleteMyAccount() {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { data } = await supabase.auth.getUser()
  const userId = data.user?.id
  if (!userId) throw new Error('Sign in before deleting your account.')
  // Photos first: files are not removed by the database.
  await removeOwnFiles(userId).catch(() => undefined)
  const { error } = await supabase.rpc('delete_my_account')
  if (error) throw error
  await supabase.auth.signOut().catch(() => undefined)
  try {
    window.localStorage.clear()
    window.sessionStorage.clear()
  } catch {
    // Nothing to clear.
  }
}
