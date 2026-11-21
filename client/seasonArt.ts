/**
 * Season art for the hub: each season's accent colours for the season box and the "In season" mark, and
 * its key art banner. Keyed by the season theme's index in SEASONS (sim/content/season.ts). A theme with
 * no entry keeps the season box's default violet (the Hollow Tide's). Art only: no names live here, so the
 * banner carries no text (the box's own title names the season).
 */

export interface SeasonArt {
  /** Accent for the season box's border, title and bar, and the dungeon list's "In season" mark. */
  accent: string;
  /** Light end of the bar and the title text. */
  hi: string;
  /** Deep end of the bar, and the fill behind a reached level (white text sits on it). */
  deep: string;
  /** Inline SVG key art, drawn at 360 x 110 and scaled to the box's width. */
  banner?: string;
}

/**
 * The Deep Bellows (docs/design/season.md; brief: horders/design/season2-deep-bellows-brief.md). A three-role party
 * (a shield-bearing tank, a haloed healer and a blade) in silhouette against the mouth of the Hammerdeep's
 * forge, with a bellows either side mid-breath and sparks rising. The forge breathes slowly (about 5 s, with the
 * season's harp over the bellows), swelling from Bellows Orange through Kiln Red to a White Heat core. The tank's
 * shield carries the Deepguard glyph, the set players chase in the Hammerdeep this season. Motion stops for
 * Battery saver and for reduced motion (index.html).
 */
const DEEP_BELLOWS = `<svg class="kart" viewBox="0 0 360 110" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs>
<linearGradient id="kbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0605"/><stop offset="1" stop-color="#2a0f08"/></linearGradient>
<radialGradient id="kbHeat" cx="0.5" cy="0.78" r="0.62"><stop offset="0" stop-color="#fff1d6"/><stop offset="0.28" stop-color="#ffb04a"/><stop offset="0.6" stop-color="#ff5a4a" stop-opacity="0.75"/><stop offset="1" stop-color="#ff5a4a" stop-opacity="0"/></radialGradient>
<radialGradient id="kbSpill" cx="0.5" cy="1" r="0.75"><stop offset="0" stop-color="#ff9a3c" stop-opacity="0.55"/><stop offset="1" stop-color="#ff9a3c" stop-opacity="0"/></radialGradient>
</defs>
<rect width="360" height="110" fill="url(#kbSky)"/>
<g class="kb-breath"><ellipse cx="180" cy="104" rx="170" ry="52" fill="url(#kbSpill)"/></g>
<path d="M126 104V58a54 50 0 0 1 108 0v46Z" fill="#160907"/>
<g class="kb-breath"><path d="M136 104V60a44 41 0 0 1 88 0v44Z" fill="url(#kbHeat)"/></g>
<path d="M126 104V58a54 50 0 0 1 108 0v46 M136 104V60a44 41 0 0 1 88 0v44" fill="none" stroke="#3a1a10" stroke-width="2"/>
<path d="M141 31l-6-5 M160 15l-3-7 M180 10V2 M200 15l3-7 M219 31l6-5 M128 47l-8-2 M232 47l8-2" stroke="#3a1a10" stroke-width="2.4" stroke-linecap="round"/>
<g><g class="kb-bellows" style="transform-origin:80px 87px"><path d="M30 70q38-12 72 12l22 5-22 5q-34 22-72 10Z" fill="#1d0c08" stroke="#4a2414" stroke-width="1.5" stroke-linejoin="round"/><path d="M40 74l5 26 6-27 6 26 6-25 6 23 6-20 6 16" fill="none" stroke="#4a2414" stroke-width="1.3" stroke-linejoin="round"/><path d="M30 70l-12-7 M30 102l-12 6" stroke="#4a2414" stroke-width="3" stroke-linecap="round"/></g></g>
<g transform="matrix(-1 0 0 1 360 0)"><g class="kb-bellows" style="transform-origin:80px 87px"><path d="M30 70q38-12 72 12l22 5-22 5q-34 22-72 10Z" fill="#1d0c08" stroke="#4a2414" stroke-width="1.5" stroke-linejoin="round"/><path d="M40 74l5 26 6-27 6 26 6-25 6 23 6-20 6 16" fill="none" stroke="#4a2414" stroke-width="1.3" stroke-linejoin="round"/><path d="M30 70l-12-7 M30 102l-12 6" stroke="#4a2414" stroke-width="3" stroke-linecap="round"/></g></g>
<rect y="103" width="360" height="7" fill="#120806"/>
<g fill="#0b0504" stroke="#ff9a3c" stroke-opacity="0.6" stroke-width="1.2" stroke-linejoin="round">
<circle cx="150" cy="61" r="6.5"/><path d="M137 104l2-22q2-10 11-10t11 10l2 22Z"/>
<path d="M125 76l12-3.5 12 3.5v13c0 8.5-5.5 13.5-12 16.5-6.5-3-12-8-12-16.5Z"/>
<circle cx="183" cy="61" r="6"/><path d="M170 104l6-27q1.5-6 7-6t7 6l6 27Z"/>
<path d="M199 104V54" stroke-width="1.6"/>
<circle cx="216" cy="63" r="6"/><path d="M205 104l2-21q1.5-9 9-9t9 9l2 21Z"/>
</g>
<g fill="none" stroke-linecap="round">
<ellipse cx="183" cy="52" rx="7.5" ry="2.3" stroke="#fff1d6" stroke-width="1.5"/>
<circle cx="199" cy="52" r="2.6" fill="#fff1d6" stroke="none"/>
<path d="M223 82l13-21" stroke="#fff1d6" stroke-width="2"/>
<path d="M137 84.5l-3.4 1.3v2.7c0 2.2 1.5 3.7 3.4 4.5 1.9-.8 3.4-2.3 3.4-4.5v-2.7Z M133 81.4a8.3 8.3 0 0 1 8 0 M144.4 84.8a8.3 8.3 0 0 1 0 8 M141 96.2a8.3 8.3 0 0 1-8 0 M129.6 92.8a8.3 8.3 0 0 1 0-8" stroke="#5fe0c8" stroke-width="1.2" stroke-opacity="0.95"/>
</g>
<g class="kb-sparks" fill="#ffb04a">
<circle cx="150" cy="98" r="1.2" style="--d:0s;--x:-6px"/><circle cx="172" cy="96" r="1" style="--d:1.1s;--x:5px"/><circle cx="196" cy="99" r="1.3" style="--d:2.3s;--x:-4px"/>
<circle cx="214" cy="97" r="1" style="--d:3.2s;--x:7px"/><circle cx="160" cy="100" r="0.9" style="--d:4.1s;--x:3px"/><circle cx="205" cy="100" r="1.1" style="--d:0.6s;--x:-8px"/>
<circle cx="120" cy="100" r="0.8" style="--d:1.8s;--x:-5px"/><circle cx="242" cy="99" r="0.9" style="--d:2.9s;--x:6px"/>
</g>
</svg>`;

export const SEASON_ART: Record<number, SeasonArt> = {
  1: { accent: '#ff9a3c', hi: '#ffc98a', deep: '#d9442c', banner: DEEP_BELLOWS },
};
