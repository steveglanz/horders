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

/**
 * The Cold Hearth (docs/design/season.md; brief: horders/design/season3-cold-hearth-brief.md). One hero alone in the
 * Coldmarrow's dark, holding up a Hearthcoal whose light is the only warm colour in the scene, while Nhevra's frosted
 * hearth looms at the edge of the light with its cold flame and eyes, and rime creeps along the floor toward the coal.
 * The coal is the Hearthkeeper set's flame (SET_ICON.hearthkeeper), the set players chase in the Coldmarrow this season.
 * The coal pulses slowly and frost falls, both stopping for Battery saver and for reduced motion (index.html).
 */
const COLD_HEARTH = `<svg class="kart" viewBox="0 0 360 110" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs>
<linearGradient id="kbNight" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#03060c"/><stop offset="1" stop-color="#0c1628"/></linearGradient>
<radialGradient id="kbCold" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#7fd0ff" stop-opacity="0.42"/><stop offset="1" stop-color="#7fd0ff" stop-opacity="0"/></radialGradient>
<radialGradient id="kbCoal" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff1d6" stop-opacity="0.95"/><stop offset="0.22" stop-color="#ffb36b" stop-opacity="0.7"/><stop offset="0.55" stop-color="#ff8a3d" stop-opacity="0.22"/><stop offset="1" stop-color="#ff8a3d" stop-opacity="0"/></radialGradient>
<radialGradient id="kbPool" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb36b" stop-opacity="0.45"/><stop offset="1" stop-color="#ffb36b" stop-opacity="0"/></radialGradient>
</defs>
<rect width="360" height="110" fill="url(#kbNight)"/>
<ellipse cx="300" cy="76" rx="96" ry="56" fill="url(#kbCold)"/>
<path d="M0 0H360V5L355 14L350 5L344 15L339 5L334 23L328 5L322 20L317 5L312 10L307 5L302 22L298 5L294 20L291 5L288 24L285 5L282 11L278 5L274 17L270 5L266 16L263 5L258 11L253 5L248 13L243 5L240 21L237 5L234 16L230 5L226 12L222 5L218 12L213 5L210 12L207 5L202 19L197 5L192 12L188 5L184 10L181 5L178 13L175 5L172 12L168 5L164 14L161 5L157 13L153 5L148 24L143 5L138 20L132 5L128 12L125 5L120 13L114 5L110 14L105 5L102 15L99 5L94 12L90 5L86 14L83 5L80 15L77 5L73 23L69 5L64 19L59 5L56 19L53 5L48 21L42 5L38 11L34 5L30 15L26 5L22 17L18 5L12 15L7 5L4 17L0 5Z" fill="#0e1a2e" stroke="#8fb8ff" stroke-opacity="0.4" stroke-width="1" stroke-linejoin="round"/>
<path d="M256 110V64q8-6 8-20h12v12q24-10 48 0V44h12q0 14 8 20v46Z" fill="#0f1828" stroke="#3c4c68" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M276 56q24-10 48 0" fill="none" stroke="#d8e8f6" stroke-opacity="0.55" stroke-width="1.4"/>
<path d="M264 44h12 M324 44h12" stroke="#eaf6ff" stroke-opacity="0.85" stroke-width="2.4" stroke-linecap="round"/>
<path d="M268 110V86q32-22 64 0v24Z" fill="#04060c" stroke="#1a2238" stroke-width="1.5"/>
<ellipse cx="300" cy="100" rx="26" ry="14" fill="url(#kbCold)"/>
<path d="M290 110q-2-14 6-22-1 9 4 12 1-11 8-18-1 14 3 18 3-6 7-6-4 6-2 16Z" fill="#7fd0ff" fill-opacity="0.75"/>
<path d="M296 110q0-9 5-14 0 6 3 8 1-5 4-8 0 8 2 14Z" fill="#f2fbff" fill-opacity="0.85"/>
<path d="M278 62l8 4 8-2 M322 62l-8 4-8-2" fill="none" stroke="#7fd0ff" stroke-width="1.4" stroke-linecap="round"/>
<circle cx="286" cy="70" r="2.2" fill="#bfe6ff"/><circle cx="314" cy="70" r="2.2" fill="#bfe6ff"/>
<path d="M266 57l2 7 2-7 M330 57l2 7 2-7 M288 52.5l1.6 6 1.6-6 M310 52.5l1.6 6 1.6-6" fill="#d8e8f6" fill-opacity="0.75"/>
<rect y="103" width="360" height="7" fill="#081020"/>
<path d="M0 103.5h360" stroke="#8fb8ff" stroke-opacity="0.3" stroke-width="1"/>
<path d="M256 103.5h-68" stroke="#bfe6ff" stroke-opacity="0.45" stroke-width="1.2" stroke-linecap="round"/>
<path d="M247 104l2.8-9 2.8 9Z M240 104l2.5-8 2.5 8Z M229 104l2-7 2 7Z M219 104l2-5.5 2 5.5Z M209 104l1.6-4.5 1.6 4.5Z M200 104l1.3-3.4 1.3 3.4Z M192 104l1-2.2 1 2.2Z" fill="#bfe6ff" fill-opacity="0.7"/>
<g class="ch-coal"><ellipse cx="146" cy="104" rx="84" ry="20" fill="url(#kbPool)"/><circle cx="152" cy="47" r="50" fill="url(#kbCoal)"/></g>
<g fill="#070a12" stroke="#ffb36b" stroke-opacity="0.7" stroke-width="1.2" stroke-linejoin="round">
<path d="M117 104l4-27q2-12 9-14 3 0 5 1l6 3-2 4-4-1 3 8 4 26Z"/>
<circle cx="130" cy="60" r="6.5"/>
</g>
<path d="M135 68l9-9 5-8" fill="none" stroke="#070a12" stroke-width="4" stroke-linecap="round"/>
<path d="M135 68l9-9 5-8" fill="none" stroke="#ffb36b" stroke-opacity="0.6" stroke-width="1" stroke-linecap="round" transform="translate(0.8 -0.6)"/>
<g transform="translate(141.2 35.5) scale(0.9)"><path d="M12 3.5c2.2 2.8 3.6 4.6 3.6 7a3.6 3.6 0 0 1-7.2 0c0-2.4 1.4-4.2 3.6-7Z" fill="#ffc98a" stroke="#fff1d6" stroke-width="1.1"/><path d="M12 9.5c.9 1.2 1.4 2 1.4 3a1.4 1.4 0 0 1-2.8 0c0-1 .5-1.8 1.4-3Z" fill="#fff6e6"/></g>
<g class="ch-frost" fill="#e6f6ff">
<circle cx="40" cy="14" r="1" style="--d:0s;--x:6px"/><circle cx="92" cy="10" r="0.8" style="--d:1.4s;--x:-4px"/><circle cx="178" cy="16" r="1.1" style="--d:2.6s;--x:5px"/>
<circle cx="214" cy="12" r="0.9" style="--d:3.5s;--x:-6px"/><circle cx="66" cy="18" r="0.8" style="--d:4.4s;--x:4px"/><circle cx="236" cy="14" r="1" style="--d:0.8s;--x:-3px"/>
<circle cx="120" cy="12" r="0.7" style="--d:2s;--x:7px"/><circle cx="20" cy="20" r="0.9" style="--d:3s;--x:-5px"/>
</g>
</svg>`;

