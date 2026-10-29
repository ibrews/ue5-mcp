# Format and provenance

The CLI uses UEBlueprint 3.0.0's ObjectEntity grammar without the browser renderer. Dependencies are pinned in package-lock.json. [UEBlueprint](https://github.com/barsdeveloper/ueblueprint) is MIT licensed; its 102 BlueprintGraph test exports are exercised directly from the npm dependency, without evaluating fixture JavaScript. HTML parsing uses htmlparser2 and entities; page scripts never run. Only HTTPS BlueprintUE blueprint/render URLs and same-host redirects are fetched.

The JSON schema version is 1. A bundle contains `sources`, `graphs` and document `warnings`. Sources record name/URL, decoded text byte count and SHA-256. Each graph has an ID, name, owner/path when available, nodes, entries, edges and warnings. Each edge has `from`/`to` node+pin endpoints, kind `exec` or `data`, and a reciprocal flag. Each node includes its original identity, class, semantic references, raw property strings, real pins, separate user-defined-pin declarations and source line range. Exact numeric pin defaults remain strings to avoid int64 precision loss. Raw node text is included only with `--include-raw` or raw output; newlines are normalized to LF.

Node identity is `(graph ID, node ID)`; pin identity adds PinId. Clipboard node IDs are UObject names; native node IDs are the exporter's GUIDs. Different nodes can legitimately share a PinId. Multiple inputs receive distinct source IDs. The reader never guesses that unrelated same-named assets are identical. Export paths establish graph scope; plain clipboard fragments need headings or separate files when names collide. BPGraph wrappers expose their NodesString. Whole nested asset/T3D level exports and every custom node grammar are not guaranteed.

## Native graph input (0.4)

`dump_blueprint_graph` payloads and complete MCP envelopes use a separate adapter,
reported as `ecabridge-json@1` in `parser` (mixed inputs list both parsers). The
normalized bundle remains schema 1. Native node `source.format` is
`ecabridge-json`; line ranges and clipboard-only properties are unavailable.
`raw` is original node JSON. Full source JSON, including exporter metadata,
remains in the saved session. It is not a lossless clipboard reconstruction.

Legacy native dumps substitute local direction/name pin identities and disclose
missing hidden pins and semantic evidence. The `reader_schema_version:1` input
contract requires real node/pin GUIDs; unknown versions, ambiguous identifiers,
and continuation stubs fail. `source_warnings` in analysis preserves exporter
confidence/notes and explains source limits; brief output is still byte bounded.
See [paired comparisons and live-editor limits](editor-integration.md).

Macro references resolve to supplied graph bodies by full path (including the Blueprint owner for relative paths). A unique heading-only macro body can resolve by name, explicitly labeled `unique_name`. This is not equivalent to proving ownership. Unprovided Blueprint defaults, assets, custom function bodies, network authority and runtime values remain unknown. Multiple graphs may be attached without their dependent libraries.

The compact expression view and keyboard entry labels reuse interface ideas from the fleet's Python `bpt3d.py` at commit `d87391c42a`; the implementation here keeps UEBlueprint parsing, graph scopes, exact pin identity and labeled execution adjacency. The stdlib tool remains a useful fallback where Node dependencies are unavailable.

The live test fetches [Extended dialogue system](https://blueprintue.com/blueprint/6v52d8no/) and checks its HandleScriptFunction graph: 30 nodes, 107 pins, 18 execution and 20 data wires. This fixture can change or disappear; a live-test failure requires inspecting the page. User-uploaded graph content is not redistributed in this repository. The optional private acceptance test expects the three-graph camera sample supplied during development; it is skipped unless `BLUEPRINT_ACCEPTANCE_FILE` is set.

Independent Windows validation on Node 24.20 exercised four private exports and the data-volume installer junction without failures: the two main-graph exports each contained 601 nodes, 2,380 pins and 725 connections; the macro exports contained 38 nodes/155 pins and 60 nodes/263 pins. Separately parsed main graphs report 30 external macros, because their supplied macro bodies are absent from that invocation. The combined three-graph sample resolves 13 calls, leaving 18 external macro warnings across all graphs. External-macro warnings do not imply damaged topology.


## Compact intake (0.2)

The default CLI output is now a byte-bounded brief, not the legacy detailed summary (`--format summary`). `--format analysis` is a separate schema-version-1 document with `stats`, `description`, per-graph overviews/entries, findings (`rule`, `level`, `graph`, `nodes`, `detail`, `suggestion`, `validation`), missing macro dependencies, and limits. It contains static evidence rather than generated code or an AI model response. Large lists and values can be abbreviated in human-readable views; normalized JSON and original source remain available for exact inspection.

A saved session has `kind: "blueprint-reader-session"`, `schema_version: 1`, and a `sources` array of original text plus allowlisted source metadata. Sessions are validated and reparsed in workers when loaded; URLs are provenance only and are not refetched. Both session and output writes refuse to overwrite existing files. Session files contain private graph data when the input does; keep them local unless sharing is intended. The 32 MiB cap applies to combined decoded text, with at most 100 sources.

`npm start` serves the bundled page on an OS-selected port at 127.0.0.1. It keeps one successful ingestion in memory, invalidates old download/inspection IDs after replacement, and clears memory on restart. A failed parse preserves the previous session. Same-origin JSON requests and an exact loopback Host are required; external network requests are restricted to the existing BlueprintUE URL allowlist. There are no remote fonts, analytics, uploads, API keys or LLM calls. Brief/analysis/session downloads are explicit. The page is a local tool, not a multi-user hosted service.

The intake regression suite covers byte limits and omission notices, positive and negative advice examples, session round-trips, CLI drill-down, and HTTP origin/host/session behavior. The private acceptance sample additionally verifies the known CamSet duplicate branch destination and Tick-driven constant rotation increment. These are static suggestions; no Blueprint assets are changed.
