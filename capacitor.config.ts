import type { CapacitorConfig } from '@capacitor/cli';

// The Capacitor shell for the App Store and Google Play (roadmap 1.0 M7, Phase 19 P2).
// The game is bundled inside the app from dist/ (`npm run build`, then `npx cap sync`).
// No server.url: the app never loads horders.netlify.app or any other host for its code,
// which keeps it inside Apple guideline 2.5.2 (docs/design/app-stores.md).
const config: CapacitorConfig = {
  // Final before the first store upload (M10); free to change until then.
  appId: 'com.steveglanz.horders',
  appName: 'Horders',
  webDir: 'dist',
  // The game's --bg, so the web view never flashes white before the page paints.
  backgroundColor: '#120b0a',
  // No pinch zoom (the default, set here so nobody turns it on by accident). Text selection is
  // already off in the page CSS (client/index.html: user-select: none, except the co-op code).
  zoomEnabled: false,
  // The game fills the screen itself (viewport-fit=cover, env(safe-area-inset-*)), and the page
  // never scrolls, so the iOS web view must not bounce or add insets of its own.
  ios: { contentInset: 'never', scrollEnabled: false, allowsLinkPreview: false },
  android: { allowMixedContent: false },
};

export default config;
