# Temporal reference — the route map

**Amendment A8 asked for routes, not excuses.** This file is the durable answer: every host and
method tried for moving-image reference, what it yielded, and *why* each failure failed. If a
later agent has to revisit temporal reference, this file is what stops it repeating the work.

Written by the temporal reference builder, wave post-acquisition. Status file:
`orchestration/status/temporal-refs.json`.

> **Two round-1 conclusions are overturned here and should not be repeated.**
> 1. `ACQUISITION-CRITIQUE-R1.md` "Negative results" says *"The true GIF bytes are **not
>    obtainable**"* from `static.wikia.nocookie.net`. **False.** See route 1a.
> 2. `ACQUISITION-REPORT.md` §15.6 says *"**YouTube is closed to this container**"*. Its
>    *conclusion* holds — no byte of YouTube media was obtained — but its *reason* is wrong and
>    the wrong reason cost this round hours. YouTube **search** is open, YouTube **storyboards**
>    download, and the bot wall is defeatable for extraction; what actually blocks the media is
>    the container's egress proxy breaking the `googlevideo` URL binding. See §3.
> 3. And the conclusion that followed from it — that video was therefore unobtainable — **is
>    false**. Nine clips and 207 animation GIFs were vendored, none of them from YouTube.

---

## 0. Summary of routes

| # | Route | Host | Status | Yield |
|---|---|---|---|---|
| 1a | Fandom wiki API + `?format=original` | `darksouls.fandom.com`, `eldenring.fandom.com` | **WORKS — best route, original bytes** | **207 GIFs, 398.5 MB, 19,600 frames** |
| 1b | Fandom wiki API, other wikis | `darksouls3.fandom.com` (alias), `elderscrolls.fandom.com` | **dead** | 0 — no Morrowind in-engine animation exists there |
| 2 | Imgur | `i.imgur.com`, `api.imgur.com` | **blocked on a credential** — 401, search API needs a Client-ID | 0 |
| 3 | YouTube via an Invidious host string + `yt-dlp` | `yewtu.be`, `invidious.nerdvpn.de` | **metadata only** — extraction works, media transfer 403s / TLS-fails | 0 bytes of media |
| 3b | YouTube direct | `youtube.com` | **DEAD** — bot wall on 8 clients | but **search works**, and **storyboards download** |
| 4 | Vimeo | `vimeo.com` | **DEAD** — OAuth 401, search 403 | 0 |
| 4b | Bilibili | `api.bilibili.com` | **DEAD** — 412, needs WBI signature + cookies | 0 (reachable second-hand via route 5) |
| 5 | **archive.org h.264 derivatives under 40 MB, fetched whole** | `archive.org` | **WORKS — best video route** | **9 clips, 134.6 MB, exact bytes** |
| 5b | archive.org sparse-range extraction for big items | `archive.org` | works; needed a static `ffmpeg` install | not needed in the end |
| 6 | Reddit non-HTML endpoints | `reddit.com`, `old.reddit.com` | **DEAD** — 403 on `.json` too, both hosts | 0 |
| 7 | Research/GitHub test sequences | `media.xiph.org` | **empty, not blocked** — no game capture exists in it | 0 |
| S1 | Steam burst screenshot series | `steamcommunity.com` | **WORKS** | **4 bursts, 46 frames, 12.9 MB** |
| S2 | Frame strips / sprite sheets | — | superseded by route 1; YouTube storyboards are the fallback | n/a |
| S3 | Same landmark at two distances | via S1 | **WORKS — beat the clip** | `burst-er-lgz` frames 1–3 |
| S4 | Same place at two times/weathers | via S1 | **partial** | `burst-rdr2-destiny` spans three weathers, not one location |

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

### 1e. What was vendored, and what was deliberately not

**207 GIFs, 398.5 MB, 19,600 decoded frames**, all verifying byte-for-byte through
`acquire.py --check`. Against the coordinator's 400 MB GIF budget that leaves 1.5 MB.

