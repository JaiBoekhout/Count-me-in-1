import { ChevronRight, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MorePageHeader } from '../components/MorePageHeader'
import { SportIcon } from '../components/SportIcon'
import { getSavedActivityFeed } from '../lib/activityParticipation'
import { useBackToMore } from '../lib/moreNavigation'
import { useSportCatalog } from '../lib/useSportCatalog'
import { useViewerProfile } from '../lib/viewerProfile'

// Every sport in the app, searchable, with how much is on. Tap a sport to see
// its activities; a good way to try something new.
export function ExploreSportsScreen() {
  const navigate = useNavigate()
  const backToMore = useBackToMore()
  const sports = useSportCatalog()
  const viewer = useViewerProfile()
  const mySports = viewer.status === 'ready' ? viewer.profile?.sports.map((sport) => sport.name) ?? [] : []
  const [query, setQuery] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    let active = true
    getSavedActivityFeed()
      .then((feed) => {
        if (!active) return
        const next: Record<string, number> = {}
        for (const activity of feed) next[activity.sport] = (next[activity.sport] ?? 0) + 1
        setCounts(next)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const results = useMemo(() => {
    const text = query.trim().toLowerCase()
    return sports
      .filter((sport) => !text || sport.toLowerCase().includes(text))
      // Busiest sports first, then A to Z.
      .sort((left, right) => (counts[right] ?? 0) - (counts[left] ?? 0) || left.localeCompare(right))
  }, [sports, query, counts])

  return (
    <main className="screen more-settings-page">
      <MorePageHeader title="Explore sports" eyebrow="Try something new" onBack={backToMore} />
      <label className="explore-search">
        <Search aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search all sports"
          aria-label="Search all sports"
        />
      </label>
      {results.length === 0 ? (
        <p className="more-settings-note">No sport called “{query.trim()}” yet. You can suggest one when you create an activity.</p>
      ) : (
        <div className="more-setting-list">
          {results.map((sport) => {
            const count = counts[sport] ?? 0
            return (
              <button
                type="button"
                key={sport}
                className="more-choice-row explore-sport-row"
                onClick={() => navigate('/more/activities', { state: { sport } })}
              >
                <span className="explore-sport-icon"><SportIcon sport={sport} /></span>
                <span className="grow">
                  <strong>{sport}</strong>
                  <small>
                    {count > 0 ? `${count} ${count === 1 ? 'activity' : 'activities'} coming up` : 'Nothing on yet. Be the first to post one.'}
                  </small>
                </span>
                {mySports.includes(sport) && <span className="explore-sport-mine">Your sport</span>}
                <ChevronRight aria-hidden="true" />
              </button>
            )
          })}
        </div>
      )}
      <button type="button" className="button button-secondary button-md" onClick={() => navigate('/profile/sports/edit')}>
        Edit my sports
      </button>
    </main>
  )
}