/**
 * The Slag Moon (docs/design/season.md; no brief, palette from SEASONS[3]). Grandmother Slag's molten moon hangs over the
 * Glarewell, the sunken observatory, dripping slag, and its glare pours across the floor. One hero has ducked into a
 * pillar's shadow (the Glarewell's Glare: hide behind a pillar) while the observatory's great lens points up at the moon
 * through the open slit of its dome. Slag Gold moon with Pour Crimson cracks and Moon Ash maria. The moon's halo
 * pulses slowly and the drips fall, both stopping for Battery saver and for reduced motion (index.html).
 */
const SLAG_MOON = `<svg class="kart" viewBox="0 0 360 110" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs>
<linearGradient id="kbDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a0510"/><stop offset="1" stop-color="#26111c"/></linearGradient>
<radialGradient id="kbMoon" cx="0.42" cy="0.38" r="0.62"><stop offset="0" stop-color="#fff0c2"/><stop offset="0.45" stop-color="#ffc861"/><stop offset="0.85" stop-color="#e8743a"/><stop offset="1" stop-color="#ff6a8a"/></radialGradient>
<radialGradient id="kbHalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffc861" stop-opacity="0.5"/><stop offset="0.5" stop-color="#ff8a5a" stop-opacity="0.16"/><stop offset="1" stop-color="#ff6a8a" stop-opacity="0"/></radialGradient>
<linearGradient id="kbGlare" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc861" stop-opacity="0.34"/><stop offset="1" stop-color="#ffc861" stop-opacity="0.1"/></linearGradient>
</defs>
<rect width="360" height="110" fill="url(#kbDusk)"/>
<g fill="#c9c2b8"><circle cx="30" cy="20" r="0.7"/><circle cx="74" cy="12" r="0.9"/><circle cx="120" cy="26" r="0.6"/><circle cx="168" cy="10" r="0.8"/><circle cx="206" cy="30" r="0.6"/><circle cx="330" cy="16" r="0.8"/><circle cx="346" cy="44" r="0.6"/><circle cx="12" cy="46" r="0.6"/></g>
<circle class="sm-moon" cx="270" cy="60" r="50" fill="url(#kbHalo)"/>
<path d="M258 68 L118 104 H244 L288 76 Z" fill="url(#kbGlare)"/>
<g transform="translate(270 60) scale(0.88) translate(-268 -40)">
<circle cx="268" cy="40" r="25" fill="url(#kbMoon)"/>
<path d="M254 30a6 5 0 1 0 12 0a6 5 0 1 0-12 0Z M272 46a4.5 3.5 0 1 0 9 0a4.5 3.5 0 1 0-9 0Z M262 52a3 2.4 0 1 0 6 0a3 2.4 0 1 0-6 0Z" fill="#c9c2b8" fill-opacity="0.55"/>
<path d="M246 44q6 2 8 8 M280 26q4 6 10 7 M266 22l2 7 5 3" fill="none" stroke="#ff6a8a" stroke-opacity="0.75" stroke-width="1.2" stroke-linecap="round"/>
<path d="M258 62.5q1 5 0 7a1.6 1.6 0 0 0 3 0q-1-3 0-7 M270 64.8q.8 7 0 10a1.8 1.8 0 0 0 3.4 0q-1-4 0-10.4 M281 61q.6 4 0 6a1.4 1.4 0 0 0 2.6 0q-.6-2.4 0-6.6" fill="#ffc861" stroke="#ff8a5a" stroke-width="0.6"/>
<g class="sm-drips" fill="#ffcf6e"><circle cx="259.5" cy="74" r="1.4" style="--d:0s"/><circle cx="271.7" cy="79" r="1.6" style="--d:1.3s"/><circle cx="282.3" cy="71" r="1.2" style="--d:2.4s"/></g>
</g>
<path d="M18 104V70a52 44 0 0 1 104 0v34Z" fill="#120a14" stroke="#4a3048" stroke-width="1.5"/>
<path d="M64 26.5 80 26.5 76 104H68Z" fill="#2c1626"/><path d="M64 26.5 68 104 M80 26.5 76 104" stroke="#ffc861" stroke-opacity="0.35" stroke-width="1"/>
<path d="M36 46q8 10 8 58 M104 46q-8 10-8 58" fill="none" stroke="#2a1a2a" stroke-width="1.5"/>
<path d="M66 72l42-30 5 6-40 31Z" fill="#1c1220" stroke="#c9c2b8" stroke-opacity="0.6" stroke-width="1.2" stroke-linejoin="round"/>
<ellipse cx="111" cy="45" rx="3.6" ry="5" transform="rotate(-36 111 45)" fill="#fff0c2" stroke="#ffc861" stroke-width="1"/>
<path d="M68 78l-6 26 M74 76l4 28" stroke="#2a1a2a" stroke-width="2"/>
<rect y="103" width="360" height="7" fill="#120810"/>
<path d="M0 103.5h360" stroke="#ffc861" stroke-opacity="0.22" stroke-width="1"/>
<path d="M118 104 L244 104" stroke="#ffcf6e" stroke-opacity="0.6" stroke-width="1.4"/>
<path d="M196 104V62h12v42Z" fill="#160c16" stroke="#ffc861" stroke-opacity="0.55" stroke-width="1"/>
<path d="M193 62h18v-4h-18Z M193 104h18v-3h-18Z" fill="#1e1220" stroke="#c9c2b8" stroke-opacity="0.5" stroke-width="0.8"/>
<path d="M196 104 H138 L196 79Z" fill="#05030a" fill-opacity="0.85"/>
<g fill="#07040a" stroke="#ffc861" stroke-opacity="0.5" stroke-width="1.1" stroke-linejoin="round">
<path d="M170 104l3-18q2-9 8-10l6 1 4 6-3 3-4-2 2 6 2 14Z"/>
<circle cx="182" cy="69" r="5.6"/>
</g>
<path d="M190 82l6-6" stroke="#07040a" stroke-width="3" stroke-linecap="round"/>
</svg>`;

export const SEASON_ART: Record<number, SeasonArt> = {
  1: { accent: '#ff9a3c', hi: '#ffc98a', deep: '#d9442c', banner: DEEP_BELLOWS },
  2: { accent: '#8fb8ff', hi: '#d8f4ff', deep: '#3f62b0', banner: COLD_HEARTH },
  3: { accent: '#ffc861', hi: '#ffe6a8', deep: '#a8522a', banner: SLAG_MOON },
};
