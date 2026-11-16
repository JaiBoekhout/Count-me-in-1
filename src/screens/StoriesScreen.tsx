import { Flag, ImagePlus, PenLine, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { MorePageHeader } from '../components/MorePageHeader'
import { ReportDialog } from '../components/ReportDialog'
import { ListSkeleton } from '../components/Skeleton'
import { SportIcon } from '../components/SportIcon'
import { getProfilePath } from '../lib/profile'
import { getCurrentModerationRole } from '../lib/moderation'
import { useBackToMore } from '../lib/moreNavigation'
import { isMissingDatabaseFeature } from '../lib/notifications'
import { usePremium } from '../lib/premium'
import { deleteStory, getStories, postStory, setStoryHidden, uploadStoryPhoto, type Story } from '../lib/stories'
import { useSportCatalog } from '../lib/useSportCatalog'
import { useViewerProfile } from '../lib/viewerProfile'

// Stories: short write-ups of trips and sessions, with a photo. Reading is
// for everyone; posting is Pro. Kept simple on purpose: no likes, no comments.
export function StoriesScreen() {
  const navigate = useNavigate()
  const backToMore = useBackToMore()
  const premium = usePremium()
  const sports = useSportCatalog()
  const viewer = useViewerProfile()
  const userId = viewer.status === 'ready' ? viewer.profile?.id ?? null : null
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [stories, setStories] = useState<Story[] | null>(null)
  const [isStaff, setIsStaff] = useState(false)
  const [composerOpen, setComposerOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sport, setSport] = useState('')
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reporting, setReporting] = useState<Story | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  function showError(problem: unknown) {
    setError(isMissingDatabaseFeature(problem)
      ? 'This needs a database update (SQL 35) before it works.'
      : typeof problem === 'object' && problem !== null && 'message' in problem ? String((problem as { message: unknown }).message) : 'Something went wrong.')
  }

  async function load() {
    try {
      setStories(await getStories())
    } catch (problem) {
      showError(problem)
      setStories([])
    }
  }

  useEffect(() => {
    void load()
    void getCurrentModerationRole().then((role) => setIsStaff(role === 'admin' || role === 'moderator')).catch(() => undefined)
  }, [])

  async function pickPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !userId) return
    setBusy(true)
    setError('')
    try {
      setPhotoUrl(await uploadStoryPhoto(userId, file))
    } catch (problem) {
      showError(problem)
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (title.trim().length < 3 || body.trim().length < 10) {
      setError('Give your story a title and a few sentences.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await postStory({ title, body, photoUrl, sport: sport || null })
      setTitle('')
      setBody('')
      setSport('')
      setPhotoUrl(null)
      setComposerOpen(false)
      await load()
    } catch (problem) {
      showError(problem)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="screen more-settings-page stories-page">
      <MorePageHeader title="Stories" eyebrow="From the crew" onBack={backToMore} />
      <p className="more-settings-intro">Trips, sessions and good days out, shared by members.</p>
      {error && <p className="edit-form-error" role="alert">{error}</p>}

      {premium && !composerOpen && (
        <button type="button" className="button button-primary button-md" onClick={() => setComposerOpen(true)}>
          <PenLine aria-hidden="true" /> Write a story
        </button>
      )}
      {premium && composerOpen && (
        <form className="story-composer" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <label className="edit-field"><span>Title</span>
            <input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="For example, Glass-off at Seaford" />
          </label>
          <label className="edit-field"><span>Your story</span>
            <textarea value={body} maxLength={2000} rows={6} onChange={(event) => setBody(event.target.value)} placeholder="What happened, who was there, what made it good?" />
          </label>
          <label className="edit-field"><span>Sport (optional)</span>
            <select className="alert-select" value={sport} onChange={(event) => setSport(event.target.value)}>
              <option value="">No sport</option>
              {sports.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          {photoUrl && <img className="story-photo" src={photoUrl} alt="" />}
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void pickPhoto(event)} />
          <button type="button" className="button button-secondary button-md" disabled={busy} onClick={() => fileRef.current?.click()}>
            <ImagePlus aria-hidden="true" /> {photoUrl ? 'Change photo' : 'Add a photo'}
          </button>
          <div className="partner-form-row">
            <button type="button" className="button button-secondary button-md" onClick={() => setComposerOpen(false)}>Cancel</button>
            <button type="submit" className="button button-primary button-md" disabled={busy}>{busy ? 'Posting…' : 'Post story'}</button>
          </div>
        </form>
      )}

      {stories === null ? (
        <ListSkeleton rows={3} label="Loading stories" />
      ) : stories.length === 0 ? (
        <p className="more-settings-note">No stories yet.</p>
      ) : (
        <div className="story-list">
          {stories.map((story) => {
            const isOwn = story.authorId === userId
            const long = story.body.length > 280
            const open = expanded === story.id
            return (
              <article className={`story-card ${story.hidden ? 'is-hidden' : ''}`} key={story.id}>
                {story.photoUrl && <img className="story-photo" src={story.photoUrl} alt="" loading="lazy" />}
                <div className="story-body">
                  {story.hidden && <p className="story-hidden-note">Hidden by the team</p>}
                  <button type="button" className="story-author" onClick={() => navigate(getProfilePath({ id: story.authorId, name: story.authorName }))}>
                    <Avatar name={story.authorName} photoUrl={story.authorPhotoUrl} size={28} />
                    <span>{story.authorName}</span>
                    <small>{new Date(story.createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}</small>
                    {story.sport && <span className="story-sport"><SportIcon sport={story.sport} />{story.sport}</span>}
                  </button>
                  <h2>{story.title}</h2>
                  <p>{long && !open ? `${story.body.slice(0, 280)}…` : story.body}</p>
                  <div className="story-actions">
                    {long && <button type="button" onClick={() => setExpanded(open ? null : story.id)}>{open ? 'Show less' : 'Read more'}</button>}
                    {!isOwn && <button type="button" onClick={() => setReporting(story)}><Flag aria-hidden="true" /> Report</button>}
                    {isStaff && !isOwn && (
                      <button type="button" onClick={() => void setStoryHidden(story.id, !story.hidden).then(load).catch(showError)}>
                        {story.hidden ? 'Show again' : 'Hide'}
                      </button>
                    )}
                    {(isOwn || isStaff) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Delete this story?')) void deleteStory(story).then(load).catch(showError)
                        }}
                      >
                        <Trash2 aria-hidden="true" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {reporting && (
        <ReportDialog
          targetType="story"
          targetId={reporting.id}
          targetLabel={reporting.title}
          onClose={() => setReporting(null)}
        />
      )}
    </main>
  )
}
