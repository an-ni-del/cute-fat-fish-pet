# Differences from upstream `dsh-pet` 0.3.0

This document exists so that nobody has to take our word for what came from where. Every number below can be regenerated on your own machine with the commands at the end of this page, and every change we made is marked in the source with a `[local patch …]` comment.

**Short version:** of the 243 files in the published upstream package `dsh-pet@0.3.0`, **225 are byte-identical in our `src\`**, **18 differ**, **0 are missing**, and we added **2 engine files** of our own (plus `node_modules`, which upstream does not publish).

[中文摘要见文末](#中文摘要)

---

## What is being compared

| Side | What it is |
| --- | --- |
| Upstream (baseline A) | `dsh-pet@0.3.0` as **published on npm** — the built package that `dsh plugin add dsh-pet@0.3.0` installs. 243 files. |
| Upstream (baseline B) | The **git tag `v0.3.0`** of <https://github.com/PC2005-cloud/dsh-pet> — the source repository, which also contains files the package does not ship. 332 files under `dsh-pet/`. |
| Ours | This repository's `src\` — the pet engine exactly as it is copied into the installer. 604 files. |

Both upstream artifacts are MIT-licensed and publicly downloadable, which is the point: the comparison is reproducible without any private access.

## Two things to know before the tables

Otherwise the numbers you get will not match this page.

- **The script folds line endings for text files.** `build/compare-upstream.mjs` hashes and measures text files **LF-normalized** (`\r\n` → `\n`); binary files are left raw, decided by git's own heuristic — a NUL byte in the first 8000 bytes means binary — so every `.webm`, `.png` and `.ttf` is compared byte-for-byte as it ships. A Windows checkout with CRLF therefore reports the same numbers as a Linux one, and the `Ours` column below is exactly what the script prints.
- **The numbers describe the working tree, LF-normalized, as measured while writing this page.** `src\lib\index.js`, `src\runtime\electron-helper\main.js`, `sprite.js` and friends are patched from time to time and some of those patches may still be uncommitted; re-run the commands at the end of this page after committing to confirm.

## Headline numbers (baseline A: the published package)

| | Files | Bytes |
| --- | --- | --- |
| Upstream package | 243 | — |
| Our `src\` | 604 | — |
| **Byte-identical** (same git blob SHA-1) | **225** | — |
| **Different** | **18** | see the table below |
| **Upstream files missing from ours** | **0** | — |
| **Only here** | 360 | 9,577,728 |

Where the 225 identical files live:

| Directory | Files | Bytes |
| --- | --- | --- |
| `assets/` (animations, memes, fonts, previews) | 143 | 63,573,365 |
| `src/` (TypeScript sources of the engine) | 45 | 465,901 |
| `lib/` (build output other than `index.js` and `client.js`) | 32 | 99,494 |
| `runtime/electron-helper/` (`constants.js`, `host-liveness.js`, `pointer-target.js`, `renderer.js`) | 4 | 23,888 |
| `scripts/` | 1 | 2,440 |

*45 of the 50 upstream TypeScript source files are byte-identical* — that is the strongest single piece of evidence about provenance: the engine's source is upstream 0.3.0, with our changes visible in the five TypeScript files in the table below and in the packaged runtime.

## The 18 files that differ

`Markers` = how many lines in that file carry a `[local patch …]` / `[bridge-auth@…]` tag. The five marked files below (`sprite.js`, `main.js`, `preload.js`, `shared-core.js`, `lib/index.js`) account for **164** of them, and the other 13 differing files carry no tag at all, so the column is `0` for them. Counted over the whole `src\` it comes to **210 lines across 8 files** — the remaining 3 are in files we added ourselves (`lib/idle-signal.js`, `obs-ctl.js`, `host/idle-signal.test.ts`) and just cross-reference the convention. The reproduction command is at the end of this page.

| File (relative to `src\`) | Upstream | Ours | Markers | Why it differs |
| --- | --- | --- | --- | --- |
| `cordis.patch.yml` | 1,070 | 1,088 | 0 | the bundle/patch name is `cute-fat-fish-pet`, not `dsh-pet` |
| `LICENSE` | 1,069 | 1,095 | 0 | one added copyright line; upstream's MIT body is untouched |
| `lib/client.js` | 137,486 | 137,974 | 0 | build output of the patched client half (`src/client/index.ts`, `src/client/settings.ts`) |
| `lib/index.js` | 82,799 | 119,120 | 21 | balance display, "follow the global switch", chat-priority routing, answering "online or offline?" from the configuration, the idle gate; hand-maintained — the pet registry lives in `lib/pet-registry.js` next to it |
| `package.json` | 4,615 | 5,070 | 0 | our identity (description, author, links, version `1.2.1`) plus our `scripts` and the `tsdown` toolchain |
| `README.md` | 30,116 | 3,956 | 0 | replaced by a short project-specific readme; upstream's full readme is kept next to it as `UPSTREAM-README.md` |
| `runtime/electron-helper/events.js` | 17,500 | 18,069 | 0 | permission/chat-priority adjustments; no marker text of its own |
| `runtime/electron-helper/index.html` | 5,839 | 6,001 | 0 | loads our extra `targets.js` ("open X" target classification) before `sprite.js` |
| `runtime/electron-helper/main.js` | 54,047 | 127,014 | 30 | local control bridge (now with a token + CORS allow-list), OBS recording channel, cursor broadcast (with an idle back-off), persona/desktop IPC, folder/file opens, idle-activity reporting |
| `runtime/electron-helper/package.json` | 185 | 258 | 0 | our version plus the files this package ships |
| `runtime/electron-helper/preload.js` | 3,520 | 7,416 | 11 | the renderer-side counterparts of those bridges (cursor, TTS, canvas) |
| `runtime/electron-helper/shared-core.js` | 51,376 | 52,708 | 1 | chat-send hook (a question is answered before idle chatter) |
| `runtime/electron-helper/sprite.js` | 61,132 | 201,046 | 101 | menu state, drag-hold, speech stats, gaze/cursor handling, animation fixes, typed 「open X」 routing |
| `src/client/index.ts` | 647 | 1,915 | 0 | the client entry is rewritten so the bundle matches what the host's `buildComboScript` expects (the whole bundle wrapped in one IIFE) |
| `src/client/settings.ts` | 52,779 | 52,799 | 0 | the uninstall command strings say `cute-fat-fish-pet` instead of `dsh-pet` |
| `src/host/helper-process.ts` | 26,638 | 27,571 | 0 | privacy: no hard-coded user paths; the runtime path is resolved from the installation directory |
| `src/host/pointer-target.test.ts` | 15,312 | 16,237 | 0 | the cursor assertion was loosened to match the local "read the cursor once per tick" refactor |
| `src/host/storage-paths.test.ts` | 6,540 | 7,039 | 0 | the test uses placeholder names instead of a real user name |

The packaged runtime files are noticeably larger than the npm artifacts. They are the *working copies* of the installed engine (which also carry our patches), not a rebuild of the published bundle, so byte-equality there was never expected — that is why this table exists instead of a claim.

## Files that exist only here

| Path | Files | Bytes | What it is |
| --- | --- | --- | --- |
| `node_modules/` | 348 | 9,487,014 | the engine's runtime dependencies; upstream does not publish them, `npm install` recreates them |
| `(root)/` | 4 | 35,980 | `README.zh-CN.md`, `UPSTREAM-README.md` (upstream's full readme, kept and annotated), `screenshots.json`, `tsdown.config.ts` |
| `runtime/electron-helper/` | 2 | 26,173 | `obs-ctl.js` (OBS WebSocket recording channel), `targets.js` (turn what the owner asked for into a URL / a folder or file / an app name) |
| `src/` | 3 | 12,366 | our own host-side tests: `host/idle-signal.test.ts`, `host/pet-registry.test.ts`, `client/bundle-contract.test.ts` |
| `lib/` | 2 | 6,760 | `pet-registry.js` (hand-written pet registry), `idle-signal.js` (host half of the idle gate) |
| `scripts/` | 1 | 9,435 | `build-lib.mjs` (refuses to overwrite the hand-maintained `lib/index.js`) |

## Second view (baseline B: the `v0.3.0` source tag)

*Measured in the same run as baseline A, with the same script and the same `src\` (command in §Reproduce).*

| | Files |
| --- | --- |
| Byte-identical | 193 |
| Different | 15 |
| Only upstream | 124 |
| Only ours | 395 |

The extra 124 upstream-only files are mostly `assets/preview/*.gif` (the animated previews the upstream *repository* uses in its readme; they are not part of the installed package) plus `.prettierignore` and `.prettierrc.json`. Our extra files are `node_modules\`, the `lib\` build output (upstream build output is not committed at the tag) and the engine files above. So the two baselines measure two different things on purpose: A says "the code and assets you ship are upstream's", B says "you did not delete anything from the project either".

## Honest limits

- No upstream file was deleted, and upstream's own MIT text ships byte-identical as `assets\LICENSE.txt`; the credit lines are untouched (see [NOTICE.md](../NOTICE.md)). Upstream's full readme is preserved as `src\UPSTREAM-README.md`.
- `src\lib\client.js` is build output produced from `src\src\client\` (reproducible byte-for-byte with `npm run build:lib:check`); `src\lib\index.js` and `src\lib\pet-registry.js` are *hand-maintained* host-side files — the host half carries local patches that exist only in the shipped JS, which is why `src\scripts\build-lib.mjs` refuses to overwrite `index.js`.
- We do not claim every one of the 18 differences is an improvement — several are simply our product's identity (name, links, version) and a few are privacy or test-robustness fixes.
- The marker count (167 tagged lines under `src\`, 164 of them inside the five files listed above) counts *comment lines we added*; individual hunks are visible with `git log -p` or by searching for `local patch`.
- This page tracks the engine, not the installer: the `standalone\`, `launcher\` and `dsh-plugin\` trees around `src\` are ours from the start.

## Reproduce it

```powershell
# Baseline A — the published npm package (about 62 MB)
iwr "https://registry.npmjs.org/dsh-pet/-/dsh-pet-0.3.0.tgz" -OutFile dsh-pet-0.3.0.tgz
python -m tarfile -e dsh-pet-0.3.0.tgz _upstream\npm-0.3.0
node build/compare-upstream.mjs --dir _upstream\npm-0.3.0\package --md _accept\compare-a.md

# Baseline B — the source tag (one small API request, no download of file contents)
# PowerShell 5's `>` writes UTF-16, which is not JSON — use -OutFile (or Out-File -Encoding utf8) instead
iwr "https://api.github.com/repos/PC2005-cloud/dsh-pet/git/trees/v0.3.0?recursive=1" -OutFile _upstream\upstream-tree-v0.3.0.json
node build/compare-upstream.mjs --tree _upstream\upstream-tree-v0.3.0.json --md _accept\compare-b.md

# The Markers column: lines carrying a `[local patch …]` / `[bridge-auth@…]` tag
$m = Get-ChildItem src -Recurse -File -Include *.js,*.ts,*.json,*.yml |
  Where-Object { $_.FullName -notmatch '\\node_modules\\' } |
  Select-String -Pattern '\[local patch|\[bridge-auth'
$m | Group-Object Path | ForEach-Object { "{0,4}  {1}" -f $_.Count, $_.Name }
"total marker lines = $($m.Count) across $((($m | Group-Object Path).Count)) files"
```

The script compares **git blob SHA-1** values (`sha1("blob <size>\0" + content)`), which is what GitHub's tree API reports, so baseline B needs no file downloads at all. `--json <file>` writes the full per-file result if you want to diff it yourself. It folds `\r\n` to `\n` for text files before hashing (see "Two things to know"), so its output is the same on Windows and Linux.

---

## 中文摘要

- **对比对象**：①npm 上发布的 `dsh-pet@0.3.0`（安装包形态，243 个文件）；②上游仓库 `v0.3.0` 标签的源码树（332 个文件）。
- **结论（以发布包为准）**：243 个文件里 **225 个逐字节相同**、**18 个不同**、**0 个缺失**；我们另加 `runtime/electron-helper/obs-ctl.js`、`targets.js` 两个引擎文件，以及不随上游发布的 `node_modules\`（348 个文件）。
- **最有说服力的一条**：上游 50 个 TypeScript 源文件里 **45 个逐字节相同** —— 引擎源码就是 0.3.0 的，改动集中在下面五处以及打包后的运行端文件里（`src/client/index.ts`、`settings.ts`、`src/host/helper-process.ts` 与两个测试）。
- **18 个不同的文件**：`sprite.js`（61,132→201,046，101 处标记）、`main.js`（54,047→127,014，30 处）、`preload.js`（3,520→7,416，11 处）、`shared-core.js`（51,376→52,708，1 处）、`events.js`（17,500→18,069）、`lib/index.js`（82,799→119,120，21 处）、`lib/client.js`（客户端产物）、`src/client/index.ts`、`src/client/settings.ts`、`src/host/helper-process.ts`（隐私：不再硬编码用户路径）、`src/host/pointer-target.test.ts`、`src/host/storage-paths.test.ts`、`cordis.patch.yml`、`LICENSE`（多一行版权署名）、`runtime/electron-helper/index.html`、`package.json`（本仓库身份：名称/作者/链接/版本 1.2.1）、`runtime/electron-helper/package.json`、`README.md`（换成了简短的项目自述，上游全文保留为 `UPSTREAM-README.md`）。
- **口径**：脚本对**文本文件按 LF 归一后**再算 SHA-1 与字节数（二进制文件保持原样，判据用 git 自己的启发式：前 8000 字节里出现 NUL 即二进制）。所以在 Windows 的 CRLF 检出上跑，结果与 Linux 上一致，和本页数字相同；`Ours` 一列就是脚本直接打印出来的值。
- **我们没有删掉上游任何文件**；上游 MIT 全文以 `assets\LICENSE.txt` 逐字节随包分发，署名两行原样保留，上游完整 readme 保留为 `src\UPSTREAM-README.md`（见 [NOTICE.md](../NOTICE.md)）。
- **可复跑**：文末命令即可自行核对（基线 A 需要下载 62 MB 的 npm 包；基线 B 只需一次 API 请求，脚本比的是 git blob SHA-1，不下载文件内容）。
