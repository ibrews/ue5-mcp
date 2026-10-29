# Guided example: follow the wires

The browser build includes `/guide/`, a small interactive investigation of the
existing public example, [Extended dialogue system by Nicola](https://blueprintue.com/blueprint/6v52d8no/).
It follows Create Widget → Set Hired → AddToViewport, explains the distinction
between execution connections and object references, and produces a focused
prompt containing the actual compact brief and four exact connections.

The guide uses an evidence snapshot verified on 2026-10-29 and the authentic
BlueprintUE captures already used by the trailer. It makes no network or AI
calls. It neither executes nor changes the Blueprint. The readable view is a
reconstruction, not an Unreal editor or runtime capture. Display titles are
friendly labels; the expandable evidence retains node IDs, pin names, PinIds
and source line numbers. Only three of the graph's thirty nodes are included.

## Provenance and scope

- Source: the public URL above, graph `HandleScriptFunction`.
- Decoded UTF-8 source: 81,358 bytes; SHA-256
  `2fd51cbac3d40d7879c78522c824a05f87aaa3ee716ee874d5318c92c3d947fa`.
- Parsed with the repository's pinned Blueprint Reader / UEBlueprint parser.
- `web/guide/evidence.json` is a bounded derived excerpt: graph statistics,
  compact brief, three selected nodes' visible pin facts and the four
  connections between them. It excludes raw export blocks, unrelated node
  bodies and the rest of the graph. The Blueprint remains its author's work;
  do not check the full export into this repository.
- `docs/trailer/captures-v2/graph-wide.png` and `graph-ui-chain.png` are existing
  2026-10-27 captures. The guide's gold highlight is editorial, not telemetry.
- `UI_HIRED_C` is the class default. `ReturnValue` connects to `Hired`, and
  `Output_Get` connects to `AddToViewport.self` (Target in the visual graph).
  Execution wires are separate. The guide does not establish caller behavior,
  widget internals, actual visibility, or whether repeated calls are a bug.

The source URL opens pre-filled in the regular reader via `?example=dialogue`.
It is not imported automatically. Clicking Read Blueprint uses the established
fetch helper; importing can fail if the source changes or becomes unavailable.
Other query values are ignored. Private files and existing parser behavior
are unaffected. The guide does not persist clipboard/source data.

## Verify or refresh the evidence

Keep the full saved session outside this repository. From `skills/blueprint-reader`:

```sh
node scripts/read-blueprint.mjs https://blueprintue.com/blueprint/6v52d8no/ \
  --save-session /absolute/task-scratch/public-example.bp-session.json --brief
node web/guide/refresh.mjs /absolute/task-scratch/public-example.bp-session.json
npm test
npm run build:web
```

`refresh.mjs` checks the source URL and pins the original source digest before
extracting a snapshot. A changed source fails closed: inspect it, review every
claim/capture, then intentionally update the pin. Builds and ordinary tests
are offline and use the checked-in snapshot. The optional live test compares
the snapshot against the freshly parsed public source.

## Interaction and accessibility checks

1. Visit `/guide/` at desktop and narrow phone widths. No horizontal page scroll.
2. Choose each step and each node. Node emphasis, exact connection evidence and
   explanatory copy must agree. The original capture toggle remains usable.
3. Use Tab, Enter/Space, and Left/Right/Home/End on the step controls. The selected
   step is exposed through `aria-current` and changes are announced in a live region.
4. Copy the prompt, inspect its text, and save it. If clipboard access is denied,
   the full prompt opens and is selected for manual copying.
5. Open the example in the reader. Verify the URL is pre-filled without a request;
   then import explicitly and check the 30-node result.
6. Check reduced-motion, 200% zoom, contrast, and browser console/CSP errors.

No human comprehension study, Unreal compile, runtime test or creative acceptance
is implied by these checks. The existing trailer is unchanged.
