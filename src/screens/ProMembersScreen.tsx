import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { MorePageHeader } from '../components/MorePageHeader'
import { ListSkeleton } from '../components/Skeleton'
import { getCurrentModerationRole, searchMembersByName } from '../lib/moderation'
import { useBackToMore } from '../lib/moreNavigation'
import { isMissingDatabaseFeature } from '../lib/notifications'
import { supabase } from '../lib/supabase'

type ProRow = {
  grant_id: string; user_id: string; first_name: string; photo_url: string | null
  reason: 'gift' | 'referral' | 'paid'; starts_at: string; ends_at: string; note: string; active: boolean
}
type SearchResult = Awaited<ReturnType<typeof searchMembersByName>>[number]

const durations = [
  { label: '1 month', months: 1 },
  { label: '3 months', months: 3 },
  { label: '1 year', months: 12 },
  { label: '5 years', months: 60 },
]
const reasonLabels: Record<ProRow['reason'], string> = { gift: 'Given by admin', referral: 'Invite challenge', paid: 'Paid' }

function dateIn(months: number) {
  const date = new Date()
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Admin only: give members Pro, see who has it, and end it.
export function ProMembersScreen() {
  const backToMore = useBackToMore()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [rows, setRows] = useState<ProRow[] | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [months, setMonths] = useState(12)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function showError(problem: unknown) {
    setError(isMissingDatabaseFeature(problem)
      ? 'This needs a database update (SQL 37) before it works.'
      : typeof problem === 'object' && problem !== null && 'message' in problem ? String((problem as { message: unknown }).message) : 'Something went wrong.')
  }

  async function load() {
    if (!supabase) return
    const { data, error: loadError } = await supabase.rpc('admin_pro_members')
    if (loadError) {
      showError(loadError)
      setRows([])
    } else {
      setRows((data ?? []) as ProRow[])
    }
  }

  useEffect(() => {
    getCurrentModerationRole()
      .then((role) => {
        setIsAdmin(role === 'admin')
        if (role === 'admin') void load()
      })
      .catch(() => setIsAdmin(false))
  }, [])

  useEffect(() => {
    const text = query.trim()
    if (text.length < 2) {
      setResults([])
      return
    }
    let active = true
    const timer = window.setTimeout(() => {
      void searchMembersByName(text).then((found) => { if (active) setResults(found) }).catch(() => undefined)
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [query])

  async function give() {
    if (!supabase || !selected) return
    setBusy(true)
    setError('')
    setNotice('')
    const { error: grantError } = await supabase.rpc('admin_grant_pro', {
      target_user_id: selected.id,
      until_date: dateIn(months),
      grant_note: note.trim(),
    })
    setBusy(false)
    if (grantError) {
      showError(grantError)
      return
    }
    setNotice(`${selected.name} has Pro until ${formatDate(dateIn(months))}.`)
    setSelected(null)
    setQuery('')
    setNote('')
    await load()
  }

  async function end(row: ProRow) {
    if (!supabase || !window.confirm(`End Pro for ${row.first_name} now?`)) return
    setError('')
    const { error: endError } = await supabase.rpc('admin_end_pro', { grant_id: row.grant_id })
    if (endError) showError(endError)
    else {
      setNotice(`Pro ended for ${row.first_name}.`)
      await load()
    }
  }

  const active = (rows ?? []).filter((row) => row.active)
  const ended = (rows ?? []).filter((row) => !row.active)

  return (
    <main className="screen more-settings-page">
      <MorePageHeader title="Pro members" eyebrow="Admin" onBack={backToMore} />
      {isAdmin === null ? (
        <ListSkeleton rows={3} label="Loading" />
      ) : !isAdmin ? (
        <p className="more-settings-note">Only admins can manage Pro.</p>
      ) : (
        <>
          <p className="more-settings-intro">
            Give a member Pro, for example as a thank-you or to let him test. Admins and moderators always have Pro.
          </p>
          {notice && <p className="activity-share-feedback" role="status">{notice}</p>}
          {error && <p className="edit-form-error" role="alert">{error}</p>}

          <h3 className="more-settings-subtitle">Give Pro</h3>
          {!selected ? (
            <>
              <label className="explore-search">
                <Search aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a member by name" aria-label="Search a member by name" />
              </label>
              {results.length > 0 && (
                <div className="team-list">
                  {results.map((member) => (
                    <button type="button" className="team-row pro-pick" key={member.id} onClick={() => setSelected(member)}>
                      <Avatar name={member.name} photoUrl={member.photoUrl} size={36} />
                      <span className="grow"><strong>{member.name}</strong><small>{member.suburb}</small></span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <form className="sport-admin-form" onSubmit={(event) => { event.preventDefault(); void give() }}>
              <div className="team-row">
                <Avatar name={selected.name} photoUrl={selected.photoUrl} size={36} />
                <span className="grow"><strong>{selected.name}</strong><small>{selected.suburb}</small></span>
                <button type="button" className="text-action" onClick={() => setSelected(null)}>Change</button>
              </div>
              <div className="choice-chips">
                {durations.map((option) => (
                  <button
                    type="button"
                    key={option.months}
                    className={`choice-chip ${months === option.months ? 'selected' : ''}`}
                    aria-pressed={months === option.months}
                    onClick={() => setMonths(option.months)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <label className="edit-field"><span>Note (only admins see this)</span>
                <input value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="For example, beta tester" />
              </label>
              <button type="submit" className="button button-primary button-md" disabled={busy}>
                {busy ? 'Saving…' : `Give Pro until ${formatDate(dateIn(months))}`}
              </button>
            </form>
          )}

          <h3 className="more-settings-subtitle">Has Pro now ({active.length})</h3>
          {rows === null ? (
            <ListSkeleton rows={2} label="Loading Pro members" />
          ) : active.length === 0 ? (
            <p className="more-settings-note">Nobody has Pro yet (apart from the team).</p>
          ) : (
            <div className="team-list">
              {active.map((row) => (
                <div className="team-row" key={row.grant_id}>
                  <Avatar name={row.first_name} photoUrl={row.photo_url} size={36} />
                  <span className="grow">
                    <strong>{row.first_name}</strong>
                    <small>{reasonLabels[row.reason]} · until {formatDate(row.ends_at)}{row.note ? ` · ${row.note}` : ''}</small>
                  </span>
                  <button type="button" className="text-action" onClick={() => void end(row)}>End</button>
                </div>
              ))}
            </div>
          )}

          {ended.length > 0 && (
            <>
              <h3 className="more-settings-subtitle">Ended recently</h3>
              <div className="team-list">
                {ended.map((row) => (
                  <div className="team-row" key={row.grant_id}>
                    <Avatar name={row.first_name} photoUrl={row.photo_url} size={36} />
                    <span className="grow">
                      <strong>{row.first_name}</strong>
                      <small>{reasonLabels[row.reason]} · ended {formatDate(row.ends_at)}</small>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}
