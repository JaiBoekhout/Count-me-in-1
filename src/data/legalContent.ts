// First drafts of the legal pages. Have them checked by someone with legal
// knowledge before Count Me In goes public (see docs/todo-livegang.md).

export type LegalPage = { title: string; updated: string; intro: string; sections: Array<{ heading: string; paragraphs: string[] }> }

const contact = 'count.me.in.aus@gmail.com'
const updated = '16 November 2026'

export const legalPages: Record<'privacy' | 'terms' | 'guidelines', LegalPage> = {
  privacy: {
    title: 'Privacy policy',
    updated,
    intro: 'Count Me In helps men in Australia find mates for sport and outdoor activities. This policy explains what we keep about you, why, and what you can do about it. We follow the Australian Privacy Principles.',
    sections: [
      { heading: 'What we keep', paragraphs: [
        'Account: your email address and a password (stored encrypted by our login provider).',
        'Profile: first name, date of birth (we show your age, not the date), suburb, photo, bio, sports and levels, when you are usually free, and optional extras such as a cover photo and favourite spots.',
        'Activity data: activities you post or join, chat messages, check-ins, patches, personal records with proof photos, friendships, reports and blocks.',
        'Location: only when you allow it. Others see your rounded location (about 1 km), never your exact spot. Map pins on activities are shown to members.',
        'Device: if you turn on notifications, a push address for your phone or browser.',
      ] },
      { heading: 'Why we keep it', paragraphs: [
        'To run the app: show activities and members near you, let you join, chat and check in, and send the notifications you asked for.',
        'To keep members safe: handle reports, blocks and moderation.',
        'We do not sell your data, show ads based on it, or share it with others for marketing.',
      ] },
      { heading: 'Who processes it for us', paragraphs: [
        'Supabase (database, login, file storage), Vercel (hosting the app), Google Gmail (sending login and confirmation emails), the push services of Google, Apple and Mozilla (notifications), and OpenStreetMap (turning a map pin into an address when you pick one). Some of these services store data outside Australia.',
      ] },
      { heading: 'Who can see what', paragraphs: [
        'Signed-in members can see your profile, the activities you post or join, and your patches and personal records. Group chats are visible to the members of that activity. Admins and moderators can see reported content to keep the community safe.',
      ] },
      { heading: 'How long we keep it', paragraphs: [
        'As long as you have an account. When you delete your account (More > Privacy and safety > Delete my account) we delete your profile, photos and everything linked to it straight away. Backups are overwritten within 30 days.',
      ] },
      { heading: 'Your choices', paragraphs: [
        'You can edit your profile, switch off notifications and location, block members, and delete your account at any time. To ask what we keep about you, or to correct it, email ' + contact + '.',
        'If you are unhappy with how we handled your data, tell us first. You can also contact the Office of the Australian Information Commissioner (oaic.gov.au).',
      ] },
    ],
  },
  terms: {
    title: 'Terms of use',
    updated,
    intro: 'By creating an account you agree to these terms. They are short on purpose.',
    sections: [
      { heading: 'Who can join', paragraphs: [
        'Count Me In is for men aged 18 or older. One account per person, with your real first name and your own photo.',
      ] },
      { heading: 'Meeting up is your own responsibility', paragraphs: [
        'Count Me In helps you find people; it does not organise, check or supervise activities. Outdoor sports carry risks. Know your limits, check the conditions, bring the right gear and follow local rules (for example no spearfishing in aquatic reserves). Members are not checked by us, so use the safety tips and your own judgement.',
      ] },
      { heading: 'Your content', paragraphs: [
        'You keep the rights to what you post (photos, stories, messages). You allow us to show it in the app to other members. Do not post anything you do not have the right to share.',
      ] },
      { heading: 'Behaviour', paragraphs: [
        'Follow the community guidelines. We may remove content, hide activities or close accounts that break them, without notice when someone could get hurt.',
      ] },
      { heading: 'The app', paragraphs: [
        'We do our best to keep Count Me In working, but it is provided as it is, without guarantees. To the extent the law allows, we are not liable for loss or injury from using the app or meeting other members. Nothing in these terms limits your rights under the Australian Consumer Law.',
        'We may change these terms; we will tell you in the app when we do. Questions: ' + contact + '.',
      ] },
    ],
  },
  guidelines: {
    title: 'Community guidelines',
    updated,
    intro: 'Count Me In works because people show up and look out for each other. Keep it that way.',
    sections: [
      { heading: 'Respect', paragraphs: [
        'No insults, harassment, threats, hate or put-downs, in chats, profiles or stories. Everyone is welcome, whatever their background, fitness or skill level.',
      ] },
      { heading: 'Show up, or say so', paragraphs: [
        'Tap Count me in only if you mean it. Can’t make it? Use Can’t make it as early as you can, so the host knows.',
      ] },
      { heading: 'No selling or spam', paragraphs: [
        'Count Me In is not a marketplace. No advertising, selling, recruiting for paid services or chain messages.',
      ] },
      { heading: 'Keep it real', paragraphs: [
        'Use your own name and photo. Post honest activities and honest personal records; the crew confirms PRs.',
      ] },
      { heading: 'Meet safely', paragraphs: [
        'Meet in a public place, tell someone where you are going, trust your gut and leave if something feels off. In an emergency call 000.',
      ] },
      { heading: 'Report and block', paragraphs: [
        'See something that breaks these rules? Report it from the profile, activity, chat or story. Blocking someone hides you from each other. Our moderators look at every report.',
      ] },
    ],
  },
}
