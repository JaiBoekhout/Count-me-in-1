import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { MorePageHeader } from '../components/MorePageHeader'
import { PartnerBannerCard } from '../components/PartnerSlider'
import { ListSkeleton } from '../components/Skeleton'
import { getCurrentModerationRole } from '../lib/moderation'
import { useBackToMore } from '../lib/moreNavigation'
import {
  deletePartnerBanner,
  getAllPartnerBanners,
  getPartnerStats,
  savePartnerBanner,
  uploadPartnerImage,
  type PartnerBanner,
  type PartnerBannerDraft,
  type PartnerStats,
} from '../lib/partners'
import { isMissingDatabaseFeature } from '../lib/notifications'
import { useSportCatalog } from '../lib/useSportCatalog'

const emptyDraft: PartnerBannerDraft = {
  name: '', headline: '', ctaLabel: 'Learn more', linkUrl: '', imageUrl: '', sport: null,
  status: 'concept', startsOn: null, endsOn: null, sortOrder: 0,
}

// Team only: partner (sponsor) banners. Concept = only admins and moderators
// see it (for demos). Live = every member sees it.
export function PartnersAdminScreen() {
  const backToMore = useBackToMore()
  const sports = useSportCatalog()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [isStaff, setIsStaff] = useState<boolean | null>(null)
  const [banners, setBanners] = useState<PartnerBanner[] | null>(null)
  const [stats, setStats] = useState<PartnerStats>({})
  const [draft, setDraft] = useState<PartnerBannerDraft>(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function showError(problem: unknown, fallback: string) {
    setError(isMissingDatabaseFeature(problem)
      ? 'This needs a database update (SQL 28) before it works.'
      : problem instanceof Error ? problem.message
        : typeof problem === 'object' && problem !== null && 'message' in problem ? String((problem as { message: unknown }).message)
          : fallback)
  }

  async function reload() {
    const [list, numbers] = await Promise.all([getAllPartnerBanners(), getPartnerStats()])
    setBanners(list)
    setStats(numbers)
  }

  useEffect(() => {
    let active = true
    getCurrentModerationRole()
      .then(async (role) => {
        if (!active) return
        const staff = role === 'admin' || role === 'moderator'
        setIsStaff(staff)
        if (staff) await reload()
      })
      .catch((problem: unknown) => {
        if (!active) return
        setIsStaff((current) => current ?? false)
        setBanners([])
        showError(problem, 'Unable to load partner banners.')
      })
    return () => { active = false }
  }, [])

  function startNew() {
    setDraft(emptyDraft)
    setEditingId(null)
    setFormOpen(true)
    setError('')
    setNotice('')
  }

  function startEdit(banner: PartnerBanner) {
    const { id, ...rest } = banner
    setDraft(rest)
    setEditingId(id)
    setFormOpen(true)
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function pickImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const imageUrl = await uploadPartnerImage(file)
      setDraft((current) => ({ ...current, imageUrl }))
    } catch (problem) {
      showError(problem, 'Unable to upload the image.')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!draft.name.trim() || !draft.imageUrl) {
      setError('Add a partner name and an image.')
      return
    }
    if (draft.linkUrl.trim() && !/^https:\/\//i.test(draft.linkUrl.trim())) {
      setError('The link must start with https://')
      return
    }
    setBusy(true)
    setError('')
    try {
      await savePartnerBanner(draft, editingId ?? undefined)
      setNotice(draft.status === 'live' ? 'Saved. Every member can see this banner now.' : 'Saved as concept. Only the team sees it.')
      setFormOpen(false)
      await reload()
    } catch (problem) {
      showError(problem, 'Unable to save this banner.')
    } finally {
      setBusy(false)
    }
  }

  async function remove(banner: PartnerBanner) {
    if (!window.confirm(`Remove the banner for ${banner.name}?`)) return
    setError('')
    try {
      await deletePartnerBanner(banner)
      setNotice('Banner removed.')
      await reload()
    } catch (problem) {
      showError(problem, 'Unable to remove this banner.')
    }
  }

  const set = <Key extends keyof PartnerBannerDraft>(key: Key, value: PartnerBannerDraft[Key]) =>
    setDraft((current) => ({ ...current, [key]: value }))

  return (
    <main className="screen more-settings-page">
      <MorePageHeader title="Partners" eyebrow="Team" onBack={backToMore} />
      {isStaff === null ? (
        <ListSkeleton rows={3} label="Loading" />
      ) : !isStaff ? (
        <p className="more-settings-note">Only the team can manage partner banners.</p>
      ) : (
        <>
          <p className="more-settings-intro">
            Banners for sponsors. <strong>Concept</strong> banners are only visible to admins and moderators, handy to show a business what it would look like. <strong>Live</strong> banners are shown to every member.
          </p>
          {notice && <p className="activity-share-feedback" role="status">{notice}</p>}
          {error && <p className="edit-form-error" role="alert">{error}</p>}

          {!formOpen ? (
            <button type="button" className="button button-primary button-md" onClick={startNew}>Add a banner</button>
          ) : (
            <form className="partner-form" onSubmit={(event) => { event.preventDefault(); void save() }}>
              <h3 className="more-settings-subtitle">{editingId ? 'Edit banner' : 'New banner'}</h3>
              {draft.imageUrl && <PartnerBannerCard banner={draft} preview />}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void pickImage(event)} />
              <button type="button" className="button button-secondary button-md" disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? 'Working…' : draft.imageUrl ? 'Change image' : 'Upload image'}
              </button>
              <p className="more-settings-note">Best size: 1600 × 800 px (wide). Keep the left side calm; the text sits there.</p>
              <label className="edit-field"><span>Partner name</span>
                <input value={draft.name} maxLength={80} onChange={(event) => set('name', event.target.value)} placeholder="For example, Dive Adelaide" />
              </label>
              <label className="edit-field"><span>Headline (optional)</span>
                <input value={draft.headline} maxLength={80} onChange={(event) => set('headline', event.target.value)} placeholder="For example, 10% off for members" />
              </label>
              <label className="edit-field"><span>Link (optional, https://)</span>
                <input value={draft.linkUrl} inputMode="url" onChange={(event) => set('linkUrl', event.target.value)} placeholder="https://example.com.au" />
              </label>
              <label className="edit-field"><span>Button text</span>
                <input value={draft.ctaLabel} maxLength={24} onChange={(event) => set('ctaLabel', event.target.value)} />
              </label>
              <label className="edit-field"><span>Show for</span>
                <select value={draft.sport ?? ''} onChange={(event) => set('sport', event.target.value || null)}>
                  <option value="">Every sport (Home)</option>
                  {sports.map((sport) => <option key={sport} value={sport}>Only {sport}</option>)}
                </select>
              </label>
              <div className="partner-form-row">
                <label className="edit-field"><span>From (optional)</span>
                  <input type="date" value={draft.startsOn ?? ''} onChange={(event) => set('startsOn', event.target.value || null)} />
                </label>
                <label className="edit-field"><span>Until (optional)</span>
                  <input type="date" value={draft.endsOn ?? ''} onChange={(event) => set('endsOn', event.target.value || null)} />
                </label>
              </div>
              <label className="edit-field"><span>Order (lower comes first)</span>
                <input type="number" value={draft.sortOrder} onChange={(event) => set('sortOrder', Number(event.target.value) || 0)} />
              </label>
              <div className="segment-bar" role="radiogroup" aria-label="Who can see it">
                <button type="button" className={draft.status === 'concept' ? 'active' : ''} aria-pressed={draft.status === 'concept'} onClick={() => set('status', 'concept')}>Concept (team only)</button>
                <button type="button" className={draft.status === 'live' ? 'active' : ''} aria-pressed={draft.status === 'live'} onClick={() => set('status', 'live')}>Live (everyone)</button>
              </div>
              <div className="partner-form-row">
                <button type="button" className="button button-secondary button-md" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="button button-primary button-md" disabled={busy}>{busy ? 'Saving…' : 'Save banner'}</button>
              </div>
            </form>
          )}

          <h3 className="more-settings-subtitle">Banners</h3>
          {banners === null ? (
            <ListSkeleton rows={2} label="Loading banners" />
          ) : banners.length === 0 ? (
            <p className="more-settings-note">No banners yet.</p>
          ) : (
            <div className="partner-admin-list">
              {banners.map((banner) => {
                const numbers = stats[banner.id] ?? { views: 0, taps: 0 }
                return (
                  <div className="partner-admin-item" key={banner.id}>
                    <PartnerBannerCard banner={banner} preview />
                    <p className="more-settings-note">
                      {banner.sport ? `Only ${banner.sport}` : 'Every sport'} · last 30 days: {numbers.views} {numbers.views === 1 ? 'view' : 'views'}, {numbers.taps} {numbers.taps === 1 ? 'tap' : 'taps'}
                    </p>
                    <div className="partner-form-row">
                      <button type="button" className="button button-secondary button-md" onClick={() => startEdit(banner)}>Edit</button>
                      <button type="button" className="button button-secondary button-md" onClick={() => void remove(banner)}>Remove</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </main>
  )
}
