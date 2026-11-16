import { supabase } from './supabase'

// Pro: private crews (fixed groups of mates) and crew-only activities.
export type CrewMember = { userId: string; name: string; photoUrl: string | null; status: 'invited' | 'accepted' }
export type Crew = { id: string; name: string; ownerId: string; members: CrewMember[]; myStatus: 'invited' | 'accepted' | null }

function client() {
  if (!supabase) throw new Error('Supabase is not configured yet.')
  return supabase
}

export async function getMyCrews(): Promise<Crew[]> {
  const db = client()
  const { data: session } = await db.auth.getSession()
  const me = session.session?.user.id
  if (!me) return []
  const { data: crews, error } = await db.from('crews').select('id, name, owner_id').order('created_at')
  if (error) throw error
  if (!crews?.length) return []
  const { data: members, error: membersError } = await db
    .from('crew_members')
    .select('crew_id, user_id, status')
    .in('crew_id', crews.map((crew) => crew.id))
  if (membersError) throw membersError
  const ids = [...new Set((members ?? []).map((member) => member.user_id as string))]
  const { data: profiles } = ids.length ? await db.from('profiles').select('id, first_name, photo_url').in('id', ids) : { data: [] }
  const byId = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]))
  return crews.map((crew) => {
    const crewMembers = (members ?? []).filter((member) => member.crew_id === crew.id).map((member) => ({
      userId: member.user_id as string,
      name: (byId.get(member.user_id)?.first_name as string | undefined) ?? 'Member',
      photoUrl: (byId.get(member.user_id)?.photo_url as string | null | undefined) ?? null,
      status: member.status as CrewMember['status'],
    }))
    return {
      id: crew.id, name: crew.name, ownerId: crew.owner_id, members: crewMembers,
      myStatus: crewMembers.find((member) => member.userId === me)?.status ?? null,
    }
  })
}

export async function createCrew(name: string) {
  const { error } = await client().from('crews').insert({ name: name.trim() })
  if (error) throw error
}

export async function inviteToCrew(crewId: string, userId: string) {
  const { error } = await client().rpc('invite_to_crew', { target_crew_id: crewId, target_user_id: userId })
  if (error) throw error
}

export async function respondToCrewInvite(crewId: string, accept: boolean) {
  const { error } = await client().rpc('respond_to_crew_invite', { target_crew_id: crewId, accept })
  if (error) throw error
}

export async function removeCrewMember(crewId: string, userId: string) {
  const { error } = await client().from('crew_members').delete().eq('crew_id', crewId).eq('user_id', userId)
  if (error) throw error
}

export async function deleteCrew(crewId: string) {
  const { error } = await client().from('crews').delete().eq('id', crewId)
  if (error) throw error
}

// Crews you can post an activity for (accepted member).
export async function getPostableCrews() {
  try {
    return (await getMyCrews()).filter((crew) => crew.myStatus === 'accepted')
  } catch {
    return []
  }
}
