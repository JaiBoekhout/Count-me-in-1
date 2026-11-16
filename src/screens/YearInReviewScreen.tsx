import { CalendarDays, MapPin, Share2, Sunrise, Trophy, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MorePageHeader } from '../components/MorePageHeader'
import { ListSkeleton } from '../components/Skeleton'
import { SportIcon } from '../components/SportIcon'
import { getConfirmedMeetupsForUser, getPatchProgressForUser, loadSavedMeetupsForUser, type ConfirmedMeetup } from '../lib/checkins'
import { useBackToMore } from '../lib/moreNavigation'
import { usePremium } from '../lib/premium'
import { useViewerProfile } from '../lib/viewerProfile'

function countBy<T>(items: T[], key: (item: T) => string | undefined) {
  const counts = new Map<string, number>()
  for (const item of items) {
    const value = key(item)
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])
}

// Pro: "Your year outside", your confirmed meetups of this year in numbers.
export function YearInReviewScreen() {
  const backToMore = useBackToMore()
  const premium = usePremium()
  const viewer = useViewerProfile()
  const name = viewer.status === 'ready' ? viewer.profile?.firstName ?? null : null
  const [meetups, setMeetups] = useState<ConfirmedMeetup[] | null>(null)
  const [shareNote, setShareNote] = useState('')
  const year = new Date().getFullYear()

  useEffect(() => {
    if (!name) return
    let active = true
    loadSavedMeetupsForUser(name)
      .catch(() => name)
      .then((loadedName) => {
        if (!active) return
        setMeetups(getConfirmedMeetupsForUser(loadedName ?? name).filter((meetup) => new Date(meetup.startsAt).getFullYear() === year))
      })
    return () => { active = false }
  }, [name, year])

  const stats = useMemo(() => {
    if (!meetups) return null
    // One row per activity (a meetup with 2 mates is still one outing).
    const outings = [...new Map(meetups.map((meetup) => [String(meetup.activityId), meetup])).values()]
    const sports = countBy(outings, (meetup) => meetup.sport)
    const mates = countBy(meetups, (meetup) => meetup.partner)
    const places = countBy(outings, (meetup) => meetup.suburb)
    const months = countBy(outings, (meetup) => new Date(meetup.startsAt).toLocaleDateString('en-AU', { month: 'long' }))
    const early = outings.filter((meetup) => new Date(meetup.startsAt).getHours() < 7).length
    const patches = name ? getPatchProgressForUser(name).filter((patch) => patch.earned && patch.earnedAt?.startsWith(String(year))).length : 0
    return {
      outings: outings.length,
      hosted: outings.filter((meetup) => meetup.hosted).length,
      sports, mates, places, early, patches,
      busiestMonth: months[0]?.[0] ?? null,
    }
  }, [meetups, name, year])

  async function share() {
    if (!stats) return
    const text = `My ${year} outside on Count Me In: ${stats.outings} meetups, ${stats.mates.length} mates, ${stats.places.length} places${stats.sports[0] ? `, mostly ${stats.sports[0][0].toLowerCase()}` : ''}.`
    try {
      if (navigator.share) await navigator.share({ title: `My ${year} outside`, text })
      else {
        await navigator.clipboard.writeText(text)
        setShareNote('Copied. Paste it anywhere.')
      }
    } catch {
      // Cancelled.
    }
  }

  if (!premium) {
    return (
      <main className="screen more-settings-page">
        <MorePageHeader title="Your year outside" eyebrow="Pro" onBack={backToMore} />
        <p className="more-settings-intro">Your year in numbers is part of Pro. Coming soon.</p>
      </main>
    )
  }

  return (
    <main className="screen more-settings-page year-page">
      <MorePageHeader title={`Your ${year} outside`} eyebrow="Pro" onBack={backToMore} />
      {!stats ? (
        <ListSkeleton rows={4} label="Loading your year" />
      ) : stats.outings === 0 ? (
        <p className="more-settings-intro">No confirmed meetups yet this year. Check in with the QR code at your next activity and your year starts filling up.</p>
      ) : (
        <>
          <section className="year-hero">
            <p className="eyebrow">{name}, this was your year</p>
            <strong>{stats.outings}</strong>
            <span>meetups outside</span>
          </section>
          <div className="year-grid">
            <div className="year-tile"><Users aria-hidden="true" /><strong>{stats.mates.length}</strong><span>mates met</span></div>
            <div className="year-tile"><MapPin aria-hidden="true" /><strong>{stats.places.length}</strong><span>places</span></div>
            <div className="year-tile"><CalendarDays aria-hidden="true" /><strong>{stats.hosted}</strong><span>hosted by you</span></div>
            <div className="year-tile"><Trophy aria-hidden="true" /><strong>{stats.patches}</strong><span>patches earned</span></div>
            <div className="year-tile"><Sunrise aria-hidden="true" /><strong>{stats.early}</strong><span>before 7 am</span></div>
            {stats.busiestMonth && <div className="year-tile"><CalendarDays aria-hidden="true" /><strong className="small">{stats.busiestMonth}</strong><span>busiest month</span></div>}
          </div>

          <h3 className="more-settings-subtitle">Your sports</h3>
          <div className="more-setting-list">
            {stats.sports.map(([sport, count]) => (
              <div className="more-setting-row" key={sport}>
                <span className="sport-admin-name"><SportIcon sport={sport} />{sport}</span>
                <span>{count}×</span>
              </div>
            ))}
          </div>

          {stats.mates.length > 0 && (
            <>
              <h3 className="more-settings-subtitle">Your regular crew</h3>
              <div className="more-setting-list">
                {stats.mates.slice(0, 5).map(([mate, count]) => (
                  <div className="more-setting-row" key={mate}>
                    <span>{mate}</span>
                    <span>{count} {count === 1 ? 'meetup' : 'meetups'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <button type="button" className="button button-primary button-lg" onClick={() => void share()}>
            <Share2 aria-hidden="true" /> Share my year
          </button>
          {shareNote && <p className="more-settings-note" role="status">{shareNote}</p>}
        </>
      )}
    </main>
  )
}