| Destination | Files | Content |
|---|---:|---|
| `souls-behaviour/anim/ds1-boss-moves/` | 177 | Dark Souls 1 per-boss, per-move attack animations, 23 bosses |
| `souls-behaviour/anim/telegraph/` | 7 | Elden Ring enemy weapon-art telegraphs (Leyndell Knight/Soldier), Lansseax lightning, Fingercreeper, Astel |
| `souls-behaviour/anim/attacks/` | 12 | Player-side: ER longsword neutral/strong attack chains, ER skills, DS3 Warcry/Soul Greatsword/Perseverance/Dark Hand, DS1 projectile spreads |
| `souls-behaviour/anim/stance/` | 3 | ER Quickstep forward/backward/attack-forward — dodge locomotion |
| `souls-behaviour/anim/impact/` | 4 | DS3 Parry standard / fist / extended, ER Carian Retaliation |
| `souls-behaviour/anim/death/` | 2 | DS Mimic death, ER bloodstain |
| `souls-behaviour/anim/arena/` | 1 | DS bonfire flame loop |

**20 further DS1 boss-move GIFs were catalogued and deliberately not vendored** because they
exceed the per-file cap the GIF budget implies. They are trivially fetchable later — the URL
pattern is in §1a and the exact names and byte sizes are here:

| file | bytes | | file | bytes |
|---|---:|---|---|---:|
| `Gaping-Gorge.gif` | 5,479,904 | | `Nito-Soul-Explosion.gif` | 3,159,275 |
| `Nito-Death-Grip.gif` | 5,190,366 | | `BoC-Chaos-Storm.gif` | 3,131,743 |
| `Kalameet-Hellfire.gif` | 4,610,182 | | `Quelaag-Lava-Long.gif` | 3,113,995 |
| `Centipede-Consume.gif` | 4,600,247 | | `Kalameet-Close-Flame.gif` | 2,816,255 |
| `Ceaseless-2-Burn-Slam.gif` | 3,614,736 | | `Kalameet-Inferno.gif` | 2,626,564 |
| `Centipede-Severed.gif` | 3,586,562 | | *(and 9 more; the full list is `list=allimages` filtered to `210x118` and `size > 2.6e6`)* | |
| `Seath-Explosion.gif` | 3,306,932 | | | |
| `Kalameet-Calamity.gif` | 3,227,150 | | | |

Also **not** vendored, and the reasons, so nobody re-evaluates them:

- **30 orphaned `GIF_20240621_*.gif`** on the Elden Ring wiki. `prop=fileusage` returns empty for
  them, so nothing on the wiki says what they depict. Unlabelled temporal reference is worth much
  less than labelled temporal reference, and they are 5–10 MB each. 7 that *are* labelled were taken.
- **`Oobforest*.gif`, `Salpit*.gif`, `Earlybranch.gif`, `Forestbomb1.gif`** (9–10 MB each): these
  are out-of-bounds glitch and speedrun-route clips. High byte cost, no behavioural bar served.
- **`User9SBackground*.gif`, `Model.gif`, `Textures.gif`, emoticons, forum reaction GIFs**: not
  game capture at all.

---

## 2. Imgur — **DEAD without an API key**

- `i.imgur.com` serves images fine (302/200 verified), so *fetching* a known Imgur asset works.
- **There is no discovery path.** `api.imgur.com/v3/gallery/search` returns **401 Authentication
  required** — every Imgur API endpoint now requires a registered `Client-ID` header.
  `imgur.com/search/...` returns 200 but the body is a JavaScript application shell with no image
  URLs in the HTML, so it cannot be scraped without a browser engine.
- The route is therefore blocked on a credential, not on network reach. **A free Imgur Client-ID
  registration (about two minutes in a browser) would open it.** It is on the manual list in §10.
- Tenor/Giphy were not pursued: both watermark, both re-encode, and route 1 delivered original
  bytes, which makes a watermarked re-encode strictly worse for the same bars.

