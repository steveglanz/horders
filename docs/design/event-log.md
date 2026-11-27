# Event log spec (vision v2, Checkpoint 1)

Pillar 5 (one world, one voice, honestly made) and the "how we know it works" rule: bots measure fairness, humans measure fun. This is the spec only. It goes live on the public web build in Checkpoint 2 (engineering queue item 4), and the privacy page changes in that same PR, never before.

Sources: docs/design/vision/vision.md (Checkpoint 1 engineering row; section "How we know it works"), proposal-product.md ("Event log"), redteam.md (web build retention test: "at least 30% of web players start a second run").

## Rules
- **Anonymous.** Rows carry the Supabase anonymous user id the game already makes for cloud saves (client/cloud.ts), nothing else that points at a person. No name, email, device id, advertising id, IP address, location or free text. The table has no IP column, and the client never sends one.
- **Small and fixed.** About 12 event names, each with a fixed set of fields. A new event or field is a PR that edits this page, the migration and the privacy page together.
- **Never blocks play.** Events go into a queue in memory and localStorage (at most 200, oldest dropped), sent in one batch every 30 s, on run end and on `visibilitychange` to hidden. Offline, they wait. A failed send is dropped after 3 tries. The game never waits for a send.
- **Off switch.** Settings > "Send anonymous play stats" (on by default on the web build; the store builds follow the store rules at Checkpoint 7). Off clears the queue and sends nothing.
- **Not in the sim.** The sim (sim/) stays pure and deterministic. client/telemetry.ts reads World events and summaries the client already gets, as the end screen does.
- **Kept 13 months, then deleted** by a scheduled delete in the same migration (pg_cron if the free tier allows it, otherwise a weekly SQL run in the dashboard until it does). Delete my account removes the player's rows at once.

## The events

Every row also has: `user_id` (anonymous auth id), `session` (random id per app open, made on the device), `build` (git short sha), `platform` ('web' | 'ios' | 'android'), `at` (server time).

| # | Event | When | Fields (`data` jsonb) | Question it answers |
|---|---|---|---|---|
| 1 | `app_open` | App or page start | `first` (bool: first open on this device), `view` ('portrait' or 'landscape'), `renderer` ('3d' or '2d') | How many people come back (D1, D7) |
| 2 | `tutorial_step` | Each tutorial step passed | `step` (id from the tutorial script), `secs` (since first open) | Where new players stop |
| 3 | `run_start` | Delve starts | `run` (random id), `dungeon`, `tier`, `cls`, `party` (heroes, bots), `mode` ('delve', 'quick', 'daily', 'keys'), `omens` | What people play |
| 4 | `fight_end` | A pack or boss cleared, or the run lost in it | `run`, `kind` ('trash', 'named', 'boss', as tools/matrix.ts), `enc` (encounter id), `secs`, `won` | Do humans stay inside the fight budgets |
| 5 | `run_end` | Delve ends | `run`, `won`, `secs`, `fights` (cleared), `level`, `cause` (killing blow's source name on a loss, as on the loss screen), `embers` (earned) | Wins, run length, top causes of death |
| 6 | `draft_pick` | In-run pick (Sparks from Checkpoint 2; today's talent draft until then) | `run`, `picked` (id), `offered` (ids) | Pick rate against win rate, dead cards |
| 7 | `ability_option` | An ability option chosen on the hub | `cls`, `slot`, `option` | Which options people use |
| 8 | `system_seen` | A system's first appearance on screen (forge, Keys, Omens, Journal...) | `system` (id) | Is the unlock curve reaching people |
| 9 | `quit_mid_run` | Page hidden for over 60 s, or app closed, mid-run | `run`, `secs`, `fight` (current fight index) | Where runs are abandoned |
| 10 | `offer_viewed` | The unlock offer shown (Checkpoint 7) | `where` ('end screen', 'hub', 'locked place') | Does the offer reach people |
| 11 | `purchase` | Unlock bought or restored (Checkpoint 7) | `kind` ('buy' or 'restore'), `ok` (bool) | Conversion, restore problems |
| 12 | `session_end` | Page hidden, or app to background | `secs` (session length), `runs` (started this session) | Session length, runs per session |

No event carries a price, a store receipt or a payment id: the stores report money. Events 10 and 11 only start in Checkpoint 7.

## The table (migration 0010, written with the CP2 PR)

```sql
create table public.play_events (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users (id) on delete cascade,
  session  uuid not null,
  event    text not null check (event in ('app_open','tutorial_step','run_start','fight_end','run_end','draft_pick',
                                         'ability_option','system_seen','quit_mid_run','offer_viewed','purchase','session_end')),
  build    text not null check (length(build) <= 16),
  platform text not null check (platform in ('web','ios','android')),
  data     jsonb not null default '{}' check (pg_column_size(data) <= 1024),
  at       timestamptz not null default now()
);
create index play_events_event_at on public.play_events (event, at);
alter table public.play_events enable row level security;
-- No select, update or delete policy: players can't read the table, even their own rows. Inserts go through one function.
```

- **Writes:** one `security definer` function, `log_events(p_events jsonb)`, granted to `authenticated` only (the anonymous session already is). It takes up to 50 events per call, sets `user_id` from `auth.uid()` (never from the client) and `at` from the server, and drops events with unknown names. A per-user cap (about 2,000 rows a day) stops a broken client filling the free tier.
- **Reads:** only from the dashboard SQL editor and the weekly report (Checkpoint 7), by the project owner. No client read path.
- **Delete my account:** `delete_my_account()` (0008) gets `delete from public.play_events where user_id = uid;` in the same migration, as its header asks for any new table.
- **Size check:** about 40 events per player per day at about 300 bytes each is 12 kB; 1,000 daily players for 13 months is about 4.7 GB before compression, so the free tier (500 MB) holds about 1 month at that size. At the web test's scale (hundreds of players) it fits for the whole 13 months. Revisit retention, or roll up `fight_end` into daily counts, before the store launch.
- **Applied only after Steve says yes**, through the dashboard SQL editor as before (engineering brief, "Supabase").

## Privacy page line (lands with the CP2 PR, needs Steve's OK)

client/public/privacy.html "The short version" today says "There are no ads, no analytics or tracking". With the event log it becomes:

> There are no ads and no tracking across apps or sites. The game sends anonymous play stats (for example which dungeon you played, how long a fight took and how a run ended) tied only to the same random id, so we can see what is too hard or too long. You can turn this off in Settings. Nothing is sold or shared.

and "What is stored, and why" gets a row: "Play stats: the events listed on this page, kept 13 months, removed at once by Delete my account." The page lists the 12 event names. The store privacy labels (Checkpoint 7) declare "Gameplay content / Product interaction, not linked to identity, not used for tracking"; app-stores checks that wording against both stores' forms then.

## What reads it
- Checkpoint 2: the grey-box web test counts `run_start` per `user_id` (target: 30% start a second run) and `fight_end` medians against the budgets.
- Checkpoint 7: a weekly one-page report (top causes of death, dead Sparks, fight medians by class and place, D1 and D7).
- Bots stay the merge gate (tools/matrix.ts); the event log never blocks a merge.
