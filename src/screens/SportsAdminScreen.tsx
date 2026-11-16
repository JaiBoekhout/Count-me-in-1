import { Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MorePageHeader } from '../components/MorePageHeader'
import { ListSkeleton } from '../components/Skeleton'
import { sportIconsByKey } from '../components/sportIcons'
import { sportNames } from '../data/sports'
import { getCurrentModerationRole } from '../lib/moderation'
import { useBackToMore } from '../lib/moreNavigation'
import { ensureSportsInDatabase } from '../lib/sportCatalog'
import { supabase } from '../lib/supabase'
import { refreshSportCatalog } from '../lib/useSportCatalog'

type SportRow = { id: number; name: string; icon: string | null }
const iconKeys = Object.keys(sportIconsByKey).filter((key) => key !== 'plus')

// Admin only: add a sport without code. New sports show up in Edit my sports,
// onboarding, Create activity and all filters. They have no special activity
// fields, patches or PR types (those still need a developer).
export function SportsAdminScreen() {
  const backToMore = useBackToMore()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [rows, setRows] = useState<SportRow[] | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('trophy')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadRows() {
    if (!supabase) return
    const { data, error: loadError } = await supabase.from('sports').select('id, name, icon').order('name')
    if (loadError) setError(loadError.message)
    else setRows(data as SportRow[])
  }

  useEffect(() => {
    let active = true
    getCurrentModerationRole()
      .then(async (role) => {
        if (!active) return
        setIsAdmin(role === 'admin')
        if (role === 'admin') {
          await ensureSportsInDatabase()
          if (active) await loadRows()
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setIsAdmin(false)
          setError(loadError instanceof Error ? loadError.message : 'Unable to load sports.')
        }
      })
    return () => { active = false }
  }, [])

  async function addSport() {
    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (!supabase || !trimmed) return
    if (rows?.some((row) => row.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`${trimmed} is already in the list.`)
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    const { error: insertError } = await supabase.from('sports').insert({ name: trimmed, icon })
    setBusy(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setName('')
    setNotice(`${trimmed} added. Members can now pick it.`)
    await Promise.all([loadRows(), refreshSportCatalog()])
  }

  async function changeIcon(row: SportRow, nextIcon: string) {
    if (!supabase) return
    setError('')
    const { error: updateError } = await supabase.from('sports').update({ icon: nextIcon }).eq('id', row.id)
    if (updateError) {
      setError(updateError.message.includes('permission') || updateError.code === '42501'
        ? 'This needs a database update (SQL 30) before icons can be changed.'
        : updateError.message)
      return
    }
    await Promise.all([loadRows(), refreshSportCatalog()])
  }

  async function removeSport(row: SportRow) {
    if (!supabase) return
    if (!window.confirm(`Remove ${row.name}? This only works when no member or activity uses it.`)) return
    setError('')
    setNotice('')
    const { error: deleteError, count } = await supabase.from('sports').delete({ count: 'exact' }).eq('id', row.id)
    if (deleteError) {
      setError(deleteError.code === '23503'
        ? `${row.name} is used by members or activities, so it cannot be removed.`
        : deleteError.message)
      return
    }
    if (count === 0) {
      setError('This needs a database update (SQL 30) before sports can be removed.')
      return
    }
    setNotice(`${row.name} removed.`)
    await Promise.all([loadRows(), refreshSportCatalog()])
  }

  return (
    <main className="screen more-settings-page">
      <MorePageHeader title="Sports" eyebrow="Admin" onBack={backToMore} />
      {isAdmin === null ? (
        <ListSkeleton rows={4} label="Loading" />
      ) : !isAdmin ? (
        <p className="more-settings-note">Only admins can manage sports.</p>
      ) : (
        <>
          <p className="more-settings-intro">
            Add a sport and members can pick it straight away, in their profile and when they create an activity.
          </p>
          {notice && <p className="activity-share-feedback" role="status">{notice}</p>}
          {error && <p className="edit-form-error" role="alert">{error}</p>}

          <h3 className="more-settings-subtitle">Add a sport</h3>
          <form
            className="sport-admin-form"
            onSubmit={(event) => {
              event.preventDefault()
              void addSport()
            }}
          >
            <label className="edit-field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="For example, Fishing" maxLength={40} />
            </label>
            <div>
              <span className="sport-admin-label">Icon</span>
              <div className="sport-icon-picker" role="radiogroup" aria-label="Icon">
                {iconKeys.map((key) => {
                  const Icon = sportIconsByKey[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={icon === key}
                      aria-label={key}
                      className={icon === key ? 'selected' : ''}
                      onClick={() => setIcon(key)}
                    >
                      <Icon aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            </div>
            <button type="submit" className="button button-primary button-md" disabled={busy || !name.trim()}>
              {busy ? 'Adding…' : 'Add sport'}
            </button>
          </form>

          <h3 className="more-settings-subtitle">All sports</h3>
          {rows === null ? (
            <ListSkeleton rows={5} label="Loading sports" />
          ) : (
            <div className="more-setting-list">
              {rows.map((row) => {
                const Icon = sportIconsByKey[row.icon ?? ''] ?? sportIconsByKey.plus
                const builtIn = (sportNames as string[]).includes(row.name)
                return (
                  <div className="more-setting-row sport-admin-row" key={row.id}>
                    <span className="sport-admin-name"><Icon aria-hidden="true" />{row.name}</span>
                    {builtIn ? (
                      <small className="more-setting-hint">Built in</small>
                    ) : (
                      <span className="sport-admin-actions">
                        <select value={row.icon ?? 'plus'} aria-label={`Icon for ${row.name}`} onChange={(event) => void changeIcon(row, event.target.value)}>
                          {iconKeys.map((key) => <option key={key} value={key}>{key}</option>)}
                        </select>
                        <button type="button" className="icon-button" aria-label={`Remove ${row.name}`} onClick={() => void removeSport(row)}>
                          <Trash2 aria-hidden="true" />
                        </button>
                      </span>
                    )}
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
