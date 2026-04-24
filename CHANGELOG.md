---
title: CHANGELOG — Midway Mayhem
updated: 2026-04-23
status: current
domain: technical
---

# Changelog

All notable changes documented per [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). This project follows [Semantic Versioning 2.0.0](https://semver.org/).

## [0.2.8](https://github.com/arcade-cabinet/midway-mayhem/compare/midway-mayhem-v0.2.7...midway-mayhem-v0.2.8) (2026-04-24)


### Fixed

* close every memory/loop/race hazard found in the post-spike audit ([#310](https://github.com/arcade-cabinet/midway-mayhem/issues/310)) ([8f83afe](https://github.com/arcade-cabinet/midway-mayhem/commit/8f83afeb98b6946daf7348f5a3ddd1a143589088))
* **e2e:** raise nightly spec test.setTimeout for CI swiftshader ([#301](https://github.com/arcade-cabinet/midway-mayhem/issues/301)) ([c56aac4](https://github.com/arcade-cabinet/midway-mayhem/commit/c56aac481b9116be5c770a78a6c132955ddf9445))
* honk→scare bridge + real-GPU playwright + hand-authored cockpit ([#308](https://github.com/arcade-cabinet/midway-mayhem/issues/308)) ([f425624](https://github.com/arcade-cabinet/midway-mayhem/commit/f425624c87c3a331b3049308b33fa9bfb535232b))


### Documentation

* **prd:** memory-spike fix plan (blocks browser tests) ([#309](https://github.com/arcade-cabinet/midway-mayhem/issues/309)) ([4faf2d2](https://github.com/arcade-cabinet/midway-mayhem/commit/4faf2d2bd995d51a2408232b6c0a51911405d2a2))

## [0.2.7](https://github.com/arcade-cabinet/midway-mayhem/compare/midway-mayhem-v0.2.6...midway-mayhem-v0.2.7) (2026-04-24)


### Fixed

* **e2e:** extend CI modal-mount timeouts + shorten soak duration ([#298](https://github.com/arcade-cabinet/midway-mayhem/issues/298)) ([86bdb0b](https://github.com/arcade-cabinet/midway-mayhem/commit/86bdb0b767c55e1e960bd58bb5bdfcaeb475c8b8))
* **test:** track archetype baselines @ 1280×720 (match browser viewport) ([#299](https://github.com/arcade-cabinet/midway-mayhem/issues/299)) ([ae94e3f](https://github.com/arcade-cabinet/midway-mayhem/commit/ae94e3f532160dd767be3e7efac54f20f72b0d3e))

## [0.2.6](https://github.com/arcade-cabinet/midway-mayhem/compare/midway-mayhem-v0.2.5...midway-mayhem-v0.2.6) (2026-04-24)


### Fixed

* **e2e:** waitFor state:'attached' instead of toBeVisible on modal elements ([#296](https://github.com/arcade-cabinet/midway-mayhem/issues/296)) ([7823041](https://github.com/arcade-cabinet/midway-mayhem/commit/7823041d87a63bcd031db216ffaaae3166c1968b))

## [0.2.5](https://github.com/arcade-cabinet/midway-mayhem/compare/midway-mayhem-v0.2.4...midway-mayhem-v0.2.5) (2026-04-24)


### Fixed

* **e2e:** force-click start-button in nightly specs (R3F canvas defeats stability check) ([#293](https://github.com/arcade-cabinet/midway-mayhem/issues/293)) ([5b2ee03](https://github.com/arcade-cabinet/midway-mayhem/commit/5b2ee03af41f5e9f3f7e89d1eb30663b2999af87))

## [0.2.4](https://github.com/arcade-cabinet/midway-mayhem/compare/midway-mayhem-v0.2.3...midway-mayhem-v0.2.4) (2026-04-24)


### Fixed

* **e2e:** adopt ?nonameonboard=1 in nightly specs + optimize stability-soak ([#292](https://github.com/arcade-cabinet/midway-mayhem/issues/292)) ([3136c93](https://github.com/arcade-cabinet/midway-mayhem/commit/3136c93e6ddd9f18281e2b15091b0ef25fe2d6e9))
* **e2e:** scale stability-soak fps + distance thresholds for CI swiftshader ([#289](https://github.com/arcade-cabinet/midway-mayhem/issues/289)) ([87fb4e7](https://github.com/arcade-cabinet/midway-mayhem/commit/87fb4e756edfa49d7b9de112b2c0f951f4c97d42))
* **ui:** NameOnboardingModal respects ?autoplay=1 (unblock nightly specs) ([#290](https://github.com/arcade-cabinet/midway-mayhem/issues/290)) ([e8cdada](https://github.com/arcade-cabinet/midway-mayhem/commit/e8cdada7e2e9eb00c57dac5bdc33219ddf3aec52))

## [0.2.3](https://github.com/arcade-cabinet/midway-mayhem/compare/midway-mayhem-v0.2.2...midway-mayhem-v0.2.3) (2026-04-24)


### Fixed

* **hud:** ErrorModal returns null when no errors (unblocks nightly e2e) ([#286](https://github.com/arcade-cabinet/midway-mayhem/issues/286)) ([e9ead12](https://github.com/arcade-cabinet/midway-mayhem/commit/e9ead1279686cf99d6be18f52199084004561a1d))

## [0.2.2](https://github.com/arcade-cabinet/midway-mayhem/compare/midway-mayhem-v0.2.1...midway-mayhem-v0.2.2) (2026-04-24)


### Fixed

* **ci:** bump CI browser test timeout 120s → 240s (Steering overruns) ([#284](https://github.com/arcade-cabinet/midway-mayhem/issues/284)) ([fe20af1](https://github.com/arcade-cabinet/midway-mayhem/commit/fe20af1d6554b327d49376c12a3e28281d865808))
* **e2e:** add missing pnpm e2e:stability-soak script ([#282](https://github.com/arcade-cabinet/midway-mayhem/issues/282)) ([faab9f7](https://github.com/arcade-cabinet/midway-mayhem/commit/faab9f71709a32d47a494a4c2e928288eef0673d))

## [0.2.1](https://github.com/arcade-cabinet/midway-mayhem/compare/midway-mayhem-v0.2.0...midway-mayhem-v0.2.1) (2026-04-24)


### Added

* **A-DECOR:** triangle-pennant bunting strung from dome rafters ([#258](https://github.com/arcade-cabinet/midway-mayhem/issues/258)) ([7bb8993](https://github.com/arcade-cabinet/midway-mayhem/commit/7bb89935cb0daa654cdc3da674ed1c39096569cd))
* **A-DESC-2:** StartPlatform hung from dome cap with visible wire struts ([#237](https://github.com/arcade-cabinet/midway-mayhem/issues/237)) ([b9f5a83](https://github.com/arcade-cabinet/midway-mayhem/commit/b9f5a83915c95d5fd0490ebf6461aa4fa9a30b81))
* **A-DESC-4:** cockpit pitch-look-down hook — sells the fall ([#242](https://github.com/arcade-cabinet/midway-mayhem/issues/242)) ([d70cb7b](https://github.com/arcade-cabinet/midway-mayhem/commit/d70cb7b4af8981102954e8fdc56e926af3b5edaa))
* **A-DESC-5:** 2000-instance crowd silhouettes fill dome seats ([#247](https://github.com/arcade-cabinet/midway-mayhem/issues/247)) ([c78d287](https://github.com/arcade-cabinet/midway-mayhem/commit/c78d2870a7f75474f8f73470ed443134bd0f1eb5))
* **A-OBS:** themed GLB obstacles replace inline boxGeometry ([#244](https://github.com/arcade-cabinet/midway-mayhem/issues/244)) ([b08e5cb](https://github.com/arcade-cabinet/midway-mayhem/commit/b08e5cb89d0025c73f1934f2b6e8710cabb982a8))
* **A-TRACK-MAT:** PBR carnival-plank track surface ([#241](https://github.com/arcade-cabinet/midway-mayhem/issues/241)) ([6b7fe5f](https://github.com/arcade-cabinet/midway-mayhem/commit/6b7fe5f68cb8e2827f0c4f6145814b4e914e7862))
* **A-TRACK-PITCH-SMOOTH:** smoothstep eases deltaPitch across piece boundaries ([#246](https://github.com/arcade-cabinet/midway-mayhem/issues/246)) ([26ccce0](https://github.com/arcade-cabinet/midway-mayhem/commit/26ccce0dbf3234faa6418b6cdbcdf9dbfb60a3ce))
* **A-TRACK-VIS:** isolated procedural-track screenshot package + diff gate ([#229](https://github.com/arcade-cabinet/midway-mayhem/issues/229)) ([638f963](https://github.com/arcade-cabinet/midway-mayhem/commit/638f963dbf5d7e6bf09531dd68b23402c41d513f))
* **A-ZONE-VIS:** per-zone visual identity + 4-zone screenshot gate ([#249](https://github.com/arcade-cabinet/midway-mayhem/issues/249)) ([794c919](https://github.com/arcade-cabinet/midway-mayhem/commit/794c9195342c224b3f811622043028b641a3db94))
* **A2:** hood fills lower third of POV (PRQ Track A1.2) ([#217](https://github.com/arcade-cabinet/midway-mayhem/issues/217)) ([f17db23](https://github.com/arcade-cabinet/midway-mayhem/commit/f17db23f611e9033de427c26c1a4e03cd72c2366))
* **B1:** 6-step tutorial flow + drop-in intro for step 6 ([#251](https://github.com/arcade-cabinet/midway-mayhem/issues/251)) ([268d596](https://github.com/arcade-cabinet/midway-mayhem/commit/268d5969debabb59cf5c5ee52ecb848682114679))
* **B2:** pause UX — PAUSED overlay + mobile pause button (PRQ) ([#218](https://github.com/arcade-cabinet/midway-mayhem/issues/218)) ([6f8a3f2](https://github.com/arcade-cabinet/midway-mayhem/commit/6f8a3f29b921ef2c9af437f71f2c1ece54736a04))
* **B3:** discrete swipe → lane change (ditch continuous drag steering) ([#238](https://github.com/arcade-cabinet/midway-mayhem/issues/238)) ([5fbda60](https://github.com/arcade-cabinet/midway-mayhem/commit/5fbda606344249b23d01d7802db10c3dada8ade4))
* **B4:** barker-honk registers combo event + multiplier (PRQ B4) ([#223](https://github.com/arcade-cabinet/midway-mayhem/issues/223)) ([ebf4ce8](https://github.com/arcade-cabinet/midway-mayhem/commit/ebf4ce8cf1ea2d3dbe16159a3dca6fc41a6ebc2d))
* **B6:** explicit ?daily=1 URL flag overrides ?practice=1 (PRQ B6) ([#227](https://github.com/arcade-cabinet/midway-mayhem/issues/227)) ([4487ad7](https://github.com/arcade-cabinet/midway-mayhem/commit/4487ad7eaedbe3eac3cdd17cb36aede0b344a36e))
* **C1+C-DESCENT-AMBIENCE:** wire audio end-to-end + descent-depth crowd ambience ([#245](https://github.com/arcade-cabinet/midway-mayhem/issues/245)) ([a62ee82](https://github.com/arcade-cabinet/midway-mayhem/commit/a62ee82f2641ded4497dd5f0d99b780b74d730a9))
* **C2+C3+C4:** per-zone SFX palette + positional crowd + music stingers ([#269](https://github.com/arcade-cabinet/midway-mayhem/issues/269)) ([c7cc793](https://github.com/arcade-cabinet/midway-mayhem/commit/c7cc793b45aed22d0fb53738b785df75a0713151))
* **cockpit:** Phase 1 Blender blueprint — 32 primitives, materials, cameras ([#137](https://github.com/arcade-cabinet/midway-mayhem/issues/137)) ([7a0a1ad](https://github.com/arcade-cabinet/midway-mayhem/commit/7a0a1add4e81a5fbdabf5952e125e5f0987a8121))
* **cockpit:** Phase 2a — type the blueprint + import it into config ([#138](https://github.com/arcade-cabinet/midway-mayhem/issues/138)) ([5316457](https://github.com/arcade-cabinet/midway-mayhem/commit/5316457ba97523e10397aa05e165186de85b7ff3))
* **cockpit:** Phase 2b — blueprint-driven renderer, hood no longer swallows viewport ([#139](https://github.com/arcade-cabinet/midway-mayhem/issues/139)) ([20129b4](https://github.com/arcade-cabinet/midway-mayhem/commit/20129b412bc869959aacf027edb00dab72e50560))
* **cockpit:** Phase 3 — body roll, yaw lean, and engine idle bob ([#142](https://github.com/arcade-cabinet/midway-mayhem/issues/142)) ([f37a008](https://github.com/arcade-cabinet/midway-mayhem/commit/f37a0081ea28de29934c7bb29bdc3002ae4ef09f))
* **cockpit:** Phase 3 — clickable horn cap with squish animation ([#146](https://github.com/arcade-cabinet/midway-mayhem/issues/146)) ([3b54f05](https://github.com/arcade-cabinet/midway-mayhem/commit/3b54f053ea0b4fa26c94be55934f65447393559e))
* **cockpit:** Phase 3 — crash-shake channel in useCockpitFeel ([#147](https://github.com/arcade-cabinet/midway-mayhem/issues/147)) ([928248f](https://github.com/arcade-cabinet/midway-mayhem/commit/928248fd744d4c98a5dc0e5af97bf174bd69e8d5))
* **cockpit:** Phase 3 — drei MeshReflectorMaterial rear-view mirror ([#144](https://github.com/arcade-cabinet/midway-mayhem/issues/144)) ([63635e9](https://github.com/arcade-cabinet/midway-mayhem/commit/63635e9b601c4ccce9a9f084f7faf23ad8756cc5))
* **cockpit:** Phase 3 — headlight spotlights piercing the fog ([#145](https://github.com/arcade-cabinet/midway-mayhem/issues/145)) ([5a3fd85](https://github.com/arcade-cabinet/midway-mayhem/commit/5a3fd85181d28b8232d2653c5d25387b6dce66e4))
* **cockpit:** Phase 3 — spinning flower ornament + live LAUGHS/FUN needles ([#143](https://github.com/arcade-cabinet/midway-mayhem/issues/143)) ([5adefd5](https://github.com/arcade-cabinet/midway-mayhem/commit/5adefd57be3c8066cfa65564e6861b0d91ffa645))
* **cockpit:** Phase 3 — steering wheel spins with steer input ([#148](https://github.com/arcade-cabinet/midway-mayhem/issues/148)) ([4c47d41](https://github.com/arcade-cabinet/midway-mayhem/commit/4c47d418279e1efcbf54d929df261de10eb553cc))
* **cockpit:** Phase 4 — pin visual baselines + pixel-diff regression gate ([#149](https://github.com/arcade-cabinet/midway-mayhem/issues/149)) ([20f1815](https://github.com/arcade-cabinet/midway-mayhem/commit/20f1815a4abb012d36a5e3dfae81e192fc36a742))
* **D1:** player name onboarding on first launch (PRQ D1) ([#224](https://github.com/arcade-cabinet/midway-mayhem/issues/224)) ([6bbbba0](https://github.com/arcade-cabinet/midway-mayhem/commit/6bbbba006c8f1d2ef3cad77d217ece44432011ad))
* **D2:** leaderboard shows player name + top 10 (PRQ D2) ([#226](https://github.com/arcade-cabinet/midway-mayhem/issues/226)) ([60e9b87](https://github.com/arcade-cabinet/midway-mayhem/commit/60e9b87ce91166417a152d1e5e378dbb95647cf1))
* **D3:** early achievements fire on first balloon/boost/score (PRQ D3) ([#225](https://github.com/arcade-cabinet/midway-mayhem/issues/225)) ([e434cc4](https://github.com/arcade-cabinet/midway-mayhem/commit/e434cc4b0f41d96d1cda62f2d3ff6220d7186915))
* **D4:** Watch Ghost replay UI — last-5-run list + RAF-driven playback ([#262](https://github.com/arcade-cabinet/midway-mayhem/issues/262)) ([df48d65](https://github.com/arcade-cabinet/midway-mayhem/commit/df48d65928efa90c81c0cf6fe630d1f12eeb6d46))
* **debug:** expose __mm.enumerateMeshes() for scene introspection ([#125](https://github.com/arcade-cabinet/midway-mayhem/issues/125)) ([a362af0](https://github.com/arcade-cabinet/midway-mayhem/commit/a362af04713ab1ce0fd1d80642644a6d59ebbf75))
* descent coil landing — A-DESC-1 + A-DESC-3 + seam fix + archetype battery + cockpit invariants ([#230](https://github.com/arcade-cabinet/midway-mayhem/issues/230)) ([e16a29c](https://github.com/arcade-cabinet/midway-mayhem/commit/e16a29c30e96cc5df2fd37aea6e4bca387e1e527))
* **diag:** add __mm.dumpScene() — hierarchical scene tree dump ([#150](https://github.com/arcade-cabinet/midway-mayhem/issues/150)) ([2a7b7e6](https://github.com/arcade-cabinet/midway-mayhem/commit/2a7b7e68be283d5f9df7fbe1b74ad7cd26b05c6d))
* **diag:** enrich __mm.diag() dump with run metadata + trick/boost/clean state ([#173](https://github.com/arcade-cabinet/midway-mayhem/issues/173)) ([993d687](https://github.com/arcade-cabinet/midway-mayhem/commit/993d68748ab33bee0f6757e76c2057555a98b894))
* **F2:** procedural app icon + multi-size generator ([#234](https://github.com/arcade-cabinet/midway-mayhem/issues/234)) ([94eff7d](https://github.com/arcade-cabinet/midway-mayhem/commit/94eff7df447bcdc9727c4ed07b71c973077865aa))
* **F3:** 5 store screenshots per platform via Playwright governor ([#257](https://github.com/arcade-cabinet/midway-mayhem/issues/257)) ([af939a7](https://github.com/arcade-cabinet/midway-mayhem/commit/af939a7391f38ff1ec4f530f74240dc1d56735fb))
* **gameplay:** ghost cars — beat your own best-scoring run ([#19](https://github.com/arcade-cabinet/midway-mayhem/issues/19)) ([b5862ff](https://github.com/arcade-cabinet/midway-mayhem/commit/b5862ff11d229aa91df93edc3ce6c541a76d472b))
* **gameplay:** zone banners every 500m + achievement toasts with persistence ([#18](https://github.com/arcade-cabinet/midway-mayhem/issues/18)) ([343e7f1](https://github.com/arcade-cabinet/midway-mayhem/commit/343e7f1694aa1618d841e73f82b982a6f6566a50))
* midway mayhem — cockpit clown-car in a big-top circus arena ([4ce98bc](https://github.com/arcade-cabinet/midway-mayhem/commit/4ce98bc9d1a248f8acd59c45ebd99f4d652aa9a9))
* mount useGameSystems hub for balloon + mirror gimmicks + zone audio ([#44](https://github.com/arcade-cabinet/midway-mayhem/issues/44)) ([aff6d1a](https://github.com/arcade-cabinet/midway-mayhem/commit/aff6d1adf6621f139ee0ecce9ae0fc574fbf4856))
* NewRunModal + dual RNG + optimal-path + browser test migration (PR [#2](https://github.com/arcade-cabinet/midway-mayhem/issues/2)) ([c5d1a89](https://github.com/arcade-cabinet/midway-mayhem/commit/c5d1a89f75ebd2c78123c8b4eaa0747d0f938d45))
* **polish:** boost motion-rush overlay + night-mode HDRI variant ([#17](https://github.com/arcade-cabinet/midway-mayhem/issues/17)) ([001e8be](https://github.com/arcade-cabinet/midway-mayhem/commit/001e8be9438d1b9c099fcd9c8a6466fb223e22b9))
* port reference/ → src/ (restructure, step 1+) ([#21](https://github.com/arcade-cabinet/midway-mayhem/issues/21)) ([d8aa994](https://github.com/arcade-cabinet/midway-mayhem/commit/d8aa994b89e1665a207463368e9359b13d784b36))
* rewire StartPlatform + FinishBanner + ZoneProps + conductor music (Track C) ([#29](https://github.com/arcade-cabinet/midway-mayhem/issues/29)) ([31cf080](https://github.com/arcade-cabinet/midway-mayhem/commit/31cf08099e7e5a91369127a771a9a449f9c374cd))
* **rewire:** mount ExplosionFX in the Canvas ([#159](https://github.com/arcade-cabinet/midway-mayhem/issues/159)) ([5ef8722](https://github.com/arcade-cabinet/midway-mayhem/commit/5ef8722d7d4d77161651825a381cec9740b5d88d))
* **rewire:** mount RacingLineGhost inside TrackScroller ([#158](https://github.com/arcade-cabinet/midway-mayhem/issues/158)) ([1e53d2a](https://github.com/arcade-cabinet/midway-mayhem/commit/1e53d2adeed685212a4123fd71dee14e8f38eff8))
* **Track C:** rewire BalloonLayer + MirrorLayer + FireHoopGate + BarkerCrowd ([#30](https://github.com/arcade-cabinet/midway-mayhem/issues/30)) ([095911b](https://github.com/arcade-cabinet/midway-mayhem/commit/095911bb7eb6c381376bca8a3c2436cac819f8f0))
* **Track C:** wire ObstacleSystem + PickupSystem (GLB-free) ([#42](https://github.com/arcade-cabinet/midway-mayhem/issues/42)) ([7fd608f](https://github.com/arcade-cabinet/midway-mayhem/commit/7fd608ffe0a4e8ca2363f7cd551a34720deaa1b4))
* **Track C:** wire RaidBridge + RaidLayer into live game ([#31](https://github.com/arcade-cabinet/midway-mayhem/issues/31)) ([321cf10](https://github.com/arcade-cabinet/midway-mayhem/commit/321cf10200cc58c153ed68c50ec25fcd192bf796))
* **Track C:** wire replay recorder into GameLoop + run lifecycle ([#32](https://github.com/arcade-cabinet/midway-mayhem/issues/32)) ([2f08ec2](https://github.com/arcade-cabinet/midway-mayhem/commit/2f08ec2e7bd3004151dfd690bb3990f45da8bd7d))
* **Track D:** mouse-X continuous steering + near-miss detection ([#37](https://github.com/arcade-cabinet/midway-mayhem/issues/37)) ([c04331d](https://github.com/arcade-cabinet/midway-mayhem/commit/c04331d5d637f25aaa17ad2e75ee36355c11dd7b))
* **Track D:** night-mode toggle in Settings + fix plunge trigger gate ([#36](https://github.com/arcade-cabinet/midway-mayhem/issues/36)) ([ecb57aa](https://github.com/arcade-cabinet/midway-mayhem/commit/ecb57aa046ca71ef822aa295c9f6222ce1661e69))
* **Track D:** pause binding + daily-route boot + combo on pickup ([#33](https://github.com/arcade-cabinet/midway-mayhem/issues/33)) ([58bf687](https://github.com/arcade-cabinet/midway-mayhem/commit/58bf6877c0642fb9b40a5e421170db7aa6799cf4))
* **Track D:** replace virtual joystick with whole-canvas drag steering ([#38](https://github.com/arcade-cabinet/midway-mayhem/issues/38)) ([b23c570](https://github.com/arcade-cabinet/midway-mayhem/commit/b23c570b878cae61aa6b4808e3c81def977e520c))
* **Track D:** zone-aware obstacle + pickup weighting in seedContent ([#39](https://github.com/arcade-cabinet/midway-mayhem/issues/39)) ([16cf1ab](https://github.com/arcade-cabinet/midway-mayhem/commit/16cf1ab3a0139b8d1c84027af66e05e534b34224))


### Fixed

* **app:** mount ErrorModal + ReactErrorBoundary + LiveRegion in App ([#198](https://github.com/arcade-cabinet/midway-mayhem/issues/198)) ([497342e](https://github.com/arcade-cabinet/midway-mayhem/commit/497342ec847a022121071da3e9abb74d1d512a1a))
* **App:** split into App + AppInner so WorldProvider wraps all hooks ([#254](https://github.com/arcade-cabinet/midway-mayhem/issues/254)) ([06f5f61](https://github.com/arcade-cabinet/midway-mayhem/commit/06f5f612f9e2225c115b26579b20e1f019733fef))
* **audio:** implement tireSqueal.subscribe() — the TODO has been actionable for weeks ([#155](https://github.com/arcade-cabinet/midway-mayhem/issues/155)) ([bc9f350](https://github.com/arcade-cabinet/midway-mayhem/commit/bc9f35023ff7c3ff14ca3bf4ac3d48065a54df83))
* **build:** eliminate ineffective dynamic imports in useGameSystems ([#48](https://github.com/arcade-cabinet/midway-mayhem/issues/48)) ([a73771d](https://github.com/arcade-cabinet/midway-mayhem/commit/a73771de075068e9edeb104b766c5541994e73c0))
* **cd:** build web bundle before cap sync for Android APK job ([#10](https://github.com/arcade-cabinet/midway-mayhem/issues/10)) ([e3e1176](https://github.com/arcade-cabinet/midway-mayhem/commit/e3e1176d21125219691f7a6352e83b2ba798ba1a))
* **cd:** run test:node only, not test (browser tests need GPU) ([#109](https://github.com/arcade-cabinet/midway-mayhem/issues/109)) ([fda684a](https://github.com/arcade-cabinet/midway-mayhem/commit/fda684a49657837ddb93f52044363899d83a9643))
* **ci:** biome-format cockpit test + config index ([#141](https://github.com/arcade-cabinet/midway-mayhem/issues/141)) ([c34a1b6](https://github.com/arcade-cabinet/midway-mayhem/commit/c34a1b6082b18d9974f11eaa9bc7c34c1309c1e3))
* **ci:** biome-format cockpit-blueprint.json ([#140](https://github.com/arcade-cabinet/midway-mayhem/issues/140)) ([3cbdd3c](https://github.com/arcade-cabinet/midway-mayhem/commit/3cbdd3ca39fed77357eef1a57072edb16b245691))
* **ci:** unbreak Browser Snapshot Tests job — 4 pre-existing failures ([#208](https://github.com/arcade-cabinet/midway-mayhem/issues/208)) ([c33ad07](https://github.com/arcade-cabinet/midway-mayhem/commit/c33ad07267abed6d36b854ff2ea6ce8b5534c556))
* **ci:** unbreak main — 4 red browser tests + 1 red e2e ([#277](https://github.com/arcade-cabinet/midway-mayhem/issues/277)) ([827a8d8](https://github.com/arcade-cabinet/midway-mayhem/commit/827a8d8dc23ab48fdb439b1b30fbdd1cf6ff2d66))
* **ci:** wire audit:bundle through audit:perf script (was still old 3MB uncompressed gate) ([#270](https://github.com/arcade-cabinet/midway-mayhem/issues/270)) ([4c31979](https://github.com/arcade-cabinet/midway-mayhem/commit/4c319791dc043e6bcd3c98e913caf1f7e5e8ca8b))
* **cockpit:** 4 visual glitches surfaced by per-element battery ([#267](https://github.com/arcade-cabinet/midway-mayhem/issues/267)) ([301fe12](https://github.com/arcade-cabinet/midway-mayhem/commit/301fe12364b76612f6c11dc6bd09da30dae16a38))
* **cockpit:** orient seatPiping horizontally + frame dashboard element ([#250](https://github.com/arcade-cabinet/midway-mayhem/issues/250)) ([fb6c61d](https://github.com/arcade-cabinet/midway-mayhem/commit/fb6c61d997ac246d057d82ea7c2c769a49074562))
* **collisions:** shrink HIT_LATERAL to 1.2 so centered player clears adjacent lanes ([#130](https://github.com/arcade-cabinet/midway-mayhem/issues/130)) ([#132](https://github.com/arcade-cabinet/midway-mayhem/issues/132)) ([2c3eb8d](https://github.com/arcade-cabinet/midway-mayhem/commit/2c3eb8df9bc2b59eed36349aa5533547ed9fcc32))
* **debug:** move __mm.enumerateMeshes into TrackScroller ([#128](https://github.com/arcade-cabinet/midway-mayhem/issues/128)) ([d6b27f0](https://github.com/arcade-cabinet/midway-mayhem/commit/d6b27f0ebc0487b1e202598af04679e7da0285a5))
* **debug:** wire __mm.enumerateMeshes via useEffect + useThree ([#126](https://github.com/arcade-cabinet/midway-mayhem/issues/126)) ([ceccd5f](https://github.com/arcade-cabinet/midway-mayhem/commit/ceccd5fbcff8238b6631580a80135ddbfb22a913))
* **diagnostics:** stop GameLoop clobbering WorldScroller's reportScene ([#120](https://github.com/arcade-cabinet/midway-mayhem/issues/120)) ([bb83078](https://github.com/arcade-cabinet/midway-mayhem/commit/bb83078bfe7d53555fbe96d0467c1efed958cf86))
* **e2e:** bump playthrough-smoke test timeout 60s → 90s ([#180](https://github.com/arcade-cabinet/midway-mayhem/issues/180)) ([3e02ae9](https://github.com/arcade-cabinet/midway-mayhem/commit/3e02ae9d994e3e23059ed30fd10222a204b8b7e8))
* **e2e:** nightly telemetry specs are desktop-only — fit inside 45-min cap ([#191](https://github.com/arcade-cabinet/midway-mayhem/issues/191)) ([31202de](https://github.com/arcade-cabinet/midway-mayhem/commit/31202de18e58c02d478629e23150b1ee5455d7d5))
* **e2e:** rewrite playthrough-smoke as a pure boot check + nightly-tag flaky mobile test ([#182](https://github.com/arcade-cabinet/midway-mayhem/issues/182)) ([d22cbe1](https://github.com/arcade-cabinet/midway-mayhem/commit/d22cbe165bcc4ff4ee80eb3daac42c836d88c6d8))
* **e2e:** smoke distance wait 15s → 30s (swiftshader frame rate) ([#186](https://github.com/arcade-cabinet/midway-mayhem/issues/186)) ([fb80593](https://github.com/arcade-cabinet/midway-mayhem/commit/fb80593cccf2f226e86f3ab16770bc1461f4f800))
* **e2e:** smoke no longer asserts distance&gt;0 — gameplay is too slow on CI swiftshader ([#188](https://github.com/arcade-cabinet/midway-mayhem/issues/188)) ([c91b505](https://github.com/arcade-cabinet/midway-mayhem/commit/c91b5058639c5a5763eec5ddfd9487eed144b88e))
* **e2e:** smoke uses DOM-only assertions — drops the page.evaluate bridge ([#184](https://github.com/arcade-cabinet/midway-mayhem/issues/184)) ([66a332b](https://github.com/arcade-cabinet/midway-mayhem/commit/66a332b6bc8778fc8d32fd0663d64eb634b72f6a))
* **e2e:** smoke uses page.waitForFunction instead of page.evaluate ([#183](https://github.com/arcade-cabinet/midway-mayhem/issues/183)) ([8576d98](https://github.com/arcade-cabinet/midway-mayhem/commit/8576d987eaffe8f5f827f339976c4b4219093fba))
* **e2e:** tag mechanics + journey specs [@nightly](https://github.com/nightly) so they leave the fast smoke gate ([#275](https://github.com/arcade-cabinet/midway-mayhem/issues/275)) ([6ded88d](https://github.com/arcade-cabinet/midway-mayhem/commit/6ded88d55a546abf9621220b68462ea2e86d09cd))
* **ecs/collisions:** mutate Score+Speed via live updateEach refs ([#103](https://github.com/arcade-cabinet/midway-mayhem/issues/103)) ([e66cd0f](https://github.com/arcade-cabinet/midway-mayhem/commit/e66cd0f2e339c1320a7f91c66f7477e853da71fd))
* **FinishBanner:** don't render when run plan distance exceeds sampled track ([#123](https://github.com/arcade-cabinet/midway-mayhem/issues/123)) ([17d15e6](https://github.com/arcade-cabinet/midway-mayhem/commit/17d15e6ae0f0c07a9d5d05d49cc07b863632df10))
* **governor+hud:** autopilot stops crashing at 300m; SCORE integrates with dashboard ([#211](https://github.com/arcade-cabinet/midway-mayhem/issues/211)) ([cddb4d7](https://github.com/arcade-cabinet/midway-mayhem/commit/cddb4d7b9be2053299e47da668cdd9098a83bae8))
* **governor:** write continuous steer, not discrete keyboard synth ([#215](https://github.com/arcade-cabinet/midway-mayhem/issues/215)) ([696a2e2](https://github.com/arcade-cabinet/midway-mayhem/commit/696a2e2cdecfe68eebf4155d1e9327764b633ad4))
* **hud:** shrink diegetic speedometer from 0.28 → 0.12 fontSize ([#210](https://github.com/arcade-cabinet/midway-mayhem/issues/210)) ([9a59be6](https://github.com/arcade-cabinet/midway-mayhem/commit/9a59be6e8035e1a43c59acc49a8ec6aab731186f))
* **nightly:** shorter frames, no retries, softer distance assertion — fit in 45-min cap ([#192](https://github.com/arcade-cabinet/midway-mayhem/issues/192)) ([f36bfcf](https://github.com/arcade-cabinet/midway-mayhem/commit/f36bfcf89688876da1e4800ffca315aa6efa38b6))
* P0 quick wins + partial docs (Track A + partial B) ([#24](https://github.com/arcade-cabinet/midway-mayhem/issues/24)) ([7ec2349](https://github.com/arcade-cabinet/midway-mayhem/commit/7ec234990bcee1ca64a1aea154bb3d785f4b8523))
* **perf:** disable preserveDrawingBuffer in prod — was causing GPU stalls on CI xvfb ([#187](https://github.com/arcade-cabinet/midway-mayhem/issues/187)) ([a90f905](https://github.com/arcade-cabinet/midway-mayhem/commit/a90f90507ba1675dabf1aa199a2747ec40fdc5bb))
* real bugs from seed-playthrough e2e factory ([#26](https://github.com/arcade-cabinet/midway-mayhem/issues/26)) ([b46fb8e](https://github.com/arcade-cabinet/midway-mayhem/commit/b46fb8e75ed6ace7e0e8a813b9e40f71c1860c9b))
* **render:** kick R3F resize after mount + add App integration gate ([#53](https://github.com/arcade-cabinet/midway-mayhem/issues/53)) ([bd8cc61](https://github.com/arcade-cabinet/midway-mayhem/commit/bd8cc613700b12920d75d32d141d015a4d86e64d))
* **render:** mount TrackScroller so all track-anchored props share follow-camera ([#119](https://github.com/arcade-cabinet/midway-mayhem/issues/119)) ([#127](https://github.com/arcade-cabinet/midway-mayhem/issues/127)) ([4157ac9](https://github.com/arcade-cabinet/midway-mayhem/commit/4157ac9214bc20152ae022ff6a98880616209825))
* **render:** park track-anchored props past end-of-sampled-track off-screen ([#124](https://github.com/arcade-cabinet/midway-mayhem/issues/124)) ([08ba8ba](https://github.com/arcade-cabinet/midway-mayhem/commit/08ba8baadb1bb3ffa5b0630068d8237eaf55b3f2))
* **scripts:** playthrough-governor — use autoplay URL (dead selector was blocking run) ([#172](https://github.com/arcade-cabinet/midway-mayhem/issues/172)) ([064a94c](https://github.com/arcade-cabinet/midway-mayhem/commit/064a94c62dae72def464eeb32fcb7480fceddf3f))
* **test:** prebundle sqlite for browser tests; bump Driving timeout ([#22](https://github.com/arcade-cabinet/midway-mayhem/issues/22)) ([3b749eb](https://github.com/arcade-cabinet/midway-mayhem/commit/3b749eb8ac92a132222dbf61760e6cdee435ae81))
* **traits:** drop duplicate Lane declaration from dual-PR merge artifact ([#252](https://github.com/arcade-cabinet/midway-mayhem/issues/252)) ([3f9e45e](https://github.com/arcade-cabinet/midway-mayhem/commit/3f9e45e78d08872973b77c4fa8f1c7ff341b8591))
* unblock autoplay path (audio + StartPlatform sign clipping) ([#214](https://github.com/arcade-cabinet/midway-mayhem/issues/214)) ([2b1091a](https://github.com/arcade-cabinet/midway-mayhem/commit/2b1091a42511cff2e10bd3c91e09651abd43f36a))
* **useGameSystems:** lazy-init spawners after startRun() — page was empty ([#52](https://github.com/arcade-cabinet/midway-mayhem/issues/52)) ([bef600f](https://github.com/arcade-cabinet/midway-mayhem/commit/bef600f6a2f14349f3c4d1fcddf2225f37d4cf6c))
* wasm paths + prebuild hooks (align with grailguard) ([#28](https://github.com/arcade-cabinet/midway-mayhem/issues/28)) ([e4a20cf](https://github.com/arcade-cabinet/midway-mayhem/commit/e4a20cfc17319c8c510258f0cf23264616cb9d16))


### Performance

* **build:** split third-party libs into their own chunks ([#165](https://github.com/arcade-cabinet/midway-mayhem/issues/165)) ([d952f2c](https://github.com/arcade-cabinet/midway-mayhem/commit/d952f2cc71498799200af394f8d5b8344fbb702f))
* **mirror:** drop MeshReflectorMaterial resolution 512→256 and blur 120×30→64×16 ([#207](https://github.com/arcade-cabinet/midway-mayhem/issues/207)) ([f74aae4](https://github.com/arcade-cabinet/midway-mayhem/commit/f74aae4af2427e6e3138e659b519aee5fcdbd29e))


### Changed

* **config:** move obstacleSpawner SPAWN + ZONE_WEIGHTS into tunables.json ([#153](https://github.com/arcade-cabinet/midway-mayhem/issues/153)) ([7ff9637](https://github.com/arcade-cabinet/midway-mayhem/commit/7ff96378ba826d4a393ddff5551fce5acf1e6646))
* **config:** move TRACK / HONK / STEER into tunables.json ([#152](https://github.com/arcade-cabinet/midway-mayhem/issues/152)) ([6c801c6](https://github.com/arcade-cabinet/midway-mayhem/commit/6c801c6b68184d20826ebff3fe1a13d7917fa626))
* **gameState:** split useGameStore shim into its own module ([#161](https://github.com/arcade-cabinet/midway-mayhem/issues/161)) ([5f9e075](https://github.com/arcade-cabinet/midway-mayhem/commit/5f9e0750b393940c243a76c69a01b0e37d1b8953))


### Documentation

* **changelog:** the 2026-04-23 descent + audio + polish burst (PRs 230–275) ([#276](https://github.com/arcade-cabinet/midway-mayhem/issues/276)) ([d7c0566](https://github.com/arcade-cabinet/midway-mayhem/commit/d7c0566e765faeb1d0355bd27db34b2ab2838a8b))
* **F4:** app store description + keywords draft (PRQ F4) ([#222](https://github.com/arcade-cabinet/midway-mayhem/issues/222)) ([d1a2ec3](https://github.com/arcade-cabinet/midway-mayhem/commit/d1a2ec36ca1fa78964e698875f9e1083cb141722))
* **F5:** privacy + terms static pages for app store compliance ([#240](https://github.com/arcade-cabinet/midway-mayhem/issues/240)) ([562e261](https://github.com/arcade-cabinet/midway-mayhem/commit/562e261bbb7e58ac7a55634299f760d36b392ac5))
* **G1:** STATE.md refresh — PRQ session progress + trackComposer lie ([#219](https://github.com/arcade-cabinet/midway-mayhem/issues/219)) ([319fe6a](https://github.com/arcade-cabinet/midway-mayhem/commit/319fe6a2498e84506c19ee8ea2331abe90c2e6c1))
* **G2:** TESTING.md — document visual-matrix baseline workflow (PRQ G2) ([#221](https://github.com/arcade-cabinet/midway-mayhem/issues/221)) ([29af769](https://github.com/arcade-cabinet/midway-mayhem/commit/29af769cf381732636083c42b27af89f2c0e1be9))
* **G3:** CHANGELOG — PRQ session polish + fixes (PRQ G3) ([#220](https://github.com/arcade-cabinet/midway-mayhem/issues/220)) ([288c9e8](https://github.com/arcade-cabinet/midway-mayhem/commit/288c9e8db338337f3530579e6cc4fdfee4054754))
* gap-analysis reports + master action plan ([#23](https://github.com/arcade-cabinet/midway-mayhem/issues/23)) ([1d4a482](https://github.com/arcade-cabinet/midway-mayhem/commit/1d4a48262a8046297ac4e9dbb5cde7c33b8e8d6b))
* **gap-analysis:** mark PLAN.md archived — all tracks landed ([#194](https://github.com/arcade-cabinet/midway-mayhem/issues/194)) ([98d5e49](https://github.com/arcade-cabinet/midway-mayhem/commit/98d5e499e63b8a2b5f49f671e8088d1eb2e6bc41))
* **gap-analysis:** update features.md to reflect rewiring work ([#162](https://github.com/arcade-cabinet/midway-mayhem/issues/162)) ([b4c7220](https://github.com/arcade-cabinet/midway-mayhem/commit/b4c72207e00a708334f2d0f82218cd37159b5ec4))
* index of 83 pinned visual baselines + regeneration workflow ([#274](https://github.com/arcade-cabinet/midway-mayhem/issues/274)) ([06389c3](https://github.com/arcade-cabinet/midway-mayhem/commit/06389c3d25c321decf4b39c84445a33d50ae443e))
* LOC is contextual, not an arbitrary number ([#160](https://github.com/arcade-cabinet/midway-mayhem/issues/160)) ([e001255](https://github.com/arcade-cabinet/midway-mayhem/commit/e001255cbef47a68b22e2532e9795bcf159f70b0))
* port RULES/PRODUCTION/RELEASE/LAUNCH_READINESS/VISUAL_REVIEW/store-listing from mean-streets ([#236](https://github.com/arcade-cabinet/midway-mayhem/issues/236)) ([8e4f7d9](https://github.com/arcade-cabinet/midway-mayhem/commit/8e4f7d96bc31abd8a2ae3f356c668a50f28f87e7))
* **prd:** Road to 1.0 PRQ in /task-batch format ([#216](https://github.com/arcade-cabinet/midway-mayhem/issues/216)) ([65d0d1a](https://github.com/arcade-cabinet/midway-mayhem/commit/65d0d1a4f02edcd1562cd790b506e6cec9082ec1))
* **prq:** expand to descent-spiral canonical vision + isolated track viz ([#228](https://github.com/arcade-cabinet/midway-mayhem/issues/228)) ([07c5473](https://github.com/arcade-cabinet/midway-mayhem/commit/07c5473a5454360339812db1673e51096a5ac5b3))
* **readme:** add Playthrough telemetry section + wire up pnpm playthrough scripts ([#176](https://github.com/arcade-cabinet/midway-mayhem/issues/176)) ([cb9675e](https://github.com/arcade-cabinet/midway-mayhem/commit/cb9675ee5ead9740c309f2867e271f462cb05314))
* **state:** refresh STATE.md with today's playthrough-telemetry work + fix stale known issues ([#177](https://github.com/arcade-cabinet/midway-mayhem/issues/177)) ([f5ec392](https://github.com/arcade-cabinet/midway-mayhem/commit/f5ec392288bddc71b5229198767e9f8929fd1342))
* **state:** refresh with session's 40-PR final tally ([#206](https://github.com/arcade-cabinet/midway-mayhem/issues/206)) ([62a0d34](https://github.com/arcade-cabinet/midway-mayhem/commit/62a0d345731be77b129768e05f2cf1c296403665))
* **state:** Track C wiring complete — audit confirms all modules imported ([#190](https://github.com/arcade-cabinet/midway-mayhem/issues/190)) ([f5a92a0](https://github.com/arcade-cabinet/midway-mayhem/commit/f5a92a0664616832c1e1f644661dc26a0ab080ee))
* **test:** clarify CI vs local behavior of visual-matrix baseline diff ([#213](https://github.com/arcade-cabinet/midway-mayhem/issues/213)) ([9046e89](https://github.com/arcade-cabinet/midway-mayhem/commit/9046e89f1c6ab1fb7ac891c87d510739c072d380))
* **testing:** document the smoke vs nightly e2e split ([#179](https://github.com/arcade-cabinet/midway-mayhem/issues/179)) ([#181](https://github.com/arcade-cabinet/midway-mayhem/issues/181)) ([fd304a5](https://github.com/arcade-cabinet/midway-mayhem/commit/fd304a5ef8629ba53d5a041130651cfefb99016a))
* Track B — domain docs + AI configs + staleness fixes ([#25](https://github.com/arcade-cabinet/midway-mayhem/issues/25)) ([141a534](https://github.com/arcade-cabinet/midway-mayhem/commit/141a534b61dee50bbb3db95f61c07bc6e515cb6f))

## [Unreleased]

### Added — 2026-04-23 descent landing + audio + polish (PRs 230–275)

**Track + environment**
- A-DESC-1 shaped descent coil (zone-weighted archetypes, ±0.06 rad clamp, ~37m total descent) (PR 230)
- A-DESC-2 StartPlatform hung 30m above track with visible wires to dome cap (PR 237)
- A-DESC-3 FinishBanner 60×60m B&W race-line clamped to dome floor (PR 230)
- A-DESC-4 cockpit pitch-look-down hook (0.4× track pitch, 2Hz smoothing) (PR 242)
- A-DESC-5 2000 InstancedMesh crowd silhouettes in dome bleachers (PR 247)
- A-TRACK-SEAMS bank LERP — closes up to 3.48m torn-slab gaps (PR 230)
- A-TRACK-PITCH-SMOOTH smoothstep easing on deltaPitch (PR 246)
- A-TRACK-MAT PolyHaven weathered brown planks PBR (PR 241)
- A-TRACK-VIS-ARCH 16 per-archetype baselines (8 × 2 angles) (PR 230)
- A-ZONE-VIS per-zone identity (Midway/Balloon/Ring of Fire/Funhouse) (PR 249)
- A-DECOR triangle-pennant bunting between rafters + dome cap (PR 258)
- A-OBS themed Kenney GLB obstacles — zero raw boxes remain (PR 244)

**Cockpit**
- Blueprint structural-integrity tests (9 data-layer invariants) (PR 230)
- Per-element visual battery (6 isolated captures) (PR 230)
- A-pillar vertical fix (cylinder stood up from flat-along-Z) (PR 230)
- Steering column connects wheel hub ↔ dashCowl mount (PR 267)
- DashCowl DoubleSide so polka-dot pattern reads from driver POV (PR 267)
- SeatPiping horizontal across seat back (PR 267)

**Gameplay**
- B1 6-step tutorial + drop-in intro (PR 251)
- B3 discrete swipe → lane-change (replaces continuous drag) (PR 238)
- D4 Watch Ghost replay UI + playback controls (PR 262)

**Audio**
- C1 music fade-in + sidechain ducking on honk/crash (PR 245)
- C-DESCENT-AMBIENCE 12-section Tone.Panner3D crowd swell √t (PR 245, PR 269)
- C2 per-zone SFX palette (4 honk variants + balloonPop/ticketDing/trickWhoosh/plungeSwoosh/crashThud) (PR 269)
- C4 music stingers on zone transition, 1000m milestone, run clear (PR 269)

**Ship + compliance**
- F2 procedural app icon + multi-size generator (24 sizes: iOS + Android) (PR 234)
- F3 5 store screenshots per platform via Playwright governor (PR 257)
- F5 privacy + terms static pages (COPPA-safe) (PR 240)
- Docs parity with `mean-streets` (7 files) (PR 236)
- 83-baseline index at `docs/VISUAL_BASELINES.md` (PR 274)

**Testing + CI**
- E1 stability soak (@nightly): 5-min autoplay no-fatal (PR 248)
- E3 Android emulator perf soak (@android-perf): p95 fps ≥ 40 (PR 268)
- H1 visual matrix × 4 form factors: 32 baselines (PR 260)
- H3 pixel-exact cockpit diff on deterministic region (PR 259)
- @mechanics gate (@nightly): distance/fps/combo/zone/HUD alive (PR 272, 275)
- @journey gate (@nightly): full UI transition path (PR 273, 275)
- Perf budget CI: gzipped critical < 2MB (current 729KB / 36% of budget) (PR 243, 270)

### Security — 2026-04-23

- `@xmldom/xmldom` pnpm override to ≥0.8.13 closes 3 high-severity XML injection CVEs (PR 239)
- `googleapis/release-please-action` v4 → v5 (PR 256)

### Fixed — 2026-04-23

- App.tsx split into App + AppInner so WorldProvider wraps all hooks (useTutorialWatcher crashed without useWorld context) (PR 254)
- `audit:bundle` now delegates to `audit:perf` (the old 3MB uncompressed gate was flagging every PR) (PR 270)
- Duplicate `Lane` trait from parallel-merge artifact (PR 252)
- App.browser.test pixel assertion: 9-probe grid instead of single center (PR 267)

### Added — 2026-04-20 polish + PRQ execution (PRs 208–219)

- Visual-matrix POV regression test: 8 deterministic distance slices (40m–480m) captured at real integration (App + Cockpit + TrackContent + feature layers) with pinned baselines + 30%-tolerance node-side diff (PRs 209, 212, 213).
- Pause UX: fullscreen PAUSED overlay + always-visible pause button (‖‖) in top-right. Esc/P on desktop, tap on mobile. PRQ task B2 (PR 218).
- Road-to-1.0 PRQ at `docs/prd/ROAD_TO_1_0.prq.md` — 39 tasks across 8 tracks (visual identity, gameplay, audio, persistence, stability, app store, docs, testing), ready for `/task-batch` (PR 216).

### Changed — 2026-04-20 visual polish + autopilot fixes

- Governor autopilot no longer pins steer to ±1 (PR 211/215). Root cause: compared world-space lane center (with track curve offset) against track-relative player lateral, so curved track segments always produced massive offset. Also no longer synthesizes keyboard events — writes continuous steer directly to the Steer trait so the wheel rim rotates proportionally instead of snapping to 90°.
- StartPlatform sign moved from back-edge to front-edge of the platform (PR 214). Previously the sign-back plane rendered ~5m in front of the driver on spawn, a big red wall filling the POV.
- Diegetic speedometer shrunk from fontSize 0.28 → 0.12 (PR 210) and SCORE text from 0.12 → 0.09 (PR 211); neither dominates the track view anymore.
- Camera y dropped 1.72 → 1.55 and hood heightScale raised 0.4 → 0.6 (PR 217, PRQ task A2). The polka-dot hood now fills the lower third of the POV instead of being a sliver at the bottom.
- `stepGameOver` distinguishes `'plunge'` (off-track) from `'damage'` (3-hit crash) — separate EndReason, "MELTDOWN" overlay vs "WIPEOUT" (PR 208).

### Fixed — 2026-04-20

- CI Browser Snapshot Tests job was silently red on every PR for ~40 PRs; now enforces all 49 browser tests (PR 208). Addressed 4 latent failures: App.browser `toDataURL` of a cleared buffer, TrackScroller not reporting real trackPieces count, harness screenshot timing-out on frameloop=always, `stepGameOver` not reading `RunSession.gameOver`.
- TireSquealSystem halted the game with MAYHEM HALTED modal on `?autoplay=1` paths because no user gesture had unlocked the AudioContext. `init()` now returns false on buses-not-ready and `update()` retries (PR 214).
- Audio-bus init race in autoplay tests (PR 214).

### Added — v2 port from `reference/`

- Dual-channel PRNG (`createRunRng`) with independent track + events salted streams.
- Human-readable seed phrases (`phraseToSeed`, `shufflePhrase`).
- Persistence layer: SQLite + drizzle + sql.js wasm (web OPFS) + @capacitor-community/sqlite (native). Tables: profile, unlocks, loadout, dailyRuns, replays, achievements, lifetimeStats.
- Audio conductor: Tone.js 3-bus mix with sidechain ducking; CircusConductor phrase grammar; honk/sfx/tireSqueal procedural recipes; spessasynth_lib soundfont support.
- Difficulty tiers (kazoo / plenty / nightmare / ultra-nightmare) + per-tier run plan, optimal path, telemetry.
- Combo + trick + deviation + damage systems.
- Full TitleScreen: NewRunModal, difficulty tiles, seed phrase field, permadeath toggle. Compact layout (phone-portrait) + hero layout (desktop/tablet).
- Panels: Achievements, Settings, HowToPlay, Credits, Stats, TicketShop, ShopRow, Leaderboard, PhotoMode.
- Full in-run HUD: hype / distance / crashes / sanity / crowd / racing-line meter / trick overlay / raid telegraph / game-over overlay / live-region accessibility.
- Cockpit FX: damage flicker + smoke, explosion particles, speed vignette, racing-line ghost, steering-wheel rig.
- Track: StartPlatform (wire-hung NEW GAME launch), FinishBanner, WorldScroller, zone banners per 500m, optimal-path solver.
- Obstacle render layers: BalloonLayer, BarkerCrowd, FireHoopGate, MirrorLayer (funhouse-zone duplicates), RaidLayer (TIGER/KNIVES/CANNONBALL), GhostCar (best-score replay).
- Mobile-first responsive scale: form-factor-aware cockpit drop-in height + plunge clamps, all values in `tunables.json`.
- Deterministic seed test factory (`e2e/_factory.ts`): `runPlaythrough()` dumps per-2s JSON diagnostics + PNG screenshots.
- E2E specs: governor-playthrough, seed-playthroughs (3 canonical phrases), determinism canary, mobile-gameplay (Pixel 7), visual-regression.
- Maestro Android flows: smoke, gameplay-30s, hud-visible, touch-steering, title-panels, critter-scare, ramp-trick, pause-resume, game-over.
- `useSyncExternalStore`-backed `useGameStore` shim — HUD + panels re-render reactively.
- Autoplay governor (`?autoplay=1`) floors throttle + wires to `startRun()`.

### Fixed — v2 port

- Black-void mid-run (two systems writing Position → teleport discontinuities).
- GameOverOverlay opaque backdrop swallowing cockpit.
- sql.js wasm 404 at runtime (copywasm copies wasm to `public/`; dbDrivers fetches from `${BASE_URL}sql-wasm.wasm`).
- Plunge animation dropping camera below ground into a pitch-black void.
- Drop-in animation hoisting cockpit 12m above track.
- Maestro shell script YAML-parse bug (`for FLOW in \` getting collapsed).
- Playwright `tablet-landscape` launching webkit that wasn't installed — swapped to chromium + touch + 1366x1024.
- HUD frozen at zero values because `useGameStore` wasn't subscribing to state changes.

### Structural

- Every module in `reference/src/` ported to `src/` or explicitly dropped (see `docs/porting-map.md`). `reference/` removed.
- Single motion owner: `gameStateTick` writes distance/speed/lateral/score on the Player entity; `stepPlayer` is a no-op while a run is active (keeps isolated tests working).
- Tunables moved from inline `.ts` literals to `src/config/tunables.json` per CLAUDE.md rule "if a number appears in `.ts`, it came from JSON."

## [0.1.0] — 2026-04-16

### Added

- Initial playable commit.
- Cockpit-perspective R3F scene inside full circus_arena HDRI big-top.
- Kenney Racing Kit track pieces baked with Midway Mayhem brand palette via `scripts/bake-kit.py`.
- `trackComposer.ts` snap-to-grid track assembly (start/straight/corner/ramp/end pieces).
- 5-type obstacle system (barrier, cones, gate, oil, hammer) + 3-type pickup system (boost, ticket, mega).
- Yuka.js autonomous governor for e2e playthroughs (`?governor=1`).
- Hard-fail error discipline: global ErrorModal + ErrorBus + React ErrorBoundary.
- Declarative asset manifest + preloader with hard-fail on 404.
- HUD (HYPE / DISTANCE / CRASHES / SANITY / CROWD REACTION) in Bangers + Rajdhani.
- Tone.js procedural audio bus (engine hum, honk, crash, pickup FX).
- Responsive camera FOV for portrait phones.
- Diagnostics bus at `window.__mm.diag()`.
- Camera-parented-to-cockpit architecture (fixes Gemini sail-glitch + hood-swallow bugs at the design level).

### Fixed — lessons from the prototype conversations
- Sail glitch: camera now rides inside the cockpit body group, no world-space chase.
- Hood-swallow: hood is a capped hemisphere at fixed Z never overlapping the dashboard plane.
- Mobile FOV zoom-in: `useResponsiveFov` adapts vertical FOV so horizontal FOV stays ≈90° on portrait.
- Cockpit scale drift on resize: all cockpit meshes live inside one `<Cockpit>` group.

### Stack
- React 19.2, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3
- Vite 6, TypeScript 5.7, pnpm 10.32
- Biome 2.4, Vitest 4, Playwright 1.51
- Tone.js 15, Yuka 0.7, zustand 5
- Capacitor 8 (Android + iOS)
- drizzle-orm + sql.js + @capacitor-community/sqlite (pinned for persistence work)
