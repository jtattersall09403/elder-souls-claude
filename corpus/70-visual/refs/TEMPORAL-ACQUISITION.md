# Temporal reference — the route map

**Amendment A8 asked for routes, not excuses.** This file is the durable answer: every host and
method tried for moving-image reference, what it yielded, and *why* each failure failed. If a
later agent has to revisit temporal reference, this file is what stops it repeating the work.

Written by the temporal reference builder, wave post-acquisition. Status file:
`orchestration/status/temporal-refs.json`.

> **Two round-1 conclusions are overturned here and should not be repeated.**
> 1. `ACQUISITION-CRITIQUE-R1.md` "Negative results" says *"The true GIF bytes are **not
>    obtainable**"* from `static.wikia.nocookie.net`. **False.** See route 1a.
> 2. `ACQUISITION-REPORT.md` §15.6 says *"**YouTube is closed to this container**"*. **False in
>    effect.** See route 3.

<!-- WIP: sections filled incrementally; see the bottom of the file for outstanding work -->

---

## 0. Summary of routes

| # | Route | Host | Status | Yield |
|---|---|---|---|---|
| 1a | Fandom wiki API + `?format=original` | `darksouls.fandom.com`, `eldenring.fandom.com` | **WORKS — best route** | see §1 |
| 1b | Fandom wiki API, other wikis | `darksouls3.fandom.com`, `elderscrolls.fandom.com` | dead / alias | §1.4 |
| 2 | Imgur direct | `i.imgur.com` | see §2 | |
| 3 | YouTube via Invidious host string + `yt-dlp` | `yewtu.be`, `invidious.nerdvpn.de` | **WORKS (intermittent)** | §3 |
| 3b | YouTube direct | `youtube.com` | **DEAD** — bot wall on every client | §3.2 |
| 4 | Vimeo / Bilibili | | §4 | |
| 5 | archive.org sparse-range derivative extraction | `archive.org` | **WORKS** | §5 |
| 6 | Reddit non-HTML endpoints | `reddit.com`, `old.reddit.com` | **DEAD** — 403 on `.json` too | §6 |
| 7 | GitHub test sequences | | §7 | |
| S1 | Steam burst screenshot series (consecutive `publishedfileid`) | `steamcommunity.com` | §8 | |
| S2 | Frame strips / sprite sheets | | §8 | |
| S3 | Same landmark at two distances (LOD substitute) | | §8 | |
| S4 | Same place at two times/weathers | | §8 | |

---

## 1. Fandom wiki animation GIFs — the highest-yield route, and it gives *original bytes*

### 1a. The `?format=original` finding (overturns a round-1 negative result)

`static.wikia.nocookie.net` transcodes GIFs to animated WebP on essentially every request shape.
Round 1 tested four shapes — bare path, `/revision/latest`, `Accept: image/gif`, and a browser
User-Agent — got the same 220,726-byte WebP each time against a stated 605,902-byte GIF, and
recorded *"the true GIF bytes are not obtainable"*.

**The missing shape is a query parameter:**

```
https://static.wikia.nocookie.net/<wiki>/images/<a>/<ab>/<Name>.gif?format=original
```

Verified on `File:Artorias - Heavy Slam.gif`:

| request shape | HTTP | Content-Type | bytes |
|---|---|---|---|
| bare path | 200 | `image/webp` | 220,726 |
| `/revision/latest?cb=…` | 200 | `image/webp` | 220,726 |
| bare path + `Accept: image/gif` | 200 | `image/webp` | 220,726 |
| bare path + browser UA | 200 | `image/webp` | 220,726 |
| `vignette.wikia.nocookie.net` | 200 | `image/webp` | 220,726 |
| **`?format=original`** | **200** | **`image/gif`** | **605,902** |
| **`/revision/latest?format=original`** | **200** | **`image/gif`** | **605,902** |

