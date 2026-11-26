# The app shell (roadmap 1.0 M7, Phase 19 P2)

Horders ships to the App Store and Google Play as the same web build, wrapped by
[Capacitor](https://capacitorjs.com/docs) 8.6.3. The game is bundled inside the app: `npx cap sync`
copies `dist/` into each native project, and there is no `server.url`, so the app never loads its
code from horders.netlify.app or any other host (Apple 2.5.2, see [app-stores.md](app-stores.md)).

## Files

| File | What it is |
|---|---|
| `capacitor.config.ts` | App id `com.steveglanz.horders`, name Horders, `webDir: 'dist'`, the game's `#120b0a` background, no pinch zoom, no iOS bounce or link previews |
| `android/` | The Android Studio project. Target and compile SDK 36 (Play needs API 36 for new apps), min SDK 24 |
| `ios/` | The Xcode project. iOS 15 and up, Capacitor through Swift Package Manager (no CocoaPods) |
| `assets/` | Icon and splash sources (#850). Their generated sizes are committed in both projects |
| `.github/workflows/app-shell.yml` | Builds both apps in CI (below) |

The app id is final once the first build is uploaded to a store (M10). Until then it can change:
edit `capacitor.config.ts`, `android/app/build.gradle` (`namespace`, `applicationId`), the Java
package folder under `android/app/src/main/java/`, and `PRODUCT_BUNDLE_IDENTIFIER` in
`ios/App/App.xcodeproj/project.pbxproj`.

## Building

```
npm run cap:sync          # npm run build, then cap sync (copies dist/ into android/ and ios/)
cd android && ./gradlew assembleDebug    # needs JDK 21 and the Android SDK
```

iOS needs macOS with Xcode 26. Steve's PC is Windows, so iOS builds run on GitHub's macOS runner
(free for a public repo). Open `ios/App/App.xcodeproj` in Xcode on a Mac to run it on a device.

After an icon or splash change in `assets/`, remake every size with
`npx @capacitor/assets@4.0.0 generate --ios --android --iconBackgroundColor '#120b0a' --splashBackgroundColor '#120b0a'`.
It is not a dependency, so CI installs stay small.

## CI: the "App shell" workflow

Runs on pull requests that touch the shell, the assets or the packages, on every push to main,
and by hand (Actions, App shell, Run workflow).

- **android** (ubuntu): build the game, `cap sync android`, `./gradlew assembleDebug`. The debug
  APK is kept as the run's `horders-debug-apk` artifact for 14 days. It is signed with the
  Android debug key, so it installs straight on an Android phone with "install unknown apps" on.
- **ios** (macos-26, Xcode 26.6 build 17F113 on 26 Nov 2026): prints `xcodebuild -version`, then builds an unsigned Debug app for the iOS
  simulator. A real iPhone needs a signed build, which needs the paid Apple account (M10).

Nothing is signed for release and nothing is uploaded to a store.

The Automerge workflow waits on CI only, not on App shell, so check a shell PR's App shell run
before it merges.

- **android-play** (ubuntu, after android): boots an Android 15 (API 35, x86_64, KVM) emulator
  with reactivecircus/android-emulator-runner, installs the debug APK, and runs
  `tools/apkplay.cjs`. The script attaches to the app's WebView with Playwright's Android support
  (playwright-core, installed only in the job), taps Delve with a real `adb input tap` (CDP mouse
  and touch input hang in the emulator's WebView), turns on the autopilot at warp 10 and waits for
  the delve to end. It fails if the delve does not end, the end screen does not show, there are no
  kills, or the page throws. Device screenshots are the run's `horders-emulator-shots` artifact.
  First green run 26 Nov (#861): WebView 124, WebGL and the 3D look on, a Kiln delve won with 79
  kills in about 5 minutes of wall time. `node tools/apkplay.cjs --desktop <outDir>` runs the same
  flow in desktop Chromium on `dist/`.
