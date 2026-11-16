import { Plus, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { MorePageHeader } from '../components/MorePageHeader'
import { ListSkeleton } from '../components/Skeleton'
import { createCrew, deleteCrew, getMyCrews, inviteToCrew, removeCrewMember, respondToCrewInvite, type Crew } from '../lib/crews'
import { getMyFriendships } from '../lib/friendships'
import { useBackToMore } from '../lib/moreNavigation'
import { isMissingDatabaseFeature } from '../lib/notifications'
import { usePremium } from '../lib/premium'
import { useViewerProfile } from '../lib/viewerProfile'

type Friend = { id: string; name: string; photoUrl: string | null }

// Pro: your crews. Invite friends; post activities only your crew can see.
export function CrewsScreen() {
  const backToMore = useBackToMore()
  const premium = usePremium()
  const viewer = useViewerProfile()
  const me = viewer.status === 'ready' ? viewer.profile?.id ?? null : null
  const [crews, setCrews] = useState<Crew[] | null>(null)
  const [friends, setFriends] = useState<Friend[]>([])
  const [newName, setNewName] = useState('')
  const [inviteFor, setInviteFor] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  function showError(problem: unknown) {
    setError(isMissingDatabaseFeature(problem)
      ? 'This needs a database update (SQL 38) before it works.'
      : typeof problem === 'object' && problem !== null && 'message' in problem ? String((problem as { message: unknown }).message) : 'Something went wrong.')
  }

  async function load() {
    try {
      setCrews(await getMyCrews())
    } catch (problem) {
      showError(problem)
      setCrews([])
    }
  }

  useEffect(() => {
    void load()
    void getMyFriendships().then((result) => {
      setFriends((result?.friends ?? []).flatMap((friend) => friend.id ? [{ id: friend.id, name: friend.name, photoUrl: friend.photoUrl ?? null }] : []))
    }).catch(() => undefined)
  }, [])

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(success)
      await load()
    } catch (problem) {
      showError(problem)
    } finally {
      setBusy(false)
    }
  }

  const invites = (crews ?? []).filter((crew) => crew.myStatus === 'invited')
  const mine = (crews ?? []).filter((crew) => crew.myStatus === 'accepted')

  return (
    <main className="screen more-settings-page">
      <MorePageHeader title="Crews" eyebrow="Pro" onBack={backToMore} />
      <p className="more-settings-intro">
        A crew is your fixed group of mates. Post an activity for your crew only: nobody else sees it.
      </p>
      {notice && <p className="activity-share-feedback" role="status">{notice}</p>}
      {error && <p className="edit-form-error" role="alert">{error}</p>}

      {invites.length > 0 && (
        <>
          <h3 className="more-settings-subtitle">Invites</h3>
          <div className="team-list">
            {invites.map((crew) => (
              <div className="team-row" key={crew.id}>
                <span className="grow"><strong>{crew.name}</strong><small>{crew.members.filter((member) => member.status === 'accepted').length} members</small></span>
                <button type="button" className="text-action" disabled={busy} onClick={() => void run(() => respondToCrewInvite(crew.id, false), 'Invite declined.')}>Decline</button>
                <button type="button" className="button button-primary button-sm" disabled={busy} onClick={() => void run(() => respondToCrewInvite(crew.id, true), `You joined ${crew.name}.`)}>Join</button>
              </div>
            ))}
          </div>
        </>
      )}

      {premium && (
        <form className="spot-add" onSubmit={(event) => {
          event.preventDefault()
          const name = newName.trim()
          if (name.length < 2) return
          setNewName('')
          void run(() => createCrew(name), `${name} created. Invite your mates.`)
        }}>
          <input value={newName} maxLength={40} onChange={(event) => setNewName(event.target.value)} placeholder="New crew, for example Saturday divers" />
          <button type="submit" className="button button-primary button-md" disabled={busy || newName.trim().length < 2}><Plus aria-hidden="true" /> Create</button>
        </form>
      )}
      {!premium && <p className="more-settings-note">Starting a crew is part of Pro. You can still join crews you are invited to.</p>}

      {crews === null ? (
        <ListSkeleton rows={2} label="Loading crews" />
      ) : mine.length === 0 ? (
        <p className="more-settings-note">No crews yet.</p>
      ) : (
        mine.map((crew) => {
          const isOwner = crew.ownerId === me
          const memberIds = new Set(crew.members.map((member) => member.userId))
          const invitable = friends.filter((friend) => !memberIds.has(friend.id))
          return (
            <section className="crew-card" key={crew.id}>
              <div className="crew-card-head">
                <h3>{crew.name}</h3>
                {isOwner ? (
                  <button type="button" className="icon-button" aria-label={`Delete ${crew.name}`} onClick={() => {
                    if (window.confirm(`Delete ${crew.name}? Activities posted for this crew are deleted too.`)) void run(() => deleteCrew(crew.id), 'Crew deleted.')
                  }}>
                    <Trash2 aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" className="text-action" onClick={() => {
                    if (me && window.confirm(`Leave ${crew.name}?`)) void run(() => removeCrewMember(crew.id, me), 'You left the crew.')
                  }}>Leave</button>
                )}
              </div>
              <div className="team-list">
                {crew.members.map((member) => (
                  <div className="team-row" key={member.userId}>
                    <Avatar name={member.name} photoUrl={member.photoUrl} size={32} />
                    <span className="grow">
                      <strong>{member.name}</strong>
                      <small>{member.userId === crew.ownerId ? 'Owner' : member.status === 'invited' ? 'Invited' : 'Member'}</small>
                    </span>
                    {isOwner && member.userId !== crew.ownerId && (
                      <button type="button" className="text-action" disabled={busy} onClick={() => void run(() => removeCrewMember(crew.id, member.userId), `${member.name} removed.`)}>Remove</button>
                    )}
                  </div>
                ))}
              </div>
              {isOwner && (
                inviteFor === crew.id ? (
                  invitable.length === 0 ? (
                    <p className="more-settings-note">All your friends are in this crew. Only friends can be invited.</p>
                  ) : (
                    <div className="team-list">
                      {invitable.map((friend) => (
                        <div className="team-row" key={friend.id}>
                          <Avatar name={friend.name} photoUrl={friend.photoUrl} size={32} />
                          <span className="grow"><strong>{friend.name}</strong></span>
                          <button type="button" className="button button-secondary button-sm" disabled={busy} onClick={() => void run(() => inviteToCrew(crew.id, friend.id), `${friend.name} invited.`)}>Invite</button>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <button type="button" className="button button-secondary button-md" onClick={() => setInviteFor(crew.id)}>
                    <UserPlus aria-hidden="true" /> Invite friends
                  </button>
                )
              )}
            </section>
          )
        })
      )}
    </main>
  )
}
