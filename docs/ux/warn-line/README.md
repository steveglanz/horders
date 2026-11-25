# Warnings never cover the fight on phones (design, 25 Nov)

Design's rule: while a warning runs, its banner must not cover the fight. On phones every warning banner is now a
slim strip just under the top row, or under the target frame when one shows. The title and its line sit side by side,
and the line shrinks to fit, down to 10px. A line that still doesn't fit at 320px wraps to a second line at 11px.
Other screens are unchanged.

"Warnings" means every banner a cast start shows (Glare, Brand, Anvilfall, the Ebb...), wave-shape and arena-event
warnings, and "Swap tanks!".

- `p320-3-in-shadow-warn`, `l568-3-in-shadow-warn`: a Glare on the Glarewell Halls map. Compare `docs/ux/glarewell-halls/`, where the two-line card covered the upper pillars.
- `p320-TheLongNight`, `p320-ThinIce`, `l568-ThinIce`: the longest lines. Thin Ice's last clause ("and takes more damage") is cut at 320px.