605,902 is exactly the `size` the MediaWiki API reports. `file` confirms `GIF image data, version
89a, 210 x 118`. **This is a §4-clean acquisition: no transcode, no re-encode, original bytes.**

### 1b. The 1,050-byte caveat

31 of 200 files came back byte-exact against the API's stated `size`. **The other 169 came back
exactly 1,050 bytes short** — the delta is *identical* on every one of them, which is the signature
of a fixed-size metadata block (a GIF Application/Comment extension) that Fandom's storage layer
strips, not of truncation or damage. Verified on `Ceaseless-Slam.gif`: the served bytes are a
complete GIF89a (`47 49 46` header, `3b` trailer), decode cleanly in Pillow, and contain **92
frames** at the stated 210×118. Every frame is present.

So: the served original is *the image*, minus a metadata block. Recorded per record as
`deviation: "1050-byte metadata block stripped by the host relative to the wiki's stated original
size; all frames present and decodable"`. `pixel_metrics_valid` is `false` on the whole A5 axis
anyway (A5 rule 3), so nothing downstream is affected.

### 1c. Enumeration method

`aimime=image/gif` on `list=allimages` **returns 0 results** on Fandom (miser mode) — do not use
it; round 1's approach of a category listing is also too narrow (`Category:Dark Souls: Boss Attack
Animations` holds only **12** files, and the wiki actually has 263). What works is a full
`list=allimages` walk filtered locally by extension:

```
https://<wiki>/api.php?action=query&list=allimages&ailimit=500
   &aiprop=url|size|mime|user|timestamp|dimensions&format=json
```
paginate on `continue`, then keep `mime in {image/gif, video/webm, video/mp4}`.

Attribution and depiction:
- `aiprop=user|timestamp` gives the uploader and upload date for `author_or_uploader` /
  `capture_date` without a second request.
- `action=query&prop=fileusage&titles=File:A|File:B|…` (40 titles per request) resolves what an
  unlabelled file depicts, from the article that embeds it. This is how the 37 unlabelled
  `GIF_20240621_*.gif` files on the Elden Ring wiki were identified (Fingercreeper, Astel,
  Abductor Virgin, Wormface, Deathbird, Snake Snail, First-Generation Albinauric); the other 30
  are orphaned and stay unidentified.

### 1d. What was found

| Wiki | images scanned | animated files | total bytes |
|---|---:|---:|---:|
| `darksouls.fandom.com` | 12,056 | **263** (all `.gif`) | 512 MB |
| `eldenring.fandom.com` | 10,287 | **108** (107 `.gif`, 1 `.mp4`) | 744 MB |
| `elderscrolls.fandom.com` | (full walk) | 369 | 181 MB |
| `darksouls3.fandom.com` | — | — | **alias of `darksouls.fandom.com`**, byte-identical result set; do not enumerate twice |

The Dark Souls wiki holds a **complete per-move animation library** — 190 clips at 210×118, named
`<Boss>-<Move>`, covering 23 bosses: Artorias (9), Bed of Chaos (6), Moonlight Butterfly (4),
Ceaseless Discharge (7), Centipede Demon (9), Demon Firesage (6), Gaping Dragon (8), Bell Gargoyle
(13), Iron Golem (7), Sanctuary Guardian (15), Black Dragon Kalameet (13), Four Kings (8), Manus
(12), Nito (6), Ornstein (8) and Super Ornstein (10), Smough (3) and Super Smough (3), Pinwheel
(5), Priscilla (5), Quelaag (8), Seath (7), Sif (10), Stray Demon (7).

This is exactly the artifact `RI-AI06` asks for — *"within four or five attempts the player can
name most of the moves"* — with the wiki having done the naming.

**`elderscrolls.fandom.com` is a dead end for this project's purposes:** its 369 animated files are
Arena and Daggerfall cutscene GIFs, *Legends* card art, Skyrim shop signs and forum emoticons.
**There is no Morrowind in-engine animation on it at all.** Do not re-check.

<!-- WIP: §2-§8 outstanding -->
