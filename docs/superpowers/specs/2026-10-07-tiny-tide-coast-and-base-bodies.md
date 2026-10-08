# Tiny Tide: the coast and base bodies

Date: 2026-10-07. Status: built. Sub-project 2 of the evolution core
([evolution core spec](2026-10-01-tiny-tide-evolution-core-design.md)), with two
owner requests of the same day.

## Owner requests

1. Land: "one island that amphibious critters will be able to make use of and a
   continent that most land dwellers will end up with."
2. "Each major evolution should remove everything from your critter": parts that
   the new form does not allow stayed on (for example legs at the Cosmic size).
3. "Evolutions should give distinct body shapes": each major evolution gives a
   different base.
4. A to-do: low frame rate on phones.

The owner said these decisions do not need their review. The decisions below
were made by the implementer.

## Decisions

| Topic | Decision | Reason |
| --- | --- | --- |
| Island place | Centre (−130, −130), radius 77 | Inside the size-1 square, clear of the reef mesh (±65), the size-0 view and the Clawmother lairs. Reef Tyrant lairs that fall on it turn to the next diagonal. |
| Island shape | Dome, beach, shallow shelf (depth < 2.5 L of a size-1 body), cliff with slope 2.5 | The size-1 square is small (±200) and the water is 85 deep: a gentle island does not fit. |
| Continent place | Toward +x, waterline near x 500 | Past the size-1 view, inside the size-2 reach, about 43 % of the size-3 square. |
| Continent shape | Slope .6 to about 110, then slope .1 to about 160 | The large bodies' ground margins must stay over the water level. |
| Collision | Local slope and curvature bounds (`Terrain.boundsAt`) | Global bounds of the cliff would make every open-sea scan coarse. |
| Land band | The body's lowest point within .6 L of dry ground | As spec §3 says; a tall walker's back was "air". |
| Land food | Five species with a `zone`, spawned after all others | Land plans cannot reach sea food; no older spawn moves. |
| Drawing | Rings without the island; a fine polar island mesh over them | One fine ring 0 would add about 75 000 triangles; the island mesh is 24 000. |
| Evolution | The new plan's base body; the mouth stays; all other parts come off and their credit returns | Requests 2 and 3. The mouth keeps the diet choice simple. |
| Unaffordable base | The minimal base: mouth and required parts | A run after a faint can be short of DNA. |
| Space walkers | Star crawler and Star walker ban legs | Request 2 named legs in space. |
| Phones | Coarse pointer: pixel ratio 1.3, hard shadows, no reef or food shadows; dynamic resolution everywhere | The cost was in drawing (see the game guide, "Phone quality"). |

## Not in scope

- New land movement modes (all land plans use the existing ground movement).
- New Blender art for land food (the land food reuses food GLBs with tints).
- Land combat species.
