// Look test: label the three clips A, B, C in a random order and build a side-by-side for a blind pick.
// Usage: node docs/art/look-test/blind.cjs <clipsDir> <outDir> [keyFile]
//   clipsDir holds diorama.mp4, pixel.mp4 and today.mp4 (from clips.cjs and today.cjs).
//   env KEY="A=today,B=diorama,C=pixel" fixes the order; otherwise it is shuffled. The key is written to keyFile
//   (default <outDir>/../KEY.md), never into outDir, so the folder testers see doesn't give it away.
const { execFileSync } = require('child_process');
const crypto = require('crypto'); const fs = require('fs'); const path = require('path');
const src = path.resolve(process.argv[2] || 'looktest-out'); const out = path.resolve(process.argv[3] || 'blind');
const keyFile = path.resolve(process.argv[4] || path.join(out, '..', 'KEY.md'));
fs.mkdirSync(out, { recursive: true });
let order = ['diorama', 'pixel', 'today'];
if (process.env.KEY) order = process.env.KEY.split(',').map((p) => p.split('=')[1]);
else for (let i = order.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [order[i], order[j]] = [order[j], order[i]]; }
const L = ['A', 'B', 'C'];
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]);
order.forEach((name, i) => fs.copyFileSync(path.join(src, `${name}.mp4`), path.join(out, `clip-${L[i]}.mp4`)));
// Side by side at phone size each (390 x 844), with a letter on each.
const label = (i) => `[${i}:v]scale=390:844,drawtext=fontfile=${font}:text=${L[i]}:x=16:y=16:fontsize=44:fontcolor=0xede3cf:box=1:boxcolor=0x120d0b@0.8:boxborderw=10[v${i}]`;
ff(['-i', path.join(out, 'clip-A.mp4'), '-i', path.join(out, 'clip-B.mp4'), '-i', path.join(out, 'clip-C.mp4'),
  '-filter_complex', `${[0, 1, 2].map(label).join(';')};[v0][v1][v2]hstack=3[o]`, '-map', '[o]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-movflags', '+faststart', path.join(out, 'side-by-side.mp4')]);
// Still sheets for a first read from people (or AI testers) who can't play video: 6 frames per clip.
for (const l of L) ff(['-i', path.join(out, `clip-${l}.mp4`), '-vf', "select='eq(n\\,60)+eq(n\\,128)+eq(n\\,180)+eq(n\\,252)+eq(n\\,312)+eq(n\\,400)',scale=390:844,tile=3x2", '-frames:v', '1', '-vsync', '0', path.join(out, `frames-${l}.jpg`)]);
fs.writeFileSync(keyFile, `# Look test key (keep away from testers)\n\n${order.map((n, i) => `- ${L[i]} = ${n}`).join('\n')}\n`);
console.log('labelled', out, '; key in', keyFile);
