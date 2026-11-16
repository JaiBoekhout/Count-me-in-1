import { useEffect, useState } from 'react'
import { getMySavedActivities, getSavedActivityFeed } from '../lib/activityParticipation'
import { formatActivityDate } from '../data/mockData'
import { SidePanel } from './SidePanel'
import { SportIcon } from './SportIcon'

type Option = { id: string; title: string; sport: string; startsAt: Date; suburb: string; label: string }

// Pick an upcoming activity to share in a chat: yours first (going or hosting),
// then other activities coming up.
export function PickActivityPanel({ onPick, onClose }: { onPick: (activityId: string) => void; onClose: () => void }) {
  const [mine, setMine] = useState<Option[] | null>(null)
  const [others, setOthers] = useState<Option[]>([])

  useEffect(() => {
    let active = true
    Promise.all([getMySavedActivities().catch(() => []), getSavedActivityFeed().catch(() => [])]).then(([my, feed]) => {
      if (!active) return
      const upcoming = my.filter((item) => !item.isPast && item.joinStatus !== 'requested')
      const myIds = new Set(upcoming.map((item) => item.id))
      setMine(upcoming.map((item) => ({
        id: item.id, title: item.title, sport: item.sport, startsAt: item.startsAt, suburb: item.suburb,
        label: item.joinStatus === 'hosting' ? 'Hosting' : 'Going',
      })))
      setOthers(feed.filter((item) => !myIds.has(item.id)).slice(0, 20).map((item) => ({
        id: item.id, title: item.title, sport: item.sport, startsAt: item.startsAt, suburb: item.suburb, label: '',
      })))
    })
    return () => { active = false }
  }, [])

  const row = (option: Option) => (
    <button type="button" key={option.id} className="more-choice-row explore-sport-row" onClick={() => onPick(option.id)}>
      <span className="explore-sport-icon"><SportIcon sport={option.sport} /></span>
      <span className="grow">
        <strong>{option.title}</strong>
        <small>{formatActivityDate(option.startsAt, {}, option.suburb)}{option.label ? ` · ${option.label}` : ''}</small>
      </span>
    </button>
  )

  return (
    <SidePanel title="Share an activity" onClose={onClose}>
      {mine === null ? (
        <p className="more-settings-note" role="status">Loading activities…</p>
      ) : (
        <>
          <h3 className="more-settings-subtitle">Your plans</h3>
          {mine.length ? <div className="more-setting-list">{mine.map(row)}</div> : <p className="more-settings-note">No upcoming plans.</p>}
          {others.length > 0 && (
            <>
              <h3 className="more-settings-subtitle">Coming up</h3>
              <div className="more-setting-list">{others.map(row)}</div>
            </>
          )}
        </>
      )}
    </SidePanel>
  )
}
