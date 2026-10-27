# Blueprint Reader trailer

[Watch the 42-second trailer](https://ibrews.github.io/ue5-mcp/trailer/) · [Poster](../assets/blueprint-reader-trailer-poster.jpg) · [Try the reader](https://ibrews.github.io/ue5-mcp/)

A 1920 × 1080, 30 fps trailer for Alex Coulombe Presents. The story is carried by moving objects: a real graph becomes too much source for a chat, the reader produces a compact brief while retaining the original, and a magnifier reveals the specific nodes behind a follow-up. Captions clarify the action. The original instrumental score is optional; there is no voiceover.

## Transcript

| Time | Visual action | Clarifying caption |
|---|---|---|
| 0–8s | A real Blueprint fills the frame, draws back, then exports a stream of source pages. Pages pile into a chat shape until its illustrative capacity meter fills and a warning appears. | “I accidentally broke Claude.” “Too much raw Blueprint code.” “So I built a way to read it first.” |
| 8–15s | Actual captured characters enter the BlueprintUE URL field. A pointer clicks Read Blueprint; the real result appears. | “One link. Read the Blueprint.” |
| 15–19s | Source pages pass through a reader symbol and resolve into one small brief. The original graph and source remain beside a saved-folder symbol. | “Keep the source. Share the brief.” 81,358 source bytes → 1,336 brief bytes; summary omits detail. |
| 19–21.5s | The actual brief and Copy → Copied state fill the frame, then become the same brief pictogram. | “Copy the brief.” |
| 21.5–24s | A pointer carries the brief into the same chat shape from the opening. It fits, leaving most of the illustrative capacity meter empty. | “A useful starting point for Codex or Claude.” |
| 24–34s | A magnifier follows the real connected nodes. Above them, one generic panel is created, placed in a storage tray and displayed inside a monitor. | “Create → Store → Display.” “Follow the connection. Understand the intent.” |
| 34–38s | A small excerpt of the real graph moves from retained source into the chat alongside the brief. | “Go deeper with just the nodes you need.” |
| 38–42s | The graph → reader → brief transformation remains visible beside the retained-source folder. | “Blueprint Reader.” `ibrews.github.io/ue5-mcp/` · Free · MIT · In your browser. Alex Coulombe Presents. |

## Motion design

- **Object identity:** the same source sheets, brief and chat shapes recur. Their movement and relative scale explain the change before captions name it.
- **Cause and effect:** source accumulates, the capacity meter fills, and the chat warns. Later one brief fits in that same space. This is a qualitative metaphor, not measured model capacity or a token/cost claim.
- **Preserved context:** the full graph and saved-folder symbol remain visible when the brief leaves. The edit does not suggest lossless compression or destruction of the source.
- **Inspection and meaning:** a magnifier enlarges real node pixels; the panel/tray/monitor sequence illustrates the verified static wiring. There are no simulated execution pulses on the Blueprint wires.
- **Reduced dependence on reading:** use the caption-free review render below, muted, to assess whether the transformations remain legible. It suppresses editorial captions, labels and the CTA; text already in authentic UI captures remains. This is a design check, not a human comprehension study.

## Capture provenance and claims

- Captured on 2026-10-27 in the Codex in-app browser from the [live reader](https://ibrews.github.io/ue5-mcp/) and [BlueprintUE's graph view](https://blueprintue.com/render/6v52d8no/). Reader runtime: 0.3.1. The media revision does not change parsing behavior.
- Demo: [Extended dialogue system, posted by Nicola](https://blueprintue.com/blueprint/6v52d8no/), a publicly accessible export. The graph visuals and limited export/analysis excerpts are attributed to Nicola; the underlying Blueprint remains its author's work. The full raw export is not redistributed here.
- `captures-v2/graph-*.png` are actual BlueprintUE node views, not generated diagrams or reconstructions. `input/` records each typed character; `import/` records the fetch/result states; the brief captures include the actual Copied state. Editorial camera moves, pointer overlays, page trajectories, an inspection lens and pictograms guide attention. Timing is edited: this is not a continuous screen recording or an import-speed benchmark.
- Actual captures retain their node titles, wires, result text and controls. The separate chat shape, capacity meter, page pictograms, reader symbol, folder and generic widget/monitor are explanatory illustrations, not app screens or generated AI answers. They are labeled as illustrations in the captioned cut. The reader provides text analysis; BlueprintUE provides the node rendering. The reader does not execute the graph or display a visual graph editor.
- The specific connection is verified with the reader: `K2Node_CreateWidget_1.ReturnValue` → `K2Node_VariableSet_5.Hired`, then the stored object is the target for `K2Node_CallFunction_6` (`AddToViewport`). The Create Widget class is `/Game/Misc/UI_HIRED.UI_HIRED_C`. Execution and data pins remain distinct.
- The graph has 30 nodes, 107 pins and 38 wires. Its 81,358 decoded UTF-8 source bytes produce a 1,336-byte brief. The warning identifies an unavailable engine ForEachLoop body. The brief omits detail; byte counts do not establish token or cost savings.
- The Claude story refers to Alex's earlier experience. This graph is a public example, not a claim that this specific export broke Claude. The source-page graphics use a 2,400-character excerpt of the demo graph; they repeat for the overload metaphor and do not reproduce the full export. The chat is not a captured Claude conversation or a recreation of a specific error screen.
- The reader makes no AI calls. An assistant uses the brief separately. URL imports go through the fetch helper; graph parsing stays local. Pasted text/files are never uploaded.
- No private project data, Claude conversation, third-party music, voice clone or stock video appears. Layout, animation, soundtrack and render scripts were created for this project under its MIT license. System fonts are referenced locally and not redistributed.

## Rebuild

Requirements: Python 3.11+, Node.js 20+, FFmpeg with libx264/AAC, and Georgia, Arial and Courier New fonts. The default font directory is macOS's `/System/Library/Fonts/Supplemental`; pass `--font-dir` for a compatible directory with those filenames.

From the repository root:

```sh
python3 -m venv skills/blueprint-reader/work/trailer/venv
skills/blueprint-reader/work/trailer/venv/bin/pip install -r docs/trailer/requirements.txt
skills/blueprint-reader/work/trailer/venv/bin/python docs/trailer/render_visual.py --preview-only
skills/blueprint-reader/work/trailer/venv/bin/python docs/trailer/render_visual.py
```

The current edit uses `render_visual.py`, reusing capture/typography helpers from `render_motion.py` and the score from `render.py`. Those files preserve the earlier cuts' renderers. No network requests or AI API calls are made during rendering. Assets go to `docs/assets/`; intermediate video/audio and the contact sheet go to ignored `skills/blueprint-reader/work/trailer/visual/`. Encoding uses two CPU threads.

## Things to Try

1. Watch muted and ignore the captions: follow source → overload → brief → focused evidence.
2. Import the demo URL in the live reader and compare its overview and brief.
3. Use the skill to inspect `K2Node_CreateWidget_1`, `K2Node_VariableSet_5` and `K2Node_CallFunction_6`; match their pins to the highlighted Blueprint nodes.
4. Render `--preview-only` before exporting a revised video.
5. Render a caption-free review into ignored work storage, then watch it muted:

```sh
skills/blueprint-reader/work/trailer/venv/bin/python docs/trailer/render_visual.py \
  --no-captions --review-fps 10 \
  --work skills/blueprint-reader/work/trailer/visual-silent-check
```

This makes `visual-review.mp4` and a contact sheet without replacing the public trailer. Omit `--review-fps` for a full 30 fps review.

## Validation and playback

Inspect the contact sheet and **motion**, not only isolated frames. Check the export:

```sh
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of json docs/assets/blueprint-reader-trailer.mp4
ffmpeg -v error -i docs/assets/blueprint-reader-trailer.mp4 -f null -
```

Expect 42 seconds, 1920 × 1080 H.264 at 30 fps, stereo 48 kHz AAC and a clean full decode. The README poster links to the Pages player. GitHub's repository file viewer refused even the first 3.8 MB MP4; a repository `.mp4` link is not a reliable playback destination. CI copies `index.html`, the MP4 and poster into `dist/trailer/`. The player uses native controls with no JavaScript, autoplay, analytics or external media.
