import { BellRing, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MorePageHeader } from '../components/MorePageHeader'
import { ListSkeleton } from '../components/Skeleton'
import { SportIcon } from '../components/SportIcon'
import { roundCoordinates, useLocationPreference } from '../lib/distance'
import { useBackToMore } from '../lib/moreNavigation'
import { isMissingDatabaseFeature } from '../lib/notifications'
import { usePremium } from '../lib/premium'
import { supabase } from '../lib/supabase'
import { useSportCatalog } from '../lib/useSportCatalog'

type Alert = {
  id: string
  sport: string | null
  place_label: string
  radius_km: number | null
  weekend_only: boolean
}

const radiusOptions = [5, 10, 25, 50, 100]

// Pro: get a notification as soon as a matching activity is posted.
export function SmartAlertsScreen() {
  const backToMore = useBackToMore()
  const premium = usePremium()
  const sports = useSportCatalog()
  const location = useLocationPreference()
  const [alerts, setAlerts] = useState<Alert[] | null>(null)
  const [sport, setSport] = useState('')
  const [radius, setRadius] = useState<number | null>(25)
  const [weekendOnly, setWeekendOnly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function showError(problem: unknown, fallback: string) {
    setError(isMissingDatabaseFeature(problem)
      ? 'This needs a database update (SQL 33) before it works.'
      : typeof problem === 'object' && problem !== null && 'message' in problem ? String((problem as { message: unknown }).message) : fallback)
  }

  async function load() {
    if (!supabase) return
    const { data, error: loadError } = await supabase
      .from('activity_alerts')
      .select('id, sport, place_label, radius_km, weekend_only')
      .order('created_at')
    if (loadError) {
      showError(loadError, 'Unable to load your alerts.')
      setAlerts([])
    } else {
      setAlerts(data as Alert[])
    }
  }

  useEffect(() => { void load() }, [])

  async function add() {
    if (!supabase) return
    setBusy(true)
    setError('')
    const point = location && radius !== null ? roundCoordinates(location) : null
    const { error: insertError } = await supabase.from('activity_alerts').insert({
      sport: sport || null,
      latitude: point?.latitude ?? null,
      longitude: point?.longitude ?? null,
      place_label: point ? location?.label ?? '' : '',
      radius_km: point ? radius : null,
      weekend_only: weekendOnly,
    })
    setBusy(false)
    if (insertError) {
      showError(insertError, 'Unable to save this alert.')
      return
    }
    await load()
  }

  async function remove(alert: Alert) {
    if (!supabase) return
    const { error: deleteError } = await supabase.from('activity_alerts').delete().eq('id', alert.id)
    if (deleteError) showError(deleteError, 'Unable to remove this alert.')
    else await load()
  }

  function describe(alert: Alert) {
    const what = alert.sport ?? 'Any sport'
    const where = alert.radius_km ? `within ${alert.radius_km} km of ${alert.place_label || 'your spot'}` : 'anywhere'
    return `${what}, ${where}${alert.weekend_only ? ', weekends only' : ''}`
  }

  if (!premium) {
    return (
      <main className="screen more-settings-page">
        <MorePageHeader title="Smart alerts" eyebrow="Pro" onBack={backToMore} />
        <p className="more-settings-intro">Smart alerts are part of Pro. Coming soon.</p>
      </main>
    )
  }

  return (
    <main className="screen more-settings-page">
      <MorePageHeader title="Smart alerts" eyebrow="Pro" onBack={backToMore} />
      <p className="more-settings-intro">Get a notification the moment a matching activity is posted. Up to 10 alerts.</p>
      {error && <p className="edit-form-error" role="alert">{error}</p>}

      <h3 className="more-settings-subtitle">New alert</h3>
      <form className="sport-admin-form" onSubmit={(event) => { event.preventDefault(); void add() }}>
        <label className="edit-field"><span>Sport</span>
          <select className="alert-select" value={sport} onChange={(event) => setSport(event.target.value)}>
            <option value="">Any sport</option>
            {sports.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
        <label className="edit-field"><span>Distance{location ? ` from ${location.label}` : ''}</span>
          <select className="alert-select" value={radius ?? 'any'} onChange={(event) => setRadius(event.target.value === 'any' ? null : Number(event.target.value))}>
            {location && radiusOptions.map((km) => <option key={km} value={km}>Within {km} km</option>)}
            <option value="any">Anywhere</option>
          </select>
        </label>
        {!location && <p className="more-settings-note">Set your location on Home (top left) to get alerts close to you.</p>}
        <label className="more-setting-row alert-toggle">
          <span>Weekends only</span>
          <input type="checkbox" role="switch" checked={weekendOnly} onChange={() => setWeekendOnly((value) => !value)} />
        </label>
        <button type="submit" className="button button-primary button-md" disabled={busy}>{busy ? 'Saving…' : 'Add alert'}</button>
      </form>

      <h3 className="more-settings-subtitle">Your alerts</h3>
      {alerts === null ? (
        <ListSkeleton rows={2} label="Loading alerts" />
      ) : alerts.length === 0 ? (
        <p className="more-settings-note">No alerts yet.</p>
      ) : (
        <div className="more-setting-list">
          {alerts.map((alert) => (
            <div className="more-setting-row" key={alert.id}>
              <span className="sport-admin-name">
                {alert.sport ? <SportIcon sport={alert.sport} /> : <BellRing aria-hidden="true" />}
                {describe(alert)}
              </span>
              <button type="button" className="icon-button" aria-label="Remove alert" onClick={() => void remove(alert)}>
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
