import { supabase } from './supabase'

// Partner banners (sponsors). "concept" banners are only visible to the team
// (admins and moderators), "live" banners to everyone (enforced in the database).

export type PartnerBanner = {
  id: string
  name: string
  headline: string
  ctaLabel: string
  linkUrl: string
  imageUrl: string
  sport: string | null
  status: 'concept' | 'live'
  startsOn: string | null
  endsOn: string | null
  sortOrder: number
}

export type PartnerBannerDraft = Omit<PartnerBanner, 'id'>

const bucket = 'partner-banners'
const columns = 'id, name, headline, cta_label, link_url, image_url, sport, status, starts_on, ends_on, sort_order'

type Row = {
  id: string; name: string; headline: string; cta_label: string; link_url: string; image_url: string
  sport: string | null; status: 'concept' | 'live'; starts_on: string | null; ends_on: string | null; sort_order: number
}

function toBanner(row: Row): PartnerBanner {
  return {
    id: row.id, name: row.name, headline: row.headline, ctaLabel: row.cta_label, linkUrl: row.link_url,
    imageUrl: row.image_url, sport: row.sport, status: row.status, startsOn: row.starts_on, endsOn: row.ends_on,
    sortOrder: row.sort_order,
  }
}

function toRow(draft: PartnerBannerDraft) {
  return {
    name: draft.name.trim(), headline: draft.headline.trim(), cta_label: draft.ctaLabel.trim() || 'Learn more',
    link_url: draft.linkUrl.trim(), image_url: draft.imageUrl, sport: draft.sport || null, status: draft.status,
    starts_on: draft.startsOn || null, ends_on: draft.endsOn || null, sort_order: draft.sortOrder,
    updated_at: new Date().toISOString(),
  }
}

// Banners you may see (database rules decide). Sorted for the slider.
export async function getPartnerBanners(): Promise<PartnerBanner[]> {
  if (!supabase) return []
  const { data, error } = await supabase.from('partner_banners').select(columns).order('sort_order').order('created_at')
  if (error) return [] // table not there yet: no banners
  return (data as Row[]).map(toBanner)
}

// For the team screen: same list, but errors are shown.
export async function getAllPartnerBanners(): Promise<PartnerBanner[]> {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { data, error } = await supabase.from('partner_banners').select(columns).order('sort_order').order('created_at')
  if (error) throw error
  return (data as Row[]).map(toBanner)
}

export async function savePartnerBanner(draft: PartnerBannerDraft, id?: string) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const request = id
    ? supabase.from('partner_banners').update(toRow(draft)).eq('id', id)
    : supabase.from('partner_banners').insert(toRow(draft))
  const { error } = await request
  if (error) throw error
}

export async function deletePartnerBanner(banner: PartnerBanner) {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  const { error } = await supabase.from('partner_banners').delete().eq('id', banner.id)
  if (error) throw error
  const path = imagePath(banner.imageUrl)
  if (path) await supabase.storage.from(bucket).remove([path])
}

function imagePath(url: string) {
  const marker = `/storage/v1/object/public/${bucket}/`
  const index = url.indexOf(marker)
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length))
}

// Wide banner: max 1600 px, JPEG about 82%, so storage stays small.
export async function uploadPartnerImage(file: File) {
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
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!blob) throw new Error('Unable to compress the banner image.')
  const path = `${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600' })
  if (error) throw error
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

// One view and one tap per member per banner per day are counted.
const logged = new Set<string>()
export async function logPartnerEvent(bannerId: string, kind: 'view' | 'tap') {
  const key = `${bannerId}:${kind}`
  if (!supabase || logged.has(key)) return
  logged.add(key)
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  await supabase.from('partner_banner_events').upsert(
    { banner_id: bannerId, kind },
    { onConflict: 'banner_id,user_id,kind,day', ignoreDuplicates: true },
  )
}

export type PartnerStats = Record<string, { views: number; taps: number }>

export async function getPartnerStats(): Promise<PartnerStats> {
  if (!supabase) return {}
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await supabase.from('partner_banner_events').select('banner_id, kind').gte('day', since)
  if (error) return {}
  const stats: PartnerStats = {}
  for (const row of data ?? []) {
    const entry = (stats[row.banner_id as string] ??= { views: 0, taps: 0 })
    if (row.kind === 'tap') entry.taps += 1
    else entry.views += 1
  }
  return stats
}

// Banners for a place in the app: general ones plus those for the given sports.
export function bannersFor(banners: PartnerBanner[], sports: string[] | null) {
  return banners.filter((banner) => !banner.sport || !sports || sports.includes(banner.sport))
}
