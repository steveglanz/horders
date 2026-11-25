# Horders on the App Store and Google Play: readiness audit

Steve (25 Nov 2026): Horders should eventually ship on the iOS App Store and Google Play, and that direction must be in the plan. This is the audit behind roadmap Phase 19. Nothing here is built yet, and no store account is opened.

Audited against main at c51973c (25 Nov 2026). Each repo finding names the file. Each store rule quotes the official page, read on 25 Nov 2026. Anything marked **check on a device** is not proven yet and must not be treated as done.

## Short answer

The game is already close to what a store wrapper needs. Every asset loads by a relative path, so the built `dist/` folder can be bundled inside the app as it is. The work that is missing is small but required: an in-app "delete my account", a privacy policy, store listings and accounts, and checks on real phones.

## Wrapper choice: Capacitor

Capacitor wraps an existing web build. It needs "A separate directory for built web assets such as `dist` or `www`" and "An `index.html` file at the root of your web assets directory" ([getting started](https://capacitorjs.com/docs/getting-started)). Horders builds exactly that (`vite.config.ts` writes `dist/index.html`). `npx cap sync` "will copy your built web bundle expected to be found in `webDir` ... to your native project" (same page), so the game ships inside the app rather than loading horders.netlify.app.

- `server.url` ("Load an external URL in the Web View") is "not intended for use in production" ([config](https://capacitorjs.com/docs/config)). We bundle instead. It also keeps us inside Apple 2.5.2 (below).
- Tooling: "To build iOS apps, you will need **macOS**" with Xcode; Capacitor 8 needs Xcode 26.0 and Android Studio 2025.2.1, and Node 22 or higher ([environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)). The repo has no Capacitor files today.

## What the repo already has

| Area | Finding | Where |
|---|---|---|
| Offline bundling | `hd2d.js` loads from `new URL('hd2d.js', document.baseURI)`; music loads from `music/...m4a` (relative). No outside fonts or CDNs in `index.html`. The only outside hosts are Supabase and the STUN server. | `client/hd2d/api.ts:144`, `client/audio/tracks.ts:23-24`, `client/cloud.ts:15`, `client/net/party.ts:15` |
| Music in the build | The two Suno tracks are in `client/public/music/` (about 5.2 MB), so Vite copies them to `dist/music/` and `cap sync` copies them into the app. | `client/public/music/` |
| Plays offline | Cloud calls "fail soft": with no network the game runs on its local save and the hub says the world boss is offline. | `client/cloud.ts:9-11` |
| Safe areas | `viewport-fit=cover` is set and the HUD, hub, action bar, sheets and toasts pad with `env(safe-area-inset-*)`. | `client/index.html:5`, `:63`, `:182`, `:921` and others |
| Pause on background | A run pauses when the page is hidden. Audio suspends and the music holds when hidden, and resumes on return. | `client/main.ts:415-418`, `client/audio/index.ts:134-139` |
| Sign-in | Anonymous Supabase sign-in, no password. The session is kept in `localStorage` (`horders.auth.v1`). | `client/cloud.ts:4-5`, `:19` |
| Purchases | None. A search of `client/` found no prices, purchases or ads. | |
| Haptics | `navigator.vibrate`, guarded by a support check. | `client/audio/haptics.ts:52` |
| Co-op | WebRTC data channels, signalled over Supabase Realtime; a dropped peer is removed. | `client/net/party.ts:128-148`, `client/net/signal.ts` |

## Gaps

1. **Account deletion (both stores, required).** Apple 5.1.1(v): "If your app supports account creation, you must also offer account deletion within the app" ([guidelines](https://developer.apple.com/app-store/review/guidelines/)). Google: an app that lets users create an account "must also allow users to request for their account to be deleted", with "an in-app path" and "a web link resource" ([Play help](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en)). Neither page names anonymous accounts. Ours are created silently, but they hold cloud saves and leaderboard rows, so the safe reading is that the rule applies. Horders has no delete today (`client/cloud.ts`, `client/save.ts`). Needs a server function that removes the player's rows and auth user, a button in Settings, and a small web page with the same request.
2. **Privacy policy (both stores).** Apple 5.1.1(i): "All apps must include a link to their privacy policy in the App Store Connect metadata field and within the app in an easily accessible manner" ([guidelines](https://developer.apple.com/app-store/review/guidelines/)). Google's Data safety form also asks about deletion (same Play page). Horders has no privacy page today.
3. **"More than a website" (Apple 4.2).** "Your app should include features, content, and UI that elevate it beyond a repackaged website" ([guidelines](https://developer.apple.com/app-store/review/guidelines/)). A full game with offline play should clear this, but it is a judgment by the reviewer. Native touches that help: real haptics, app icon and splash, no browser look (no pinch zoom, no text selection). This is a risk, not a certainty.
4. **Bundled code only (Apple 2.5.2).** Apps may not "download, install, or execute code which introduces or changes features or functionality of the app" ([guidelines](https://developer.apple.com/app-store/review/guidelines/)). Bundling `dist/` meets this. Server data (bosses, bounties, seasons) is data, not code. A content change that needs new code means a store update, so store builds should follow the same big-batch rhythm as Netlify deploys.
5. **Purchases, only if ever added.** Apple 3.1.1: unlocking "in-game currencies, game levels, access to premium content" requires in-app purchase ([guidelines](https://developer.apple.com/app-store/review/guidelines/)). There is nothing to sell today, so no work now. If a shop is ever planned, it must use Apple and Google store billing, and it needs its own design brief.
6. **Login rules.** Apple 4.8 applies when a third-party login sets up the main account. Anonymous sign-in uses none, so Sign in with Apple is not needed unless we add a Google or similar login later.
7. **Review needs a live backend.** Apple 2.1: "turn on your back-end service!" ([guidelines](https://developer.apple.com/app-store/review/guidelines/)). Supabase is on the free plan; check that the project is up (and read the plan's current pause rules) before each submission.

## Store accounts and rules (Steve's to open, later)

| | Apple | Google |
|---|---|---|
| Fee | "99 USD per membership year" ([Apple](https://developer.apple.com/programs/whats-included/)) | "US$25 one-time registration fee" ([Play help](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en)) |
| First release gate | App Review | A new personal account "must run a closed test for their app with a minimum of 12 testers who have been opted in continuously for at least 14 days" ([Play help](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en)). An organization account is not under this rule (the page applies it to personal accounts made after 13 Nov 2023). |
| Platform level | Build with Xcode 26 on macOS (Capacitor 8) | New apps "must target Android 16 (API level 36) or higher" since 31 Aug 2026 ([Play help](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en)) |
| Identity | Enrollment in the Apple Developer Program | Android developer verification: "verify your identity and register your apps" ([Android help](https://support.google.com/android-developer-console/answer/16561738?hl=en)). Organizations need a free D-U-N-S number. |
| Commission (only with purchases) | 30%, or 15% in the Small Business Program ([Apple](https://developer.apple.com/programs/whats-included/)) | Not read for this audit |

## Check on a device (not proven)

These depend on how the iOS WKWebView and the Android WebView behave inside the app, and need a real phone in Phase 19:

- `visibilitychange` fires when the app goes to the background, so runs pause and sound stops. Capacitor's App plugin pause and resume events are the backup.
- `env(safe-area-inset-*)` returns real values on Android when the app draws edge to edge (Android 15 and later), not only on iOS.
- WebRTC co-op connects inside the WebView on both platforms, and a hero who backgrounds the app drops cleanly.
- Supabase calls work from the app's origin (`capacitor://localhost` on iOS, `https://localhost` on Android by default, [config](https://capacitorjs.com/docs/config)), including CORS and the Realtime WebSocket.
- `localStorage` (save and sign-in) survives app restarts and updates. If it doesn't, move it to native storage.
- Haptics: iOS web views may not support `navigator.vibrate`; if not, use a native haptics plugin.
- Frame rate and the first 3D Delve on a mid phone (the open L2 item in the roadmap).
