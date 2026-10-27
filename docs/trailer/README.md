# Blueprint Reader trailer

[Watch the 42-second trailer](https://ibrews.github.io/ue5-mcp/trailer/) · [Poster](../assets/blueprint-reader-trailer-poster.jpg) · [Try the reader](https://ibrews.github.io/ue5-mcp/)

A captioned 1920 × 1080, 30 fps product trailer for Alex Coulombe Presents. It opens with Alex's story about overloading Claude with raw Blueprint text, then shows a real link becoming a compact brief. All essential information is on screen; the original instrumental score is optional. There is no voiceover.

## Transcript

| Time | On-screen story |
|---|---|
| 0–5s | I accidentally broke Claude. With too much raw Blueprint code. A whole graph. Plus its macros. |
| 5–9s | So I built a way to read it first. Blueprint Reader. A graph first. A smaller prompt next. Raw text or BlueprintUE → a compact brief. |
| 9–15s | Paste a real BlueprintUE link. One link. No installation. The helper fetches the export. Your browser parses it. `blueprintue.com/blueprint/6v52d8no/` |
| 15–20s | An overview. The gaps, too. Actual result: 1 graph, 30 nodes, 107 pins, 1 context/link warning. HandleScriptFunction is a callable function graph; visible nodes update the interface and write ReturnVal, HasArt and Hired. |
| 20–27s | Copy a compact brief. 81,358 source bytes → 1,336 brief bytes. A summary, not lossless compression. Save the full session for follow-up. |
| 27–32s | Go deeper when you need to. Trace an entry. Inspect exact nodes. Keep the original source. The interface shows static pin connections, not a runtime schedule. |
| 32–36s | Bring the brief to Codex or Claude. Start small. Ask better follow-up questions. Local parsing. No AI API key in the reader. |
| 36–42s | Blueprint Reader. Understand the graph. Keep the context small. `ibrews.github.io/ue5-mcp/`. Free. MIT licensed. Try it in your browser. Alex Coulombe Presents. |

## Capture provenance and claims

- Captured on 2026-10-27 in the Codex in-app browser from the [live reader](https://ibrews.github.io/ue5-mcp/), reader 0.3.1 at source commit `a41c642987ce0b1db5b1caac442f702f8d9ce2f0`.
- Demo: [Extended dialogue system, posted by Nicola](https://blueprintue.com/blueprint/6v52d8no/), a publicly accessible BlueprintUE export. The limited source and analysis excerpts in the UI are attributed to Nicola; the underlying graph remains its author's work. This repository does not redistribute the full export.
- The screenshots show the real input, reading state, result, brief and entry trace. The trailer crops and reframes those captures, adds editorial captions, and edits for pace. It is **not** a continuous screen recording or a measured import-time benchmark. No result text was fabricated or replaced.
- The demo has 30 nodes, 107 pins and 38 wires. Its 81,358 decoded UTF-8 source bytes produce a 1,336-byte brief. The warning identifies an unavailable engine ForEachLoop macro body. The brief omits detail; byte counts do not establish token or cost savings.
- The story refers to Alex's earlier experience. The demo graph is an illustrative public example, not a claim that this specific export broke Claude. The faint opening code ribbon uses this repository's own synthetic fixture.
- The reader uses deterministic parsing, descriptions and static checks. It makes no AI calls. An assistant can use the resulting brief separately. BlueprintUE links go through the fetch helper; graph parsing stays local. Pasted text/files are never uploaded.
- No private project data, Claude conversation, third-party music, voice clone or stock video appears. The layout, animation, soundtrack and render script were created for this project under its MIT license. System fonts are referenced locally and are not redistributed.

## Rebuild

Requirements: Python 3.11+, Node.js 20+, FFmpeg with libx264/AAC, and Georgia, Arial and Courier New fonts. The default font directory is macOS's `/System/Library/Fonts/Supplemental`; pass `--font-dir` for a compatible local directory with those font filenames. Keep scratch files in the reader's ignored `work` folder.

From the repository root:

```sh
python3 -m venv skills/blueprint-reader/work/trailer/venv
skills/blueprint-reader/work/trailer/venv/bin/pip install -r docs/trailer/requirements.txt
skills/blueprint-reader/work/trailer/venv/bin/python docs/trailer/render.py --preview-only
skills/blueprint-reader/work/trailer/venv/bin/python docs/trailer/render.py
```

The script uses the checked-in captures without network access. It writes the MP4 and poster to `docs/assets/`; intermediate video, audio and a contact sheet go to `skills/blueprint-reader/work/trailer/render/`. Encoding uses two CPU threads. Music is synthesized from notes in the script, with no external audio assets.

## Things to Try

1. Watch the trailer muted; the story and call to action should remain clear.
2. Open the live reader, paste the demo URL, and compare its overview and brief with the captured results.
3. Render `--preview-only` to inspect all eight beats before exporting a revised video.

## Validation

Inspect every beat in the generated contact sheet and check the exported media:

```sh
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of json docs/assets/blueprint-reader-trailer.mp4
ffmpeg -v error -i docs/assets/blueprint-reader-trailer.mp4 -f null -
```

The expected result is 42 seconds, 1920 × 1080 H.264 at 30 fps with stereo 48 kHz AAC, and a clean full decode. The README uses a clickable poster leading to the GitHub Pages player. GitHub's repository file viewer rejected this 3.8 MB MP4 as too large to preview; a repository `.mp4` link is not a reliable playback destination. The Pages workflow copies `index.html`, the MP4 and poster into `dist/trailer/` after building the reader. The player uses native video controls with no JavaScript, autoplay, analytics or external media.
