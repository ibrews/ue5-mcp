# Blueprint Reader trailer

[Watch the 42-second trailer](https://ibrews.github.io/ue5-mcp/trailer/) · [Poster](../assets/blueprint-reader-trailer-poster.jpg) · [Try the reader](https://ibrews.github.io/ue5-mcp/)

A 1920 × 1080, 30 fps trailer for Alex Coulombe Presents. The camera moves through real Unreal Blueprint nodes rendered by BlueprintUE, follows an actual link import in the reader, then highlights the widget connections behind the brief. Captions carry the story; the original instrumental score is optional. There is no voiceover.

## Transcript

| Time | On-screen story and action |
|---|---|
| 0–4.5s | The camera moves through the real dialogue Blueprint. “I accidentally broke Claude.” “Too much raw Blueprint code.” |
| 4.5–8.5s | A scrolling excerpt of that graph's actual clipboard export passes over its nodes. “A whole graph. Plus its macros. So I built a way to read it first.” |
| 8.5–13.5s | Actual captured input frames show `https://blueprintue.com/blueprint/6v52d8no/` being entered. The camera follows the field to Read Blueprint. |
| 13.5–17.5s | The real import completes and the camera moves to its result: 30 nodes, 107 pins and one missing macro body. The URL helper fetches the export; parsing stays local. |
| 17.5–24s | The actual brief and Copy → Copied button state. “81,358 source bytes → 1,336 brief bytes.” “A summary. Keep the full source for follow-up.” |
| 24–34s | Back in the same Blueprint, the camera follows highlighted nodes: create the UI_HIRED widget → store that widget in Hired → add it to the viewport. The labels identify static wiring, not a runtime execution capture. |
| 34–38s | Pull back to the graph. “Bring the brief to Codex or Claude.” “Save the full session. Inspect the nodes that matter.” |
| 38–42s | The graph remains in motion behind “Blueprint Reader” and `ibrews.github.io/ue5-mcp/`. Free, MIT licensed, available in the browser. Alex Coulombe Presents. |

## Capture provenance and claims

- Captured on 2026-10-27 in the Codex in-app browser from the [live reader](https://ibrews.github.io/ue5-mcp/) and [BlueprintUE's graph view](https://blueprintue.com/render/6v52d8no/). Reader runtime: 0.3.1. The media revision does not change parsing behavior.
- Demo: [Extended dialogue system, posted by Nicola](https://blueprintue.com/blueprint/6v52d8no/), a publicly accessible export. The graph visuals and limited export/analysis excerpts are attributed to Nicola; the underlying Blueprint remains its author's work. The full raw export is not redistributed here.
- `captures-v2/graph-*.png` are actual BlueprintUE node views, not generated diagrams or reconstructions. `input/` records each typed character; `import/` records the fetch/result states; the brief captures include the actual Copied state. Editorial pans, zooms, pointer overlays and node outlines guide attention. Timing is edited: this is not a continuous screen recording or an import-speed benchmark.
- No node titles, wires, result text or app controls were fabricated. The graph-only highlights do not imply that the reader has a visual graph editor or that it executes a Blueprint. The reader provides text analysis; BlueprintUE provides the node rendering.
- The specific connection is verified with the reader: `K2Node_CreateWidget_1.ReturnValue` → `K2Node_VariableSet_5.Hired`, then the stored object is the target for `K2Node_CallFunction_6` (`AddToViewport`). The Create Widget class is `/Game/Misc/UI_HIRED.UI_HIRED_C`. Execution and data pins remain distinct.
- The graph has 30 nodes, 107 pins and 38 wires. Its 81,358 decoded UTF-8 source bytes produce a 1,336-byte brief. The warning identifies an unavailable engine ForEachLoop body. The brief omits detail; byte counts do not establish token or cost savings.
- The Claude story refers to Alex's earlier experience. This graph is a public example, not a claim that this specific export broke Claude. The 2,400-character code excerpt is taken from the demo graph; it repeats as a visual transition and is not the entire export.
- The reader makes no AI calls. An assistant uses the brief separately. URL imports go through the fetch helper; graph parsing stays local. Pasted text/files are never uploaded.
- No private project data, Claude conversation, third-party music, voice clone or stock video appears. Layout, animation, soundtrack and render scripts were created for this project under its MIT license. System fonts are referenced locally and not redistributed.

## Rebuild

Requirements: Python 3.11+, Node.js 20+, FFmpeg with libx264/AAC, and Georgia, Arial and Courier New fonts. The default font directory is macOS's `/System/Library/Fonts/Supplemental`; pass `--font-dir` for a compatible directory with those filenames.

From the repository root:

```sh
python3 -m venv skills/blueprint-reader/work/trailer/venv
skills/blueprint-reader/work/trailer/venv/bin/pip install -r docs/trailer/requirements.txt
skills/blueprint-reader/work/trailer/venv/bin/python docs/trailer/render_motion.py --preview-only
skills/blueprint-reader/work/trailer/venv/bin/python docs/trailer/render_motion.py
```

The current edit uses `render_motion.py`, which reuses typography and score helpers from `render.py`. The latter also preserves the earlier text-card cut's renderer. No network requests or AI API calls are made during rendering. Assets go to `docs/assets/`; intermediate video/audio and the contact sheet go to ignored `skills/blueprint-reader/work/trailer/motion/`. Encoding uses two CPU threads.

## Things to Try

1. Watch muted: the graph, actions and call to action should remain clear.
2. Import the demo URL in the live reader and compare its overview and brief.
3. Use the skill to inspect `K2Node_CreateWidget_1`, `K2Node_VariableSet_5` and `K2Node_CallFunction_6`; match their pins to the highlighted Blueprint nodes.
4. Render `--preview-only` before exporting a revised video.

## Validation and playback

Inspect the contact sheet and **motion**, not only isolated frames. Check the export:

```sh
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of json docs/assets/blueprint-reader-trailer.mp4
ffmpeg -v error -i docs/assets/blueprint-reader-trailer.mp4 -f null -
```

Expect 42 seconds, 1920 × 1080 H.264 at 30 fps, stereo 48 kHz AAC and a clean full decode. The README poster links to the Pages player. GitHub's repository file viewer refused even the first 3.8 MB MP4; a repository `.mp4` link is not a reliable playback destination. CI copies `index.html`, the MP4 and poster into `dist/trailer/`. The player uses native controls with no JavaScript, autoplay, analytics or external media.
