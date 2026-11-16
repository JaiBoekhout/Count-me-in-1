# Back-up maken (eens per week)

Het gratis plan van Supabase maakt geen back-ups die jij kunt terugzetten. Maak daarom zelf eens per week een kopie van de belangrijkste gegevens. Dit kost 5 minuten en is gratis.

## Gegevens downloaden (tabellen)

1. Open [supabase.com](https://supabase.com) en kies je project **count-me-in**.
2. Klik links op **Table Editor**.
3. Klik op de tabel **profiles**.
4. Klik rechtsboven op de knop met het pijltje (**Export**) en kies **Export table as CSV**.
5. Doe hetzelfde voor deze tabellen: `activities`, `activity_join_requests`, `activity_meetup_confirmations`, `friend_requests`, `personal_records`, `stories`, `partner_banners`, `premium_grants`, `user_roles`.
6. Zet alle bestanden in één map met de datum, bijvoorbeeld `backup-2026-11-23`, op je laptop **en** in je cloud (Google Drive of iCloud).

## Foto's

Foto's staan in **Storage**. Die hoef je niet elke week te bewaren; leden kunnen een foto altijd opnieuw uploaden. Wil je toch een kopie: klik links op **Storage**, open een map (bijv. `avatars`) en download de bestanden.

## Wanneer extra belangrijk

- Voordat je een groot SQL-bestand draait.
- Voordat je live gaat of veel nieuwe mensen uitnodigt.

## Later

Groeit de app (honderden actieve leden)? Dan is het Supabase **Pro**-plan (ongeveer USD 25 per maand) de moeite waard: dat maakt elke dag automatisch een back-up die je met één klik terugzet.
