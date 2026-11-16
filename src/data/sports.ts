// THE list of sports. To add a sport, add one line here.
//
// Everything else follows from this list:
// - Onboarding, Edit my sports, Create activity and all filters show it.
// - The Supabase "sports" table gets it automatically the next time someone
//   opens one of those screens (see ensureSportsInDatabase in lib/sportCatalog.ts).
// - The build stops with an error until the sport also has its Create activity
//   fields (CreateActivityScreen.tsx), patches (sportPatches.ts) and
//   personal records (prTypes.ts), so a half-finished sport never goes live.
//
// icon: a key from components/sportIcons.ts. verb: used in "You both ...".

export const sports = [
  { name: 'Running', icon: 'footprints', verb: 'run', water: false },
  { name: 'Hiking', icon: 'mountain', verb: 'hike', water: false },
  { name: 'Spearfishing', icon: 'fish', verb: 'spearfish', water: true },
  { name: 'Freediving', icon: 'shell', verb: 'freedive', water: true },
  { name: 'Kitesurfing', icon: 'wind', verb: 'kitesurf', water: true },
  { name: 'Surfing', icon: 'waves', verb: 'surf', water: true },
  { name: 'Swimming', icon: 'waves', verb: 'swim', water: true },
  { name: 'Gym', icon: 'dumbbell', verb: 'lift', water: false },
  { name: 'Mountain biking', icon: 'bike', verb: 'ride MTB', water: false },
  { name: 'Road cycling', icon: 'bike', verb: 'ride the road', water: false },
  { name: 'SUP / kayak', icon: 'sailboat', verb: 'paddle', water: true },
  { name: 'Scuba diving', icon: 'anchor', verb: 'dive', water: true },
  { name: 'Climbing / bouldering', icon: 'mountain-snow', verb: 'climb', water: false },
] as const

export type SportName = (typeof sports)[number]['name']

export const sportNames: SportName[] = sports.map((sport) => sport.name)

export const waterSportNames: string[] = sports.filter((sport) => sport.water).map((sport) => sport.name)

export const sportVerbs: Record<string, string> = Object.fromEntries(sports.map((sport) => [sport.name, sport.verb]))

// "Open activity" is not a sport you pick for your profile, but it is a choice in Create activity.
export const openActivity = { name: 'Open activity', icon: 'plus' } as const

// Icons of sports an admin added in the app (the "icon" column in Supabase).
const customSportIcons = new Map<string, string>()
export function registerSportIcons(entries: Array<{ name: string; icon: string | null }>) {
  for (const entry of entries) if (entry.icon) customSportIcons.set(entry.name, entry.icon)
}

export function getSportIconKey(name: string) {
  return sports.find((sport) => sport.name === name)?.icon
    ?? customSportIcons.get(name)
    ?? (name === openActivity.name ? openActivity.icon : 'plus')
}
