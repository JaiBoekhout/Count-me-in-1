import { Eye, MapPin, Phone, ShieldAlert, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

export const safetyTips = [
  { icon: MapPin, title: 'Meet in a public place', body: 'A car park, beach access or café. Not someone’s home for a first meetup.' },
  { icon: Users, title: 'Tell someone your plans', body: 'Let a mate or partner know where you are going and when you expect to be back.' },
  { icon: ShieldAlert, title: 'Know your limits', body: 'Check the conditions and your gear. Say so if a plan is above your level.' },
  { icon: Eye, title: 'Trust your gut', body: 'Something feels off? You can always leave, and report or block in the app.' },
  { icon: Phone, title: 'Emergency? Call 000', body: 'In the water or on a trail: 000, or 112 from a mobile without coverage.' },
]

export function SafetyTipList() {
  return (
    <ul className="safety-tips">
      {safetyTips.map(({ icon: Icon, title, body }) => (
        <li key={title}>
          <span className="safety-tip-icon"><Icon aria-hidden="true" /></span>
          <span><strong>{title}</strong><small>{body}</small></span>
        </li>
      ))}
    </ul>
  )
}

const seenKey = 'count-me-in-safety-tips-seen-v1'

// Shown once, the first time you are going to (or hosting) an activity.
export function SafetyTipsOnce({ show }: { show: boolean }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!show) return
    try {
      if (window.localStorage.getItem(seenKey)) return
      setOpen(true)
    } catch {
      // Storage blocked: skip.
    }
  }, [show])
  if (!open) return null
  function close() {
    try { window.localStorage.setItem(seenKey, '1') } catch { /* ignore */ }
    setOpen(false)
  }
  return (
    <div className="patch-celebration" role="dialog" aria-modal="true" aria-labelledby="safety-title">
      <div className="patch-celebration-card safety-card">
        <p className="eyebrow">Before you head out</p>
        <h2 id="safety-title">Meet up safely</h2>
        <SafetyTipList />
        <button type="button" className="button button-primary button-lg" onClick={close}>Got it</button>
      </div>
    </div>
  )
}
