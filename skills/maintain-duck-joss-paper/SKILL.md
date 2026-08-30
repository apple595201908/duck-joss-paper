---
name: maintain-duck-joss-paper
description: Maintain, rebalance, restyle, test, or deploy the independent 鴨鴨燒紙錢 mobile web game. Use when working in the duck-joss-paper repository on Ghost Festival art, joss-paper throwing, furnace flare warnings, tap-versus-cooldown balance, responsive fullscreen behavior, README documentation, GitHub publishing, or Sites deployment. Do not use for the original 鴨鴨喝牛奶 project.
---

# Maintain Duck Joss Paper

Maintain the Ghost Festival limited-edition game without coupling it back to the milk game.

## Protect Project Separation

1. Resolve the current repository path before editing.
2. Work only in `鴨鴨燒紙錢遊戲專案` or its own checkout.
3. Never edit, commit, push, deploy, or retarget remotes for `鴨鴨喝牛奶遊戲專案`.
4. Before delivery, confirm the milk repository is still clean and at its original commit.
5. Treat shared mechanics as a tested behavioral contract, not a shared runtime dependency.

## Preserve Gameplay Invariants

- One pointer press or non-repeated Space keydown throws exactly one paper bundle.
- Holding the pointer or Space key must not generate repeated throws.
- Completing the paper stack wins when completion and flare happen on the same tap.
- Reaching the heat limit enters `flaring`; the fail result appears only after `FLARE_REACTION_FRAMES`.
- Pausing, losing focus, hiding the page, or rotating must not create phantom input.
- The displayed clock counts up from zero and freezes on success.
- Do not add visible bottom heat, progress, or rhythm meters unless the user explicitly requests them. Players judge danger from the furnace, flames, duck pose, warning color, and text.
- Keep normal play near 19–22 seconds, relaxed play near 30–40 seconds, expert high-risk play near 14–17 seconds, and reckless tapping as an early flare failure unless the user requests a new balance target.
- Keep the dedicated paper-supply card centered along the bottom during play, separated from the left-side flare warning. Its pile and percentage must derive from the same remaining-paper ratio.
- Keep the furnace visually dominant and the paper-supply card large enough to judge a final sprint at a glance.
- Preserve the furnace's Taiwanese red cylindrical form, with visibly worn red paint, scorched soot, and restrained rust/corrosion marks.
- Keep thrown paper on a visible arcing path into the furnace mouth; shrink and rotate it on entry, and preserve furnace-rim occlusion so it reads as going inside the bucket.
- Depict a flare as sustained tall flames rising from the furnace followed by dense smoke, not an explosion or radial shockwave.
- Keep the BGM original and synthesized in `src/game/audio.ts`. Do not add third-party recordings or samples without recording their exact license and source. Mute and pause must affect BGM and sound effects together.
- Treat the final 22% heat range as the narrow red danger zone and preserve its larger high-risk efficiency reward unless the user requests another balance target.

## Classify the Change

Before editing, classify the request:

- Visual-only: change assets, renderer composition, copy, color, animation, or responsive layout; keep `src/game/config.ts` values unchanged.
- Balance: change config or formulas and update cadence tests with explicit target ranges.
- Behavior: change input or state transitions and add regression tests first or alongside the implementation.
- Publishing: verify quality, commit exact sources, push the independent GitHub repository, then deploy the bound Sites project.

## Work with Visual Assets

Use generated raster art for new illustrations or sprite sheets. Inspect dimensions and transparency before integration.

Current asset contracts:

- `public/assets/joss-duck-poses.png`: 1536×1024, 3 columns × 2 rows, 512×512 cells.
- `public/assets/joss-furnace-states.png`: 1278×1230, 2 columns × 2 rows, 639×615 cells.
- `public/assets/ghost-festival-background.png`: background plate without gameplay characters.
- Sprite coordinates live in `src/assets/*.json`; update metadata whenever the bitmap grid changes.

Keep the illustrated duck's aspect ratio. Do not stretch a sprite to fit an arbitrary box. Prefer cover cropping for the background and contained placement for characters or props.

## Modify the Correct Layer

- Change numeric balance in `src/game/config.ts`.
- Change pure formulas in `src/game/metrics.ts`.
- Change state transitions in `src/game/simulation.ts` and types in `src/game/model.ts`.
- Change Canvas composition in `src/game/renderer.ts`.
- Change controls, storage, audio coordination, or React UI in `src/ui/DuckJossPaperGame.tsx`.
- Change synthesized music voices, arrangement, mix, or SFX in `src/game/audio.ts`; keep audio generation independent of the deterministic simulation.
- Change pointer and keyboard semantics in `src/game/input.ts`.
- Change full-screen layout in `app/globals.css`.
- Change metadata and social presentation in `app/layout.tsx` and `public/og.png`.

Avoid introducing network or server state into the deterministic simulation.

## Verify Every Change

Run from the joss-paper project root:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

For audio changes, keep `tests/audio.test.ts` passing so generated channels remain finite, stereo, audible, and peak-safe.

For balance changes, ensure the simulation tests still cover:

- reckless cadence fails before half progress;
- normal cadence finishes in 19–22 seconds;
- relaxed cadence finishes in 30–40 seconds;
- expert high-risk cadence finishes in 14–17 seconds;
- novice minus expert time exceeds 18 seconds;
- percentage calculations stay within 0–100;
- the flare reaction precedes the fail scene.

When changing responsive CSS or Canvas composition, start the local server and confirm the page compiles. Only perform interactive browser inspection when the user requests browser testing.

## Publish Safely

Publishing requires an explicit user request.

1. Confirm tests, typecheck, lint, and build pass.
2. Confirm `origin` points to `apple595201908/duck-joss-paper`, not the milk repository.
3. Commit the finished source with a clear message.
4. Push GitHub.
5. Package and deploy the Sites project specified by `.openai/hosting.json`.
6. Confirm public access and deployment status.
7. Provide both the GitHub URL and playable URL.
8. Recheck that the original milk repository was not changed.
