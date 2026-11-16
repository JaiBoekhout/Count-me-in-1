import { ImagePlus, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { MorePageHeader } from '../components/MorePageHeader'
import { useBackToMore } from '../lib/moreNavigation'
import { isMissingDatabaseFeature } from '../lib/notifications'
import { usePremium } from '../lib/premium'
import { getProfileExtras, removeCoverFile, saveProfileExtras, uploadCover } from '../lib/profileExtras'
import { useViewerProfile } from '../lib/viewerProfile'

// Pro: your cover photo and favourite spots.
export function ProfileStyleScreen() {
  const backToMore = useBackToMore()
  const premium = usePremium()
  const viewer = useViewerProfile()
  const userId = viewer.status === 'ready' ? viewer.profile?.id ?? null : null
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [spots, setSpots] = useState<string[]>([])
  const [newSpot, setNewSpot] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!userId) return
    void getProfileExtras(userId).then((extras) => {
      if (!extras) return
      setCoverUrl(extras.coverUrl)
      setSpots(extras.favouriteSpots)
    })
  }, [userId])

  function showError(problem: unknown) {
    setError(isMissingDatabaseFeature(problem)
      ? 'This needs a database update (SQL 34) before it works.'
      : typeof problem === 'object' && problem !== null && 'message' in problem ? String((problem as { message: unknown }).message) : 'Something went wrong.')
  }

  async function save(nextCover: string | null, nextSpots: string[]) {
    if (!userId) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await saveProfileExtras(userId, { coverUrl: nextCover, favouriteSpots: nextSpots })
      setCoverUrl(nextCover)
      setSpots(nextSpots)
      setNotice('Saved. It shows on your profile.')
    } catch (problem) {
      showError(problem)
    } finally {
      setBusy(false)
    }
  }

  async function pickCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return
    setBusy(true)
    setError('')
    try {
      const url = await uploadCover(userId, file)
      const old = coverUrl
      await save(url, spots)
      await removeCoverFile(userId, old)
    } catch (problem) {
      showError(problem)
      setBusy(false)
    }
  }

  if (!premium) {
    return (
      <main className="screen more-settings-page">
        <MorePageHeader title="Cover and spots" eyebrow="Pro" onBack={backToMore} />
        <p className="more-settings-intro">A cover photo and favourite spots are part of Pro. Coming soon.</p>
      </main>
    )
  }

  return (
    <main className="screen more-settings-page">
      <MorePageHeader title="Cover and spots" eyebrow="Pro" onBack={backToMore} />
      {error && <p className="edit-form-error" role="alert">{error}</p>}
      {notice && <p className="activity-share-feedback" role="status">{notice}</p>}

      <h3 className="more-settings-subtitle">Cover photo</h3>
      <div className="cover-preview">
        {coverUrl ? <img src={coverUrl} alt="Your cover photo" /> : <span>No cover photo yet</span>}
      </div>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void pickCover(event)} />
      <div className="partner-form-row">
        <button type="button" className="button button-secondary button-md" disabled={busy} onClick={() => fileRef.current?.click()}>
          <ImagePlus aria-hidden="true" /> {coverUrl ? 'Change photo' : 'Add a photo'}
        </button>
        {coverUrl && (
          <button
            type="button"
            className="button button-secondary button-md"
            disabled={busy}
            onClick={() => {
              const old = coverUrl
              void save(null, spots).then(() => { if (userId) void removeCoverFile(userId, old) })
            }}
          >
            Remove
          </button>
        )}
      </div>

      <h3 className="more-settings-subtitle">Favourite spots (up to 5)</h3>
      <div className="spot-chips">
        {spots.map((spot) => (
          <span className="spot-chip" key={spot}>
            {spot}
            <button type="button" aria-label={`Remove ${spot}`} disabled={busy} onClick={() => void save(coverUrl, spots.filter((item) => item !== spot))}>
              <X aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      {spots.length < 5 && (
        <form
          className="spot-add"
          onSubmit={(event) => {
            event.preventDefault()
            const value = newSpot.trim()
            if (!value || spots.includes(value)) return
            setNewSpot('')
            void save(coverUrl, [...spots, value])
          }}
        >
          <input value={newSpot} maxLength={40} onChange={(event) => setNewSpot(event.target.value)} placeholder="For example, Port Noarlunga reef" />
          <button type="submit" className="button button-primary button-md" disabled={busy || !newSpot.trim()}>
            <Plus aria-hidden="true" /> Add
          </button>
        </form>
      )}
    </main>
  )
}
