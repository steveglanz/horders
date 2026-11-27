# CP2 feel kit shots (27 Nov 2026)

`flash-knock-shards-390.jpg`: a Kiln t4 room at 390x844 in the 3D look, cropped round the first pack. Left to right:
no hit; the white flash (forced on, so all four Husks show it at once; a real hit flashes one foe for 70-80 ms);
the knockback push (forced to the heavy hit's 11 units); clay shards from three kills and a big kill, lying on the floor.

Clips of every hit size: `node tools/feelclips.cjs dist <outDir>` (after `npm run build`). The container renders with
software GL at a low frame rate, so clips from it show what each size does, not its real timing: judge hit-stop on a
phone, with `?feelstop=<ms>` to try other lengths.