## 3. YouTube

### 3.1 Invidious host string + `yt-dlp` — **metadata yes, media NO**

**Read this correction before acting on the rest of §3.1.** The Invidious host string does defeat
the bot wall for *extraction*, and it is the reason this section was originally written as a
success. It never yielded a byte of media. Three separate failure modes, all after successful
extraction:

| step | result |
|---|---|
| `-F` / `--print` (format list, title, duration) | **works** — full DASH ladder returned |
| `-f 18` native download of the media URL | `HTTP Error 403: Forbidden` from `googlevideo` |
| `-f 18` on a later attempt | `[SSL: CERTIFICATE_VERIFY_FAILED] self-signed certificate in certificate chain` — the container's egress proxy MITMs TLS and yt-dlp does not use the system trust store for the media host |
| `--download-sections` (ffmpeg pulls the URL) | `ffmpeg exited with code -11` — **the static ffmpeg segfaults on https input through this proxy** |

The TLS failure has a fix — `export SSL_CERT_FILE=/root/.ccr/ca-bundle.crt` — and with it set the
error reverts to a plain `403`. A googlevideo stream URL is bound to the session that minted it,
and this container's egress does not preserve that binding. **So even a `cookies.txt` may not be
sufficient on its own**; whoever supplies one should test a single download before assuming the
route is open. Fetching the finished file in a normal browser (§10 item 2) is the safe form of the
ask.

What follows is what the route *does* deliver — discovery — and it is still worth having.

### 3.1a Extraction behaviour

Passing an Invidious host in the URL changes yt-dlp's extraction path and it succeeds where
`youtube.com` does not:

```
yt-dlp -F "https://yewtu.be/watch?v=iNgDzC_pOi8"      # full DASH ladder, 144p..720p
yt-dlp -f 136 --download-sections "*00:03:00-00:03:25" "https://yewtu.be/watch?v=<id>"
```

Verified working on `iNgDzC_pOi8` (Dark Souls 3 weapons showcase, 1035 s): title, duration and a
complete format list including **136 (1280×720)** and **18 (640×360 progressive)**.
`invidious.nerdvpn.de` behaved identically.

**But it is IP-rate-limited.** Two videos resolved, then every subsequent request from this
container — on `yewtu.be`, `invidious.nerdvpn.de` and `invidious.tiekoetter.com` alike — returned
the same *"Sign in to confirm you're not a bot"* for the rest of the session. Treat this as a
**low-throughput route: a handful of videos per session, not a bulk harvest.** Space requests out,
and expect to fail.

Instance survey (`https://api.invidious.io/instances.json`, 12 instances listed):

| instance | result |
|---|---|
| `yewtu.be` | works, then rate-limits |
| `invidious.nerdvpn.de` | works, then rate-limits |
| `invidious.tiekoetter.com` | bot wall |
| `invidious.f5.si` | yt-dlp: `Unsupported URL` |
| `yt.chocolatemoo53.com` | HTTP 403 |
| `inv.nadeko.net` | HTTP 418 |
| `vid.puffyan.us` | proxies to youtube.com; inherits the bot wall |
| `inv.zoomerville.com` (the only `api: true` instance) | `/api/v1/...` → **403** |

`yewtu.be/api/v1/search` returns a *"Verifying your browser…"* interstitial, so the Invidious
**search** API is closed even where the watch path works.

### 3.2 youtube.com direct — **DEAD, confirmed across every player client**

`yt-dlp 2026.07.04`, one video, eight clients:

| client | result |
|---|---|
| `tv_simply`, `android_vr`, `android_producer`, default `web` | *Sign in to confirm you're not a bot* |
| `tv` | *This video is DRM protected* |
| `web_creator` | *Please sign in* |
| `ios`, `mweb`, `web_embedded` | player response returned, but **storyboard formats only** |

