# Horders on a phone: UX research and redesign spec

Owner: the "Redesign Horders for small screens" thread. The "Tune Horders UI for phones"
thread owns the tooltip system (`client/tips.ts`, PR #81) and the in-run HUD, talent
draft, end screen and pause. This spec owns the hub's structure, bags and Forge,
delve setup and co-op entry, and gives HUD notes to the mobile thread.

Steve's brief (2026-11-21): the phone UI is too cluttered, players don't know what
talents are, use tap-and-hold tooltips and a minimalist approach, and look at how other
phone games hide things and use the small screen.

## 1. What the research says

Patterns only. We borrow layout ideas, never another game's art, names or content.

| # | Pattern | Evidence |
|---|---|---|
| R1 | **Primary actions live in the bottom thumb zone; status goes top center.** | Epic's mobile guide for Fortnite: "The thumb zone (the bottom corners of the screen) is where primary actions take place" and "Information like maps, timers, and scores belong at the top center, or should be collapsible." ([Epic, Designing for Mobile in Fortnite](https://dev.epicgames.com/documentation/fortnite/designing-for-mobile-in-fortnite)). Smashing: "keep frequently used links in the easy-to-reach zone" ([Ingram 2016](https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/)). Unity/Outfit7: "It's harder for a smaller hand to reach the middle of the device" ([Unity blog, 2023](https://blog.unity.com/en/games/mobile-ui-design-best-practices-part-1)). |
| R2 | **Show few controls at once.** | Epic: "Show only what is essential to the game at the moment. No more than 5–6 active controls should be visible at once." (same page). |
| R3 | **44pt minimum tap targets.** | Apple: "Create controls that measure at least 44 points x 44 points" ([Apple, UI Design Dos and Don'ts](https://developer.apple.com/design/tips)). Epic repeats 44×44. |
| R4 | **A bottom tab bar for top-level sections, and only for navigation.** | Apple HIG: "A tab bar lets people navigate between top-level sections of your app", "it's generally easier to navigate among fewer tabs", "Use a tab bar to support navigation, not to provide actions" and "Avoid overflow tabs." ([Apple HIG, Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)). Phone RPG hubs use the same shape: AFK Arena's "Bottom Bar: Contains navigation buttons for 'Campaign', 'Heroes', 'Bag', …", with the current stage "prominently displayed" in the centre ([Ludo.guide, AFK Arena UI](https://www.ludo.guide/guide/afk-arena/understanding-the-user-interface-ui)); G5's games document a bottom menu of Store, Inventory, Collections and team play ([G5 support](https://support.g5.com/hc/en-us/articles/6490468854802-What-does-the-Bottom-Menu-of-the-Main-Screen-look-like)). Archero's guides name separate Equipment, Talents and Shop tabs ([gameskeys.net guide](https://gameskeys.net/archero-ultimate-beginner-guide)). |
| R5 | **Progressive disclosure: hide, don't remove.** | "Initially, show users only a few of the most important options… Disclose a larger set of specialized options only if a user asks for them", so "you remove UI clutter, not features" ([Babich 2016](https://babich.biz/blog/design-patterns-progressive-disclosure-for-mobile-apps)). |
| R6 | **Opt-in info and context-aware HUDs.** | "Some information can be opt-in; informing the player only as they need to know it", "hiding combat UI outside of encounters", and the thumb hides icons under it: "you always cover up to 33% of it" ([UX Bootcamp, 7 HUD mistakes](https://bootcamp.uxdesign.cc/7-obvious-beginner-mistakes-with-your-games-hud-from-a-ui-ux-art-director-d852e255184a)). |
| R7 | **Safe areas are layout, not decoration.** | Outfit7: "We treat safe areas as dynamic UI offsets." (Unity blog above). |
| R8 | **Minimalism depends on genre.** | Atomhawk via PocketGamer.biz: "a minimalist menu may work well for an immersive action game, it'll end up becoming frustrating to navigate for an information-heavy RPG", and mobile needs "larger icons and text" ([PocketGamer.biz 2023](https://www.pocketgamer.biz/the-magic-that-makes-mobile-ui-look-good-and-feel-great)). Horders is both, so the run is minimal and the hub uses tabs so the RPG depth stays one tap away. |

What we did not find a citable source for, and treat as our own design choice: red-dot
badges for new things, and icon-grid inventories with a detail sheet. Both are common in
phone RPGs, but the guides we read don't document them, so we don't claim them as
evidence.

## 2. Audit (before)

Captured with `node tools/uxaudit.cjs <dir>` (new in this PR) on a mid-game hero
(`tools/heroes/hero-t6.json`, tier 6, six items) against a fake backend. Shots are in
`docs/ux/audit/before/`.

| Screen | 375×667 (iPhone SE) finding |
|---|---|
| Hub | **3.6 screens tall.** The first screen is the logo, hero card and class row; one delve card shows above the Delve button. Below the fold: 5 dungeon cards, tier row, 2 Omens, 3 potion cards, daily bounty, world boss, co-op, display options, how to play. Everything is always expanded. |
| Hub tap targets | 21 controls under 44px: sound toggle 36, Bags 40 tall, tier buttons 40, bounty/Quick join/Host/Join 38, display option chips 32, the two `<summary>` rows 20, Reset hero 15. |
| Bags & Forge | Each item is a full card (~140pt) with every stat and three buttons, so a 6-item bag is 1.6 screens and a 30-item bag would be ~8. A paragraph of help text sits on top. No sort, no compare with what you wear. |
| Potions | Three tall cards with paragraphs, for a choice made once per delve. |
| Co-op | Quick join, Host, code field and Join all visible at once, at the very bottom. |
| HUD (mobile thread) | Fight intro (title + a 4-line Omen paragraph) sits mid-screen over the hero for several seconds. Buff pill + target frame + route chip stack 3 rows under the top bar. Ability labels truncate ("Flame W…", "Combusti…"). |
| Talent draft (mobile thread) | Three cards fill the screen; fine, but the "toward capstone" line repeats on each card. |
| End (mobile thread) | Fits on one screen; "No talents taken" and an empty Loot box waste rows on a loss. |

Landscape and 390×844 shots: see `docs/ux/audit/before/`.

### After (2026-11-21, PRs #87 and the Delve/bags PR)

| Measure (`tools/uxaudit.cjs`, tier-6 hero) | Before | After |
|---|---|---|
| Hub scroll, 375×667 | 3.57 screens | 1.00 (Delve tab fits) |
| Hub scroll, 390×844 | 2.80 | 1.00 |
| Hub scroll, 667×375 landscape | 5.38 | 1.12 |
| Hub scroll, 844×390 landscape | 4.68 | 1.03 |
| Hub controls under 44pt, 375×667 | 21 | 0 |

Shots: `docs/ux/audit/tabs/` and `docs/ux/audit/delve-bags/` (including a WebKit run,
`webkit-se.jpg`, since Steve plays on an iPhone).

## 3. Redesign

### 3.1 Navigation: one primary action, four tabs

```
┌───────────────────────────────┐
│ ● 1,240        HORDERS    ⚙   │  top bar: embers, wordmark, settings (sheet)
├───────────────────────────────┤
│                               │
│        (active tab pane)      │
│                               │
├───────────────────────────────┤
│  [   Delve · Kiln Depths 6  ] │  primary button, Delve tab only
├───────┬───────┬───────┬───────┤
│ ⚔Delve│ ◎Hero•│ ▣Bags3│ ✦Group│  tab bar, 56pt + safe area
└───────┴───────┴───────┴───────┘
```

- **Delve** (home): what to play next. Selected dungeon, tier, a row of prep chips, the
  daily bounty as one line. The Delve button sits right above the tab bar (R1).
- **Hero**: class switcher, gear (6 slot tiles), talents (2×2 from #81), hero XP.
- **Bags**: the inventory grid and the Forge (replaces the full-screen Bags overlay on phones).
- **Group**: world boss and Play together (Quick join first, host/code behind one tap).
- **⚙ Settings** (top right, opens a sheet): sound, display options, how to play, the
  stress test link, reset hero. None of these are daily actions (R5).
- Tabs are navigation only (R4). Four tabs, no overflow.
- Badges (our choice, see §1): Hero shows a gold dot when talent points are unspent;
  Bags shows the count of items you haven't looked at; Group shows a dot when a world boss
  reward can be claimed. A badge clears when the tab is opened.
- On wide screens (≥ 900×600) the same tab bar shows, but Delve keeps the two-column
  layout with hero and delve side by side.

### 3.2 Always visible vs one tap vs long press

| Always visible | One tap (sheet or tab) | Long press (tooltip, `tips.ts`) |
|---|---|---|
| Embers, class glyph + level, XP bar | Gear details, talents, bags, Forge | What a talent does, per point |
| Selected dungeon + tier, Delve button | Omens list, potion picker, bounty details | Item stats and set bonuses |
| Tab bar with badges | World boss details, party code entry | Omen and twist effects |
| | Settings | Locked dungeon requirements, class blurbs |

### 3.3 Delve tab

```
┌───────────────────────────────┐
│ [◉] Emberwright  Lv 5  ▬▬▬░░  │  hero strip (tap → Hero tab)
│                               │
│ ‹ ┌───────────────────────┐ › │  dungeon carousel, one card + peek,
│   │ The Kiln Depths       │   │  swipe or tap arrows; locked cards greyed
│   │ Dodge, interrupt…     │   │  with "Tier 7" (hold for why)
│   │ Solo friendly         │   │
│   └───────────────────────┘   │
│        ● ○ ○ ○ ○              │
│ Tier  [ − ]   6   [ + ]       │  stepper, 44pt buttons
│ [⚠2 Omens] [⚗ Potion] [Grit]  │  prep chips → bottom sheets
│ ★ Daily bounty +60      [Go]  │  one line
└───────────────────────────────┘
```

Fits one 667pt screen with the Delve button and tab bar. Omens and potions move into
bottom sheets that open from the chips. Grit only shows when it applies.

### 3.4 Bags tab

- A 4-column grid of item tiles (5 at ≥ 390pt): rarity border, slot glyph, item level,
  a small "E" for equipped, a set mark. Equipped items first, then by score.
- Tapping a tile opens an **item sheet** from the bottom: the full card (`itemHtml`),
  the item you're wearing in that slot underneath for comparison, and the actions
  Equip, Upgrade, Temper and Salvage as 44pt buttons in the thumb zone.
- Help text moves into the sheet (one line under Upgrade/Temper) and into tooltips.
- New items (since the bag was last opened) get a dot until viewed.

### 3.5 Group tab

World boss card (name, bar, your damage, claim button) and Play together: Quick join as
the one big button, "Host" and "Join with code" as a secondary row; the code field
appears only after "Join with code".

### 3.6 Bottom sheets

One reusable `sheet` element: slides up from the bottom, max 80% height, scrolls inside,
dims the page, closes on the backdrop, a grab handle, or Escape. Used by Settings, Omens,
Potions, Bounty and items. Sound ids keep working (`data-sfx="open"`/`"back"`).

### 3.7 Landscape phones

Tab bar becomes a vertical rail on the left (56pt wide) so the content keeps its height;
the Delve button sits bottom right under the right thumb (R1, Unity's landscape note).

### 3.8 HUD notes for the mobile thread

1. Move the fight intro (title + Omen paragraph) off the play area: a one-line title in
   the top band, Omen details behind the Omen chip (long press) (R6).
2. Collapse buffs, target frame and route chip into one row under the top bar where they
   fit; the route chip is redundant once the target frame shows.
3. Ability buttons: icon only with cooldown ring on phones; the name goes to long press,
   avoiding "Flame W…" truncation (R2, R6).
4. Keep controls to the corners: abilities bottom right, movement anywhere on the left (R1).

## 4. Delivery

1. ✓ This spec + `tools/uxaudit.cjs` + before shots (#83).
2. ✓ Hub tabs: tab bar, Delve/Hero/Bags/Group panes, Settings sheet, badges (#87).
3. ✓ Delve tab compaction: dungeon carousel, Omens/Potion/Bounty chips with sheets. The
   tier row stayed a row of 44pt buttons instead of a stepper: it already fits six tiers
   and one tap beats several.
4. ✓ Bags grid and item sheet.
5. ✓ Group tab: Quick join full width; world boss explanations on long press.
6. After shots for every screen with `tools/uxaudit.cjs`, added to §2.
