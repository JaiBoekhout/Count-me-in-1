import { useEffect, useState } from 'react'
import { MorePageHeader } from '../components/MorePageHeader'
import { ListSkeleton } from '../components/Skeleton'
import { useBackToMore } from '../lib/moreNavigation'
import { isMissingDatabaseFeature } from '../lib/notifications'
import { supabase } from '../lib/supabase'

type Row = { label: string; members: number }

// Admin only: how many members, how many new, and how they found the app.
export function InsightsScreen() {
  const backToMore = useBackToMore()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!supabase) return
    void Promise.resolve(supabase.rpc('admin_insights')).then(({ data, error: loadError }) => {
      if (loadError) {
        setError(isMissingDatabaseFeature(loadError)
          ? 'This needs a database update (SQL 39) before it works.'
          : loadError.message)
        setRows([])
      } else {
        setRows((data ?? []) as Row[])
      }
    })
  }, [])

  const value = (label: string) => rows?.find((row) => row.label === label)?.members ?? 0
  const sources = (rows ?? [])
    .filter((row) => row.label.startsWith('source:'))
    .map((row) => ({ name: row.label.slice(7), members: row.members }))
    .sort((left, right) => right.members - left.members)
  const total = value('total')

  return (
    <main className="screen more-settings-page">
      <MorePageHeader title="Insights" eyebrow="Admin" onBack={backToMore} />
      {error && <p className="edit-form-error" role="alert">{error}</p>}
      {rows === null ? (
        <ListSkeleton rows={4} label="Loading insights" />
      ) : (
        <>
          <div className="year-grid">
            <div className="year-tile"><strong>{total}</strong><span>members</span></div>
            <div className="year-tile"><strong>{value('new_7_days')}</strong><span>new this week</span></div>
            <div className="year-tile"><strong>{value('new_30_days')}</strong><span>new in 30 days</span></div>
          </div>
          <h3 className="more-settings-subtitle">How they found us</h3>
          {sources.length === 0 ? (
            <p className="more-settings-note">No answers yet.</p>
          ) : (
            <div className="more-setting-list">
              {sources.map((source) => (
                <div className="more-setting-row insight-row" key={source.name}>
                  <span>{source.name}</span>
                  <span className="insight-bar" aria-hidden="true">
                    <span style={{ width: `${total ? Math.round((source.members / total) * 100) : 0}%` }} />
                  </span>
                  <strong>{source.members}</strong>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
