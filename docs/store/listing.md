# Horders store listing draft (1.0, M9)

Draft only, written 27 Nov 2026. No store account exists yet (M10, Steve). Everything here is
pasted into App Store Connect and the Play Console when the accounts are opened. Facts about what
the game stores come from `client/cloud.ts`, `client/net/party.ts` and the privacy page
(`client/public/privacy.html`, PR #866).

Field limits, read 27 Nov 2026:
- Apple: name 2-30 characters and subtitle 30 ([App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)); promotional text 170, description 4000 (no HTML), keywords 100 bytes ([Platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)).
- Google Play: app name 30, short description 80, full description 4,000 ([Create and set up your app](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en)).

## 1. Name check

Searched 27 Nov 2026 (web search of apps.apple.com, play.google.com, Steam and itch.io, then
each hit opened):

| Where | What came up | Clash? |
| --- | --- | --- |
| Google Play | [HORDERS](https://play.google.com/store/apps/details?id=hawkinscookerslimited.android.orders&hl=en_US&gl=US) by Hawkins Cookers Ltd: a Business app for its own sales staff to place dealer orders, 1K+ downloads, updated 8 Sep 2026 | Same word, different category (Business, not Games). Play does not block duplicate names, but a search for "Horders" will show both, so use a longer listing title (below) |
| App Store | No app titled "Horders". Nearby game titles: Horde.io, Heroes vs Hordes, Hold the Horde, Against the Horde | No exact match |
| itch.io | [-Project- H.O.R.D.E.R.S](https://doogan-inc-studios.itch.io/horders/community) by Doogan Inc Studios: an early devlog for a space ship game, URL slug `horders` | Not a store app; an acronym title. Low risk |
| Steam | Nothing named Horders (closest: Hordelord, an arena shooter) | No |
| WoW | "Horde" is one of the two WoW factions ([warcraft.wiki.gg](https://warcraft.wiki.gg/wiki/The_Horde)). "Horders" is a different word, and WoW has no place, character or item called Horders that the search found | The game name never says Horde, Warcraft or WoW, and the listing text below doesn't either. Keep WoW, Warcraft and other games' names out of the keywords too |

This is a search, not a trademark clearance. A registered-trademark search (USPTO, EUIPO) is
a Steve step before paying for accounts, if he wants one.

**Listing title (both stores, 30 max): `Horders: Dungeon Delve RPG`** (26 characters). The plain
"Horders" stays the in-game name; the store title adds the genre so it doesn't sit next to an
order-entry app with nothing to tell them apart.

## 2. App Store text

**Subtitle** (30 max): `Raid bosses in quick runs` (25)

**Promotional text** (170 max):
> Delve room to room, beat the boss, grab the loot. Five classes, five solo dungeons, group dungeons and four raids, all in runs of a few minutes. Free, no ads.

(158)

**Keywords** (100 bytes, comma separated, no spaces, no words already in the title):
`roguelite,raid,boss,co-op,loot,mmo,hero,arpg,fantasy,talent,offline,party,tank,healer,action`
(92 bytes)

**Description**: use the shared description in section 4.

## 3. Google Play text

**Short description** (80 max): `Quick dungeon runs, real boss fights and loot. Play solo or with friends.` (73)

**Full description**: section 4.

## 4. Shared full description (both stores, under 4,000)

> Horders is a pocket-sized dungeon crawler built for phones. Pick a hero, delve through a dungeon room by room, clear the packs in your way and take on a boss that fights back with real mechanics. A run takes a few minutes, and every one pays out loot.
>
> FIVE CLASSES
> Bulwark, the shield tank who holds the boss. Lumen, the healer who keeps the party standing. Emberwright, the fire caster. Cutwick, the fast blade. Slagbinder, the cannon gunner. Each unlocks new abilities as you level, and each has its own talent tree to shape how it plays.
>
> BOSSES THAT ASK SOMETHING OF YOU
> Bosses telegraph their big hits. Step out of the red, hide behind a pillar from the Glare, interrupt the cast that would heal them, find the light before the Long Night falls. Learn the fight, then beat it on a higher tier.
>
> SOLO, GROUP AND RAID
> Five solo dungeons, three group dungeons and four raids. Play with friends in co-op, or fill an empty seat with a bot that plays its role. Tanks hold, healers heal, everyone else stays out of the fire.
>
> LOOT AND PROGRESS
> Gear drops from Common to Mythic, and the rare ones really are rare. Climb fifteen difficulty tiers, then push the Delver's Keys as far as you can. Weekly Omens change the rules, a daily bounty sets a new challenge, and the whole player base fights a shared world boss.
>
> MADE FOR PHONES
> Drag anywhere to move. Your hero attacks on their own, and you choose when to use your abilities. The screen stays clear, and a run fits in a short break.
>
> FAIR AND PRIVATE
> Free, with no ads and no purchases. No sign-up: the game never asks for your name or email. Your hero is saved to the cloud under an anonymous id so a new phone doesn't lose it, and you can delete it any time from Settings.

About 1,730 characters. Facts checked against the game: classes `sim/content/classes.ts`; 5 solo,
3 group (minParty 2) and 4 raids (minParty 4) in `sim/content/dungeon.ts` DUNGEONS; tier cap 15
(#863); rarities Common to Mythic (#860, #862); world boss, Omens, daily bounty, Delver's Keys
and bots are in the game today. **Re-check the "Free, no ads, no purchases" line if Steve adds a
price, IAP or ads** (memory: he may at launch); then the privacy answers below change too.

## 5. Age rating answers

### Apple (App Store Connect age rating questions)

Categories as listed on Apple's [age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) page (read 27 Nov 2026; the page was only partly readable, so check each answer against the live widget):

| Question | Answer | Why |
| --- | --- | --- |
| Parental controls / age assurance | No / No | None in the game |
| Unrestricted web access | No | The only links open our own privacy and delete pages |
| User-generated content | No | Players type nothing that others see (leaderboards show class and level only) |
| Social media | No | |
| Messaging and chat | No | Co-op has no chat (no chat code in `client/`) |
| Shared location | No | |
| Advertising | No | No ads |
| Profanity or crude humor | None | |
| Horror/fear themes | Infrequent | Foes are drawn to look menacing (dark creatures, fangs, glowing eyes), not gory |
| Alcohol, tobacco, drugs | None | Potions are magic health potions, not alcohol |
| Dating, medical, wellness, sexual content, nudity | None | |
| Cartoon or fantasy violence | **Frequent** | Combat is the whole game: stylized heroes fight fantasy creatures, no blood or gore |
| Realistic violence, graphic violence | None | |
| Guns or other weapons | Infrequent | The Slagbinder carries a fantasy slag cannon; the rest use blades, shields, fire and light. Answer "None" if Apple's definition means real-world guns only |
| Gambling, simulated gambling, contests | No / None | |
| Loot boxes | No | Loot drops from foes in play; nothing is bought, and there is no paid random reward |

**Expected rating: 13+**, set by frequent cartoon/fantasy violence (Apple's table, as read, puts
frequent cartoon violence at 13+ and infrequent at 9+). The widget computes the real rating.

### Google Play (IARC questionnaire)

Category: Game. Answers in the same spirit: fantasy violence against non-human creatures, no
blood, no realistic violence, no sex or nudity, no bad language, no drugs, no gambling, no
purchases, no user-to-user chat or content sharing, no location sharing. IARC gives each region's
rating from these answers; we don't guess the numbers here.

## 6. Apple App Privacy (nutrition label)

Based on Apple's [App privacy details](https://developer.apple.com/app-store/app-privacy-details/) (read 27 Nov 2026).

**Does this app collect data? Yes.**

| Data type | Collected | Linked to the user | Used for tracking | Purpose |
| --- | --- | --- | --- | --- |
| Identifiers > User ID | Yes: the random anonymous account id (Supabase anonymous sign-in) | Yes (it is the account) | No | App Functionality |
| User Content > Gameplay Content | Yes: cloud save of the hero, leaderboard times (class, level, time), world boss damage, link codes | Yes | No | App Functionality |

Everything else: **not collected** (no contact info, location, contacts, photos, purchases,
browsing or search history, diagnostics, device ID, usage analytics).

Notes behind the answers:
- Apple: "Your app includes game saves, multiplayer matching, or gameplay logic, Declare Gameplay
  Content on your label." That covers the cloud save and leaderboards.
- Tracking means linking our data with third-party data for ads or sharing it with a data broker.
  We do neither: **"Data used to track you": none.**
- IP addresses: Apple says an IP address "sent on a server call and not retained" needs no
  disclosure. We don't store IPs. Supabase and Netlify may keep request logs to run their
  services (the privacy page says so); if Apple's reviewer asks, that's the answer.
- Co-op moves go device to device (WebRTC) and are not stored, so they aren't collected.

## 7. Google Play Data safety form

Based on [Provide information for Google Play's Data safety section](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en) (read 27 Nov 2026).

**Does your app collect or share any of the required user data types? Yes (collect). Share: No.**

| Data type | Collected | Shared | Required or optional | Processed ephemerally | Purposes |
| --- | --- | --- | --- | --- | --- |
| Personal info > User IDs | Yes (anonymous account id) | No | Required (made automatically at first launch) | No | App functionality, Account management |
| App activity > Other actions ("such as gameplay") | Yes (cloud save, leaderboard times, world boss damage) | No | Required | No | App functionality |

All other types: not collected. Notes:
- **Sharing: No.** Supabase (game server), Netlify (site host) and Google's STUN server act for
  us, and Google exempts "service providers" that process data "on behalf of the developer".
- **Encrypted in transit: Yes.** The game server is reached only over https
  (`client/cloud.ts` `URL_BASE`), and WebRTC co-op is always DTLS-encrypted.
- **Way to request deletion: Yes.** In the app: Settings > Delete my account (PR #853). On the
  web: https://horders.netlify.app/delete-account.html (PR #866). Put that URL in the
  "delete account URL" field.
- **Privacy policy URL:** https://horders.netlify.app/privacy.html (both stores). Both pages
  still need the Horders contact email (Steve to-do), and both need to be on the live site.
- Not a "Designed for Families" app; target audience 13+.
- If Steve adds ads or IAP, revisit: ads SDKs collect device IDs, and IAP adds purchase history.

## 8. Screenshots and icons

Made by `node tools/storeshots.cjs <out>` after `npm run build` (see README.md). 27 Nov 2026 set,
from main with the 3D look on by default: full size in the project files at
`horders/visuals/store/v4/`; previews in `docs/art/store/`.

| Store | What to upload | We have |
| --- | --- | --- |
| App Store, iPhone large display (6.9"/6.7") | 1290 x 2796 is an accepted size, up to 10, no alpha ([screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)) | `phone-1..7` at 1290 x 2796 |
| Google Play phone | 2 to 8 screenshots, each side 320-3,840 px, long side at most 2.3x the short, JPEG or 24-bit PNG with no alpha; for games, at least three 1080 x 1920+ portrait or 1920 x 1080+ landscape ([preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en)) | the same `phone-*` (2796/1290 = 2.17) or `landscape-*` |
| Google Play icon | 512 x 512 PNG, up to 1024 KB | `icon-512.png` (hoard beast, from `assets/icon.svg`) |
| App Store icon | Comes from the app build (the Capacitor AppIcon set, same art) | `icon-1024.png` matches |
| Google Play feature graphic | 1024 x 500, JPEG or 24-bit PNG, no alpha | **Not made yet** (next visuals task) |
| Google Play preview video | Highly recommended for games (YouTube) | `trailer` target records 30 s; needs a cut on a machine with a GPU |