This confirms and extends `ACQUISITION-REPORT.md` §15.6. A `cookies.txt` exported from a signed-in browser is the obvious next thing to try, but see the
correction in §3.1: the failure is downstream of authentication, so a cookie jar may not be
sufficient by itself.

### 3.3 Two things that *do* work on youtube.com, and are worth knowing

1. **Search works even though download does not.**
   `yt-dlp --flat-playlist --print "%(id)s|%(duration)s|%(channel)s|%(title)s" "ytsearch10:<query>"`
   returns IDs, durations, channels and titles with no player-API call and therefore no bot wall.
   **Use YouTube for discovery, then fetch the same content from archive.org (§5) or hand the ID
   to a human (§10).** Every candidate in §10 was found this way.
2. **Storyboards are downloadable.** The `ios`/`mweb`/`web_embedded` clients expose `sb0`–`sb3`,
   and `yt-dlp -f sb0` fetches them: an `.mhtml` grid of **320×180 frames at roughly 1 fps**.
   A storyboard **is a frame strip** — A8's substitute 2, generated automatically for every video
   on YouTube. 270 KB covered a 33 s clip. Useless for jerk or hitstop; usable for shot-level
   progression, weather change and "did this geometry exist five seconds ago". One was pulled as
   proof the route works. It was not committed because §5 delivered real video for the same bars.

## 4. Vimeo and Bilibili — **both reachable, both closed**

| | result |
|---|---|
| `vimeo.com` | host 200. `yt-dlp https://vimeo.com/76979871` → **`Failed to fetch macos OAuth token: HTTP Error 401`**. Search page → **403**. Dead without credentials. |
| `bilibili.com` | host 200. `api.bilibili.com/x/web-interface/search/type` → **HTTP 412** (Bilibili's anti-bot; the endpoint now needs a WBI-signed request plus cookies). A known BV id via `yt-dlp` returned *"may be deleted or geo-restricted"*. Dead without cookies. |

Note: Bilibili content **is** partly reachable second-hand — archive.org carries items named
`BiliBili-BV...`. That goes through route 5, not through Bilibili.

## 5. archive.org — **the best video route, and the round-1 approach to it was wrong**

Round 1 looked at archive.org, found an 82 GB source upload with no derivative, and stopped. The
correct move is the opposite of chasing the big items:

```
# 1. search SMALLEST FIRST, not most relevant first
curl -G https://archive.org/advancedsearch.php \
  --data-urlencode 'q=mediatype:movies AND title:("Ghost of Tsushima") AND title:gameplay' \
  --data-urlencode 'sort[]=item_size asc' --data-urlencode 'fl[]=identifier' \
  --data-urlencode 'fl[]=item_size' --data-urlencode 'output=json'

# 2. list the item's files and take the h.264 derivative, not the source
curl https://archive.org/metadata/<identifier>      # look for *.ia.mp4 / *.mp4, format "h.264"

# 3. fetch it whole
curl -L -o out.mp4 "https://archive.org/download/<identifier>/<filename>"
```

**A huge number of gameplay items have an `h.264` derivative under 40 MB.** Fetched whole, those
are **exact bytes** — no range extraction, no ffmpeg, no remux, and a full `acquire.py` record
that verifies. That is strictly better than any cut clip.

Two further facts that make this route much larger than it looks:

- **archive.org mirrors YouTube.** Items named `youtube-<videoid>` are complete mirrors of YouTube
  uploads. **This bypasses YouTube's bot wall entirely for anything that happens to be mirrored.**
  Three of the nine clips committed came in this way.
- **Twitch is mirrored too**, as `twitch-vod-*` and `twitch-clips-*`. `twitch-clips-*` items are
  short by construction.

### 5.1 The sparse-range technique, for when the derivative really is too big

If an item has no small derivative, do **not** download it. Create a sparse local file of the
remote length, fill `[0, moov_end)` (a faststart MP4 keeps its index at the front), fill a byte
window around the wanted timestamp estimated from the average bitrate, and run
`ffmpeg -ss … -t … -c copy`. The video bitstream is not re-encoded; the cut is container-level.
Working implementation: `clip.py` in the acquisition scratchpad. Note archive.org **500s on bursts
of range requests** — retry with a growing backoff rather than losing the range.

**`ffmpeg` is not installed in this container and `apt-get install ffmpeg` FAILS** (the Ubuntu
archive 404s on `mesa-va-drivers` dependencies). Install the static build instead:

```
curl -sL https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz | tar xJ
cp ffmpeg-*-static/{ffmpeg,ffprobe} /usr/local/bin/
```

### 5.2 What was vendored

**9 clips, 134.6 MB** against a 250 MB budget. Every one is byte-exact.

| path | game | res / fps / length | serves |
|---|---|---|---|
| `video/V1-dolly__elden-ring-liurnia.mp4` | Elden Ring | 854×480 60 fps, 288 s | M11 LOD, M12 water, VIS04 wind, CAM01/03 |
| `video/V1b-dolly__elden-ring-low-end-pc.mp4` | Elden Ring | 854×480 30 fps, 436 s | **M11 specifically** — constrained hardware makes streaming and LOD transitions visible |
| `video/V3-locomotion__ghost-of-tsushima-combat.mp4` | Ghost of Tsushima | 854×480 60 fps, 147 s | **VIS04 wind** (best published wind reference obtainable), CAM07 rear view, WPN01/05 |
| `video/V2-static__ghost-of-tsushima-720p.mp4` | Ghost of Tsushima | 1280×720, 12 s | VIS04/VIS03 at the set's highest resolution |
| `video/V2b-static__rdr2-ragdoll-720p.mp4` | RDR2 | 1280×720 30 fps, 16 s | VIS08 §C — the keyframe→physics handover, a state change no still can show |
| `souls-behaviour/anim/attacks/SB-VID__ds3-iudex-gundyr-boss.mp4` | Dark Souls III | 1280×720, 29 s | A5 attacks/telegraph/impact **and** CAM01/03/06 lock-on reframing |
| `video/MW1-traversal__morrowind-balmora-to-suran-jump.mp4` | Morrowind | 960×720, 26 s | Morrowind LOD and fog band **as the camera moves** |
| `video/MW2-press__morrowind-g4tv-2002.mp4` | Morrowind | 640×480 24 fps, 121 s | Morrowind water surface + first-person swing arc; **2002 broadcast, predates every graphics mod** |
| `video/MW3-locomotion__morrowind-third-person-walk.mp4` | Morrowind | 640×480, 122 s | Morrowind third-person walk cycle and camera-behind framing |

**The Morrowind three did not exist in any form before this round.** The corpus had no moving
image of Morrowind at all, and `MW2` is the only artifact in the whole reference set whose vanilla
status is beyond argument — it is television footage from 2002.

### 5.3 Three archive.org candidates were downloaded and then rejected

Recorded so nobody re-fetches them:

| item | why rejected |
|---|---|
| `twitch-vod-v90109671` "Pontiff Blind Parry Fail, Dark Souls 3" (6.4 MB) | A Twitch stream capture: a live **webcam of a real person** bottom-right and a speedrun-splits panel covering the right third of every frame. §8's overlay rule and basic taste both say no. |
| `sekiro-shadows-die-twice-gameplay-pc-…` (3.9 MB) | **Vertical, 360×640.** A vertical crop destroys exactly the thing a camera reference is for. |
| `a-regular-day-in-morrowind` (13.2 MB) | 1920×1080 Morrowind, but a real person is composited over the lower half of the frame throughout. Not an in-game render. |

## 6. Reddit — **DEAD**

`reddit.com/r/<sub>/top.json` and `old.reddit.com/r/<sub>/top.json` **both return HTTP 403** with an
identical 189,908-byte block page, with and without a browser User-Agent. The `.json` endpoint is
not a bypass any more; Reddit blocks the whole origin at the edge for this container. `v.redd.it`
was not reached because no URLs could be discovered. Do not re-test.

## 7. GitHub / research test sequences — **no game capture**

`media.xiph.org/video/derf/` — the canonical free test-sequence collection — is broadcast and
videoconference material (`akiyo`, `bus`, `city`, `foreman`, `bridge`, `claire`). There is no game
capture in it, and its content is 1990s CIF/QCIF. Nothing there serves M11, M12, VIS04 or any A5
bar. Graphics-research repositories vendor *rendered* test scenes rather than *game* capture, which
is a different thing from what A5 and RI-VIS03 ask for. **Route abandoned as genuinely empty, not
as unreachable.**

## 8. The substitutes — done, and one of them beat the clip

### S1. Steam burst screenshot series — **works, and is cheap**

Method: `https://steamcommunity.com/app/<appid>/screenshots/?p=<n>&browsefilter=mostrecent`,
parse `data-publishedfileid` and the author from each `apphub_Card`, group by author, and cut the
sorted sid list wherever the gap exceeds a threshold. `publishedfileid` is monotonic in upload time
across all of Steam (97 dates, 0 violations — established by ref-builder-r1), so a run of one
author's sids on one app is a set of uploads seconds apart, therefore captures from one session,
**in order**.

Four bursts were harvested, contact-sheeted and **eyeballed**. 46 frames, 12.9 MB, in
`refs/temporal-substitutes/`.

| burst | frames | what the contact sheet actually shows |
|---|---:|---|
| `burst-er-lgz` (Elden Ring) | 8 | **Frames 1–3 are the same grand doorway at three progressively nearer camera distances.** That is a dolly-in captured as three stills, and it measures LOD state at three distances **more directly than a 480p clip of a dolly does**. Frames 7–8 are one rear-view figure walking, two moments apart. |
| `burst-rdr2-destiny` (RDR2) | 24 | Contains a deer at a misty dawn lake photographed from **three** camera positions, two moments of one barn conversation, and a two-frame hand-raised / hand-lowered pair. Also spans dawn, storm and night — a time-of-day and weather set from one player. |
| `burst-er-vivian` (Elden Ring) | 8 | One continuous cutscene (the Ranni ending) sampled eight times: camera and character animation both progress across the series. |
| `burst-rdr2-skripochka` (RDR2) | 6 | A short session sequence. |

Every record carries `substituted_for`, and a `deviation` that states the limit in terms a critic
can act on: **members are seconds apart, not 1/60 s apart, so a burst can never measure jerk, pose
rate, blend frames, hitstop or foot slide.** What it *can* measure — LOD state at two or more
camera distances, weather and time-of-day change, before/after world state — it measures cleanly.

### S2. Frame strips and sprite sheets

Two sources found. **The wiki GIFs themselves are the better one**: 207 files, 19,600 frames,
per-move labelled, original bytes. A published frame-data strip would be a *screenshot of* what we
now hold as decodable frames. The other is **YouTube storyboards** (§3.3), which are a frame strip
for any YouTube video, at 320×180 and about 1 fps. Neither needed further acquisition.

### S3. Same landmark at two distances (the LOD substitute)

**Filled by `burst-er-lgz` frames 1–3**, which give three distances rather than two, from one
author in one session, with lighting and weather held constant. This is the single cleanest M11
artifact in the whole set and it is a screenshot triple, not a clip.

### S4. Same place under different weather or time of day

**Partly filled** by `burst-rdr2-destiny`, which spans dawn mist, overcast storm and night within
one author's session — but *not* at one fixed location, so it substitutes for "the sky changed"
rather than for "this exact view changed". A same-location pair was not obtained. It is on the
manual list in §10.

---

## 9. Per-bar coverage after this round

The table A8 opens with, answered. "Evidence" names files that exist on disk and verify.

| Bar | What a still cannot show | Evidence now on disk | Class (A3) |
|---|---|---|---|
| `RI-VIS03` **M11** LOD pop | geometry appearing as the camera moves | `V1b-dolly__elden-ring-low-end-pc` (436 s on constrained hardware — the clip where pop-in is *expected* to be visible), `V1-dolly__elden-ring-liurnia` (288 s traversal), `MW1-traversal__morrowind-balmora-to-suran-jump` (a whole region entering and leaving the fog band in 26 s), **and `burst-er-lgz` frames 1–3, one doorway at three camera distances** | **RESOLVED** |
| `RI-VIS03` **M12** water temporal variance | a surface changing frame to frame | `V1-dolly__elden-ring-liurnia` (lake shallows, mounted and on foot), `MW2-press__morrowind-g4tv-2002` (vanilla Morrowind water with reflection) | **RESOLVED**, with a resolution caveat: 854×480 and 640×480 h.264 cannot resolve fine normal-map ripple. Judge *whether and how* the surface moves, not its spatial detail. |
| `RI-VIS04` wind | foliage moving at more than one frequency | `V3-locomotion__ghost-of-tsushima-combat` (147 s — Ghost of Tsushima drives grass, reeds, leaves, cloth and banners from one wind field at clearly separated frequencies; this is the best published wind reference obtainable), `V2-static__ghost-of-tsushima-720p`, `V1-dolly__elden-ring-liurnia` | **RESOLVED** |
| `RI-VIS08` §C animation | pose rate, jerk, foot slide, blend frames, T-pose leak | **207 GIFs = 19,600 decoded frames**, per-move labelled; `MW3-locomotion__morrowind-third-person-walk` (122 s walk cycle); `V2b-static__rdr2-ragdoll-720p` (keyframe→physics handover) | **RESOLVED for pose, blend and foot contact. NOT resolved for absolute rates** — see the warning below. |
| **A5** attacks, telegraph, impact | windup → active → recovery as a sequence; hitstop | 177 DS1 per-move boss animations across 23 bosses; 12 player-side ER/DS3 attack chains and weapon arts; 4 parry clips; `SB-VID__ds3-iudex-gundyr-boss` (720p boss fight) | **RESOLVED**. Absolute hitstop *frame counts* remain IMPOSSIBLE (already accepted in `ACQUISITION-REPORT.md` §15.6); the dependent bar must stay an ordering claim, not a frame claim. |
| `RI-CAM01`/`03`/`06` | spring-arm pull-in, lock-on reframing, shake | `SB-VID__ds3-iudex-gundyr-boss` (lock-on reframing against a moving boss at 720p — the only artifact in the corpus that shows it), `V1-dolly__elden-ring-liurnia` (spring-arm over uneven terrain), 3 ER Quickstep GIFs (camera-relative dodge directions) | **CAM01 and CAM03 RESOLVED. CAM06 (shake) is thin** — no clip isolates a shake event. |

### The one thing that must not be over-read

**No artifact here establishes an absolute frame rate.** A GIF's inter-frame delay is whatever the
uploader's exporter wrote, not the game's frame time. `MW2` is a 24 fps television transfer of a
game that ran at something else. `V1b` is deliberately a low-frame-rate capture. So:

> Every temporal record is `pixel_metrics_valid: false`, and every *rate* claim derived from this
> material must be **relative** (this windup is longer than that one; the dodge recovers before the
> follow-up lands) and never absolute (`14 f@60`). Frame *counts* in the corpus come from the
> verified frame-data tables, not from these clips. The clips show **shape**; the tables show
> **timing**; neither substitutes for the other.

## 10. What a human with a normal browser should fetch — the short list

Everything below is blocked on a credential or a browser, not on effort. Ordered by leverage.

**1. Six specific YouTube videos, downloaded in your browser.** This is the ask, and it is
deliberately not "give me a cookies.txt" — §3.1 shows the block is downstream of authentication
(the `googlevideo` URL 403s for this container even after successful extraction), so a cookie jar
might not fix it and a file that is already downloaded certainly does. All six were found with
`ytsearch`, all six are confirmed to exist, and each takes one click with any browser downloader.
**Any 20–40 s span is enough; 1080p60 preferred; please do not re-encode or trim in an editor —
the raw download is what we want.**

| video id | length | what it is | bar it fills |
|---|---:|---|---|
| `2GiNk_CnyTw` | 33 s | *Cyberpunk 2077 2.xx — terrible draw distance, low quality LODs* | `RI-VIS03` M11 at high resolution — the current set's M11 evidence is all 480p |
| `Pj2oGtQOWu8` | 19 s | *Cyberpunk 2077 pop-in of ground elements as driving* | M11, high-speed camera |
| `eVPbaUwXWl4` | 29 s | *RDR2 water graphics gameplay* | `RI-VIS03` M12 at high resolution |
| `I8zDlUzUGDM` | 60 s | *What a beautiful water reflection in RDR2* | M12, reflection specifically |
| `c9akEr9y7XA` | 301 s | *Elden Ring — Godrick the Grafted boss fight (4K 60 fps)* | `RI-CAM01/03/06` — lock-on reframing **and camera shake**, the one gap left in §9. Take 00:40–01:15. |
| `iNgDzC_pOi8` | 1035 s | *Dark Souls 3: Weapons Showcase — all movesets and weapon arts* | `RI-WPN01`–`04` per weapon **class** (the GIFs are per *move*, mostly boss-side). Any 30 s span. |

**2. A free Imgur Client-ID** (imgur.com/account/settings/apps, ~2 minutes). Imgur *serves* fine;
only its search API is closed, and it needs nothing but a registration. This opens the one
community-clip source that is neither YouTube nor archive.org.

**3. Two Morrowind screenshots, if you own the game** — the only S4 gap left (§8):
the **same view from the same spot**, once in clear weather and once in a storm or at night.
Two minutes in-game, and it closes the weather-transition substitute that nothing published fills.

**4. One Digital Foundry LOD or frame-rate analysis clip**, from any host that is not YouTube.
DF footage is the only material that is *authored* to make LOD transitions visible; everything we
have makes them visible by accident.

Nothing on this list is *required* for a bar that is currently unfilled — §9 shows every A8 bar
resolved except `RI-CAM06` camera shake. Item 1 raises the **resolution** of M11/M12 evidence that
is currently all 480p; item 1's `c9akEr9y7XA` and item 4 close CAM06; item 3 closes S4; item 2
opens a source rather than filling a bar.

If only one thing gets done, make it **`c9akEr9y7XA`, 00:40–01:15**. It is the only item on this
list that closes an open bar rather than improving a closed one.

## 10a. Note on paths

A concurrent builder reorganised the animation GIFs from the A5 subfolders into a single
`souls-behaviour/anim/` tree (`anim/ds1-boss-moves/`, `anim/telegraph/`, `anim/attacks/`,
`anim/stance/`, `anim/impact/`, `anim/death/`, `anim/arena/`) and updated `_provenance.json`
accordingly. Paths in this file are the post-move ones. `acquire.py --check` passes on
**640 of 640** reference files after the move.

## 11. Accepted as IMPOSSIBLE, restated

Only one thing survives every route in this file:

- **Frame-exact hitstop and frame-count calibration from published video.** Already accepted in
  writing in `ACQUISITION-REPORT.md` §15.6, and this round changes nothing about it: no clip in
  existence is published at a known, unaltered frame cadence with a frame counter on screen. The
  dependent bar (`RI-WPN05`) must be stated as an **ordering** — dagger < ultra greatsword — and
  never as absolute frames. The `souls-behaviour/anim/impact/` GIFs and `SB-VID__ds3-iudex-gundyr-boss`
  bound the *appearance* of a connecting hit; they do not bound its duration.

Every other gap A8 named is now either filled or reduced to a two-minute browser action in §10.
