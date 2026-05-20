---
name: ue5-mcp
description: >
  Unreal Engine 5 development via the ECABridge MCP plugin (~520+ tools), in-process Slate input injection,
  pixel streaming, and Python editor scripting. Use this skill whenever the user's session has Unreal
  Engine MCP tools available (tools with names like create_blueprint, create_actor, add_material_node,
  create_niagara_system, dump_blueprint_graph, summarize_blueprint, take_blueprint_editor_screenshot,
  click_slate_widget, name_blueprint_node, build_plugin, etc.) or when the user mentions Unreal Engine,
  UE5, Blueprints, Niagara, MetaSound, or any UE game development workflow. Auto-trigger when
  unreal-editor MCP tools are detected. This skill contains hard-won knowledge from real debugging
  sessions — crash patterns, broken APIs, working workarounds, transactional undo semantics, the
  warnings + _meta response conventions, and the exact tool call patterns that actually succeed.
  Ignoring this skill when UE5 MCP tools are present will lead to hours of wasted time hitting known
  dead ends.
---

# UE5 MCP Development Skill

Battle-tested patterns for working with Unreal Engine 5 through ECABridge MCP tools (~520+ tools on localhost:3000, varies by engine plugins), in-process Slate input injection, pixel streaming, and Python editor scripting. Every piece of advice here comes from actual failures, crashes, and debugging sessions — not documentation.

Canonical example payloads for ~20 commands live in the plugin repo at `scripts/smoke-test.py` — when in doubt about the shape of a call, look there first.

**ECABridge plugin:** https://github.com/ibrews/ECABridge  
**This skill:** https://github.com/ibrews/ue5-mcp

---

## Session Startup Checklist

Run these steps at the start of every UE5 MCP session before doing any work.

1. **Understand the project state first.** Run `dump_level()` to see all actors currently in the scene. Run `find_assets(path_filter="/Game/")` to see what assets exist. Never assume — read first, then act.
2. **Before editing any Blueprint**, call `dump_blueprint_graph(blueprint_path="...")` to get the complete graph. Never guess the existing node structure. After edits, call `compile_blueprint` to surface errors and warnings.
3. **Before editing any material**, call `dump_material_graph(material_path="...")` to read the current node graph.
4. **Before setting Niagara module inputs**, call `list_module_inputs(...)` for the module — the function-call pin names from `get_niagara_modules` are NOT the same as the user-facing input names.
5. **Verify pixel streaming if needed** — `tabs_context_mcp` to get the current tab ID. Activate before starting, not mid-task.
6. **Save after every meaningful change.** `save_asset(asset_path)` for one asset, `save_dirty_assets()` for everything dirty in memory, `save_level()` for the current level, or `run_console_command("SaveAll")` for a full editor save.
7. **Trust `tools/list`, not this manual.** ECABridge runs from a single `main` branch on both UE 5.7 and UE 5.8, and individual commands are gated on optional engine plugins (Mutable, MovieRenderPipeline, MetaHumanCharacter, Niagara, MetaSound, ControlRig, GameplayAbilities, ICVFX, RenderDoc, DataValidation, etc.). Depending on which plugins the host project enables and which UE version it targets, **~5–30 commands may be absent or present** versus what this skill describes. Approximate surfaces post-2026-05-20 fanout: UE 5.7 ≈ 510 commands; UE 5.8 ≈ 525+ commands. If a tool name in this manual isn't in your `tools/list`, the project's plugin set excluded it — don't try to call it, and don't assume the manual is wrong about everything else.
8. **Read result `_meta` blocks.** Every `dump_*`/`find_*`/`list_*` result now carries a `_meta` object with `method`, `coverage`, `confidence` (HIGH/MEDIUM/LOW), and optional `notes`. MEDIUM/LOW means items were skipped — don't act on the result as if it's complete. See "Reading warnings and `_meta`" below.
9. **Read `_meta.warnings`.** When you misspell a param key, the registry now flags it (`"Unknown param 'function_name' — did you mean 'FunctionName'?"`) instead of silently ignoring. Surfaces in `_meta.warnings` on the MCP response. Fix the call and retry.

---

## Rosetta Stone: Read Before You Write

ECABridge includes deep introspection commands that serialize any UE5 asset into structured JSON. **Use these before modifying anything.** Trying to edit a Blueprint, material, or Niagara system without reading its current structure first leads to broken connections and wasted calls.

| Command | Use it for |
|---|---|
| `dump_blueprint_graph(blueprint_path)` | Complete graph — all nodes, pins, connections, variables, components |
| `dump_material_graph(material_path)` | All expression nodes, connections, material properties, compilation errors |
| `dump_niagara_system(system_path)` | Emitter stacks, renderers, module inputs, parameter bindings |
| `list_module_inputs(system_path, emitter_name, module_name, script_usage)` | User-facing module inputs (the ones the Niagara stack panel shows) — required reading before set_niagara_module_input |
| `dump_widget_tree(widget_path)` | Full widget hierarchy — parent-child structure, slot properties, visibility |
| `dump_level(max_actors=100)` | All actors with transforms, components, tags (lightweight or deep mode) |
| `dump_asset(asset_path)` | Full JSON of any asset — all UPROPERTYs, sub-objects, references, metadata |
| `get_component_property(blueprint_path, component_name, property_name)` | Read complement to set_component_property — verify a property landed |
| `get_blueprint_components(blueprint_path, include_overrides=true)` | List components with per-component property overrides (template values that differ from class defaults). Use to debug "this component isn't behaving like a fresh one." |
| `find_assets(class_filter, path_filter)` | Search asset registry by class, path, or name wildcard |
| `get_asset_references(asset_path, direction)` | Dependency graph — what references what (use before deleting anything) |
| `dump_metasound_graph(metasound_path)` | All MetaSound nodes, pins, connections, source inputs/outputs |
| `dump_animation_blueprint(abp_path)` | State machines, transitions, AnimGraph nodes |
| `dump_level_sequence(sequence_path)` | All bindings, tracks, sections, keyframe channel data |
| `dump_datatable(datatable_path)` | Schema with types + all row data |
| `compile_blueprint(blueprint_path)` | Compile + return errors[], warnings[], status enum (UpToDate, UpToDateWithWarnings, Error, Dirty) |

**Pattern:** read → plan → edit → verify. Never skip the read step.

```bash
# Before touching BP_Rocket:
dump_blueprint_graph("/Game/Blueprints/BP_Rocket")

# Before deleting T_Hero texture:
get_asset_references("/Game/Textures/T_Hero", direction="referencers")  # who uses it?

# To understand the current scene:
dump_level(max_actors=50)

# To find all Niagara systems you could duplicate:
find_assets(class_filter="NiagaraSystem", path_filter="/Game/")
```

---

## Programmatic Toolset — Python Sandbox

**Read this before you fire off five sequential tool calls.** ECABridge ships a server-side Python execution surface. Agents that don't know it exists make N sequential MCP round-trips and burn context; agents that do collapse the same work into one call and only see the aggregated result.

| Command | Purpose |
|---|---|
| `execute_script(script)` | Run a Python script inside the editor process. Has full access to UE's `unreal` module and every registered ECA command. |
| `get_execution_environment()` | Introspect the sandbox — Python version, what's importable, what subsystems are reachable, current world/level context. Cheap; call it once at session start if you plan to use `execute_script`. |

### The `def run() -> dict` convention

Your script should define a top-level `run()` function. Its return value becomes the structured `command_result` in the MCP response; anything you `print()` goes into `log_output`.

```python
def run() -> dict:
    import unreal
    actors = unreal.EditorLevelLibrary.get_all_level_actors()
    print(f"counted {len(actors)} actors")  # → log_output
    return {                                  # → command_result
        "count": len(actors),
        "classes": sorted({a.get_class().get_name() for a in actors}),
    }
```

- Return value must be JSON-serializable (dict / list / str / int / float / bool / None).
- Uncaught exceptions return as an MCP error response with the full Python traceback.

### Chain ECA commands from inside the sandbox

You can call any registered ECABridge command via the `ECA` shim — same names, same args, but no MCP round-trip per call. This is the headline use case: collapse N sequential agent turns into one.

```python
def run() -> dict:
    # Find every enemy blueprint, dump its graph, return all in one response
    found = ECA.find_assets(class_filter="Blueprint", path_filter="/Game/Enemies/")
    graphs = {}
    for entry in found.get("assets", []):
        path = entry["path"]
        graphs[path] = ECA.dump_blueprint_graph(blueprint_path=path)
    return {"count": len(graphs), "graphs": graphs}
```

Without `execute_script` that's 1 + N agent turns (one `find_assets`, then one `dump_blueprint_graph` per result, with the LLM round-tripping between each). With `execute_script` it's one turn.

### Honest caveats

- **Not a security sandbox.** `execute_script` has full UE Python access — file I/O, subprocess, anywhere `unreal` + `os` will go. Treat it like `exec()` in any other dev environment. Only run it from trusted agents you'd let drive a developer's machine.
- **Editor thread.** Like every ECA command, your script runs on the main thread. Long tight loops hitch the editor. For huge sweeps, batch into multiple `execute_script` calls.
- **No streaming.** The result returns at script end; you don't get partial output as it runs. For multi-minute work, write progress to a Note actor (or disk) and poll it from a follow-up call.

When unsure what's importable or how to reach a subsystem, call `get_execution_environment()` first — it's cheaper than a failed script.

---

## Tool Strategy: When to Use What

### Quick Decision Table

| What you need to do | Use |
|---|---|
| Read any asset structure (Blueprint, material, Niagara, widget) | `dump_*` Rosetta Stone commands first |
| Understand a Blueprint before editing it (compact, summary-shaped) | `summarize_blueprint` — way cheaper than `dump_blueprint_graph` for context |
| Find who calls a function / reads a variable / fires an event | `find_blueprint_callers` |
| Diff two Blueprints (topology delta) | `diff_blueprints` |
| Find assets with zero referencers (cleanup candidates) | `find_unused_assets` |
| Create/modify Blueprint graphs, components, variables | MCP |
| Take slide-ready BP screenshot (single call, framed, hide overlays) | `take_blueprint_editor_screenshot` |
| Reference a node again later without passing 36-char GUIDs | `name_blueprint_node` then use `node_name` in subsequent calls |
| Create/edit materials, Niagara systems, MetaSounds | MCP |
| Spawn, move, delete level actors | MCP |
| UMG widgets, DataTables | MCP |
| Keyboard/mouse input during PIE | Pixel streaming (still — Slate input doesn't reach the PIE world) |
| Click editor UI elements (menus, dialogs, dropdowns) | **Slate Input MCP** (`find_slate_widgets` → `click_slate_widget`) — supersedes pixel streaming for the same-machine case |
| Type into a focused widget / send keyboard chords | **Slate Input MCP** (`type_slate_text`, `slate_key_chord`) |
| Capture an open BP editor's graph or any Slate widget | `take_blueprint_editor_screenshot` / `take_slate_widget_screenshot` |
| Visual verification of live gameplay/particles | Pixel streaming or `take_gameplay_screenshot target="pie"` |
| Compile the plugin / run automation tests / compile all BPs | **Headless Build & Test MCP** (`build_plugin`, `run_automation_tests`, `compile_project_blueprints`) |
| Undo an MCP edit | **Ctrl+Z in the editor** — every mutating MCP call is now wrapped in `FScopedTransaction` |
| Niagara module inputs (SpawnRate, velocity, etc.) | MCP — `list_module_inputs` then `set_niagara_module_input` |
| Object reference properties on components | MCP — `set_component_property` (handles object/soft-object/class/soft-class refs) |
| Bulk asset operations, Sequencer control | Python (still — no bulk MCP equivalent yet) |
| Reading Python output back into MCP | Actor Tags data channel |

### ECABridge MCP Tools (Primary)

400+ tools (varies by engine plugins) on `localhost:3000`. Categories include: Actor, Blueprint, Blueprint Node, Material, Material Node, Mesh, Niagara, MetaSound, MVVM, Widget/UMG, Sequencer, Animation, Lighting, Environment/PCG, AI/Navigation, DataTable, Editor, Asset, MetaHuman, Programmatic (Python sandbox), Source Control, Observability (Insights / Stats / Memory / Frame Capture / Diagnostic Bundle), Editor UX (CVars, viewport bookmarks, workspace layouts, content browser filters).

### Source Control

Wraps `ISourceControlModule` — works against Perforce, Git, or whichever provider the project has connected. Gracefully no-ops if no SCC is configured.

- `check_out_asset`, `revert_asset`, `mark_for_add`, `mark_for_delete` — file-level mutations
- `create_changelist`, `submit_changelist`, `list_changelists`, `move_to_changelist` — Perforce changelist CRUD
- `reconcile_offline_changes` — detect files modified outside the editor and update SCC state
- `diff_asset_against_depot` — text diff against depot HEAD (binary assets return a "use UE diff tool" pointer)
- `validate_before_submit` — run asset validators across a changelist; refuses to submit if they fail
- `get_source_control_status` — read-only state for a given asset

### Observability

Performance and post-mortem work. Useful when an agent is asked "why is this frame slow?" rather than "build me a thing."

- `start_insights_trace` / `stop_insights_trace` / `dump_insights_summary` — Unreal Insights with a small response-shaped summary (top-N hot functions, frame time, CPU vs GPU split)
- `enable_stat_group` / `disable_stat_group` / `dump_stat_values` — wraps `stat unit`, `stat gpu`, `stat memory`, `stat scenerendering`, etc.
- `capture_frame` — RenderDoc / Insights / GPU dump triggers; returns artifact path
- `snapshot_memory` / `diff_memory_snapshots` — labeled allocator snapshots and diff (top allocators, biggest objects, biggest growth)
- `capture_diagnostic_bundle` — one-call "tell me what's wrong": zip of screenshot, log tail, all CVars, scene stats, top-10 actors-by-cost, recent Insights trace. Ideal for support tickets.

Well-supported operations:
- Creating/modifying Blueprints (components, variables, node graphs via Blueprint Lisp or batch_edit)
- Spawning/deleting/transforming level actors
- Creating and editing materials, meshes, textures
- Reading Blueprint info, actor properties, asset metadata (via dump_* commands)
- UMG widgets and MVVM bindings
- MetaSound creation and editing
- DataTable read/write
- Starting/stopping PIE, console commands, viewport screenshots

**Where MCP falls short** (use Python or pixel streaming instead):

- Cannot send keyboard/mouse input during PIE
- Cannot interact with editor UI elements (dropdowns, dialog buttons, context menus)
- `set_niagara_dynamic_input` still broken (use Python or bake the value)

**Recently fixed** (don't reach for Python first for these):
- Object reference properties (Sound, StaticMesh, Material, WidgetClass, NiagaraSystem) now work via `set_component_property` — pass the asset path as `property_value`. Asset-path form auto-expands to the generated class for `TSubclassOf<>` properties.
- Generic UMG widget creation: `add_widget_element(widget_type="ProgressBar"|"VerticalBox"|...)` — see UMG section.
- Niagara: `create_niagara_system` returns working systems (is_active=true); `set_niagara_module_input` works for float/int/bool/vector2/vector3/position/color via the override-pin path. Use `list_module_inputs` first to discover input names.
- `add_blueprint_component` resolves common plugin types: `Niagara`, `Widget`, `PostProcess`, `Decal`, `Paper`, etc.
- `save_asset(asset_path)` and `save_dirty_assets()` for non-level persistence.
- `compile_blueprint` returns errors[], warnings[], status enum (UpToDate, UpToDateWithWarnings, Error, Dirty).
- `get_component_property` reads any property — use to verify a write took effect.

### Slate Input — Computer Use Inside The Editor

The Slate Input commands (added 2026-05-20) give you a "computer use" loop **inside the editor process**, with microsecond latency instead of pixel streaming's tens of ms over WebRTC. Same-machine input control should go through these now; pixel streaming is reserved for genuinely remote / cross-machine viewing.

| Command | Use it for |
|---|---|
| `find_slate_widgets(text_contains?, widget_type?, window_title?, max_results)` | Discovery — returns a flat list of widgets with `widget_id`, `type`, `accessible_text`, `geometry`. Call this immediately before clicking; widget IDs are session-scoped and can stale on tree rebuild (tab switch, modal open, redraw). |
| `click_slate_widget(widget_id\|accessible_text\|window_pixel, button?, modifiers?, double_click?)` | Synthesize mouse-down + mouse-up on a widget. Three ways to target it. |
| `type_slate_text(text, into_focused?, accessible_text?\|widget_id?)` | Synthesize keyboard text into a focused widget. `\n` → Enter, `\t` → Tab. |
| `slate_key_chord(key, modifiers?)` | Press a chord like Ctrl+S, Cmd+Tab. Accepts UE canonical names (S, F5, Tab) and aliases (Return/Enter, Esc/Escape, BackSpace). |
| `take_slate_widget_screenshot(widget_id\|accessible_text, file_path?, padding?)` | Capture the rectangle of a specific widget. Pairs with `find_slate_widgets`. |

**The discovery → action loop:**
```jsonc
// 1. Discover what's clickable in the current top window
find_slate_widgets({ text_contains: "Compile" })
// → { widgets: [{ widget_id: 42, type: "SButton", accessible_text: "Compile", ... }], ... }

// 2. Click it
click_slate_widget({ widget_id: 42 })
```

**Limits:**
- `widget_id` is valid within the same MCP session and only until the Slate tree rebuilds. Always re-discover right before acting.
- `find_slate_widgets` walks the **top-level window's** tree by default. Pass `window_title` to target a different open window.
- Pure-keyboard chords don't need a target widget — they go to whatever has focus.

### Pixel Streaming (localhost:80)

Use for things Slate Input genuinely can't do. Always call `tabs_context_mcp` first — tab IDs change between sessions. You'll need to click "CLICK TO START" or "DISCONNECTED. CLICK TO RESTART" to activate.

- Game key input during PIE (1, 2, WASD, etc.) — Slate Input synthesizes into Slate widgets, not the PIE game world
- Remote / cross-machine viewing of a running editor
- Real-time visual verification when polling screenshots isn't enough

**When NOT to use pixel streaming:** clicking editor UI on the same machine. Use Slate Input instead — orders of magnitude faster, no render-thread dependency, no signaling server, no input focus stealing.

**Important:** Pixel streaming captures input focus, blocking the user's editor access. Game viewport needs a click to capture focus before key input works. Audio can't be heard through pixel streaming.

### Python Editor Scripting (via `unreal` module)

Run via `run_console_command("py your_code_here")`.

Best for: Niagara parameter manipulation, batch asset operations, Sequencer control, setting object reference properties.

**Critical problem:** Python stdout goes to the UE log — not back to MCP.

**Workaround — Actor Tags data channel:**

```python
import unreal
result = "whatever you need to return"
note = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.Note, unreal.Vector(0, 0, 9999)
)
note.tags = [result[:200]]  # Name type, keep short
```

Read back via MCP: `get_actor_properties("Note")` → check `tags` array. Delete the Note actor after. Spawn a fresh Note actor for each read — stale actors return stale tags.

**Required plugins:** Python Editor Script Plugin, Python Foundation Packages.

---

## Reading warnings and `_meta` blocks

Two MCP response-layer additions (2026-05-20) you should read every time:

### `_meta.warnings` — the silent-typo catcher

When you call a command with an unknown parameter key, the registry now flags it instead of silently ignoring. Surfaces in the MCP response at `_meta.warnings`:

```json
{
  "content": [{ "type": "text", "text": "{...}" }],
  "_meta": {
    "warnings": [
      "Unknown param 'function_name' — did you mean 'FunctionName'?",
      "Param 'graph' ignored — did you mean 'graph_name'?"
    ]
  }
}
```

**When you see this:** the call still ran with the params that *were* recognized. Fix the typo and retry. Don't act on the result as if everything you sent applied.

Commands can also append their own warnings (deprecation notices, ambiguous-input nudges).

### `_meta` on `dump_*` / `find_*` / `list_*` / `search_*`

Every read-side command now carries a `_meta` block describing how complete the result is:

```json
{
  "graphs": [...],
  "_meta": {
    "method": "K2 schema walk + pin reflection",
    "coverage": "47/47 nodes parsed (100%)",
    "confidence": "HIGH",
    "ue_version": "5.7",
    "notes": []
  }
}
```

| Confidence | Meaning | What to do |
|---|---|---|
| `"HIGH"` | Everything parsed cleanly, no silent skips | Trust the result |
| `"MEDIUM"` | Some items were skipped — see `notes` | Read `notes` before acting; the result is partial |
| `"LOW"` | Fundamentals failed but a partial header is returned | Treat as failure; re-call or fall back |

`coverage` may be omitted when the denominator is unbounded. `notes` is omitted when empty. `ue_version` is `"5.7"` or `"5.8"` so you can branch on engine.

**The point:** stop acting on dumps as if they're complete. A 12-node graph with `coverage: "10/12 (83%)"` and `confidence: "MEDIUM"` means 2 nodes were skipped — your subsequent edits may break connections to them.

---

## Transactional MCP — Ctrl+Z reverts your edits

As of 2026-05-20, every mutating ECABridge command wraps in `FScopedTransaction`. **Each MCP call becomes one undo step** that the user (or you, via a Slate `slate_key_chord` Ctrl+Z) can revert in the editor.

- Failed commands `Cancel()` the transaction → no garbage in the undo stack
- Successful commands keep their transaction → one Ctrl+Z reverts
- Pure-read commands (`dump_*`, `find_*`, `get_*`, `list_*`, etc.) don't create transactions — they're free of undo-stack pollution
- The transaction name is `"ECABridge: <command_name>"` so the user can see what's about to be undone in the editor's Edit menu
- Niagara and MetaSound subsystems already had their own per-command `FScopedTransaction` — those nest inside the new registry-level wrap cleanly (UE handles nested transactions as merges)

**Implication for your workflow:**
- Speculative edits are now safe — if a `set_blueprint_pin_value` ends up wrong, the user (or you via Slate) hits Ctrl+Z and it's gone
- Multi-step recipes are still N separate undo steps — wrap them in a Python `execute_script` if you want them as a single atomic action
- The old "BP corruption requires editor restart" failure mode is mostly gone — a bad MCP call now rolls back cleanly

---

## Friendly node names — no more 36-char GUIDs

The `FECANodeNameRegistry` (2026-05-20) is a session-scoped friendly-name → GUID map for Blueprint nodes. Lets you reference nodes by name in subsequent calls instead of passing the raw `A950175C0A412A29B1F97A9B9859215E` GUID around.

**Three patterns:**

```jsonc
// 1. Auto-register at creation: pass an optional `name` to any add_* command
add_blueprint_function_node({
  blueprint_path: "/Game/BP_Foo",
  function_name: "ApplyDamage",
  target_class: "Character",
  name: "DamagePlayer"      // ← registered automatically
})

// 2. Use the name in subsequent mutating calls
set_blueprint_pin_value({
  blueprint_path: "/Game/BP_Foo",
  graph_name: "EventGraph",
  node_name: "DamagePlayer",   // ← instead of node_id
  pin_name: "Damage",
  pin_value: "50"
})

// 3. Or name an existing node by GUID
name_blueprint_node({
  blueprint_path: "/Game/BP_Foo",
  graph_name: "EventGraph",
  node_id: "A950175C0A412A29B1F97A9B9859215E",
  name: "FirstSpawn"
})
```

**Meta-tools for the registry:**

| Command | Use |
|---|---|
| `name_blueprint_node` | Register a name for an existing node |
| `unname_blueprint_node` | Drop a binding |
| `list_node_names` | Show all current bindings (session-scoped) |
| `resolve_node_name` | Look up a name without mutating |

**Where `node_name` works as an alias for `node_id`:**

`connect_blueprint_nodes` (both source + target), `delete_blueprint_node`, `disconnect_blueprint_node`, `set_blueprint_pin_value`, `break_pin_connection`, `batch_edit_blueprint_nodes` (per-entry).

**Caveats:** case-sensitive lookup. Names live for the editor session — registry clears on restart. Doesn't replace `node_id` — it's an alias, both still work.

---

## Blueprint Analysis — read-side companions to `dump_blueprint_graph`

`dump_blueprint_graph` is exhaustive (good for editing) but heavy on context. These four read-side commands (2026-05-20) are **summary-shaped** for fitting in an agent's context window.

| Command | Use it for |
|---|---|
| `summarize_blueprint(blueprint_path, include_functions?, max_depth?)` | Pseudo-code walk through every event entry. Branch/Cast/Switch annotations. ~80% of common node types covered. Use this to *understand* a BP before editing. |
| `find_blueprint_callers(function_name\|variable_name\|event_name, target_class?, search_path?)` | Reverse lookup across AssetRegistry — every BP that contains a node referencing this. Returns `{caller_blueprint_path, graph_name, node_id, node_title, context}`. |
| `diff_blueprints(blueprint_a, blueprint_b, include_pin_values?)` | Topology delta — added/removed nodes, added/removed connections, optional pin-value changes. Doesn't try char-level diff. |
| `find_unused_assets(search_path?, asset_class?)` | Zero-referrer scan. Skips known roots (UWorld, _C class objects). Returns `{path, class, size_kb}`. |

**Decision rule:** if you need to *understand* a BP before editing it, `summarize_blueprint` first. If you need to *edit* it, `dump_blueprint_graph` first. If you need to *find* something across many BPs, `find_blueprint_callers`.

**Edge cases knowingly skipped** in `summarize_blueprint`: composite/tunnel sub-graphs (labeled, not recursed), macros (labeled `Macro<Name>`, body not inlined), `SwitchEnum` (shows raw pin name, not enum display name), async/latent multi-continuation pins (follows only default exec-out).

---

## Headless Build & Test — verify before you ship

Three commands (2026-05-20) that shell out to UBT / UnrealEditor-Cmd for headless build verification. Useful when an agent edits plugin code, tweaks build settings, or wants to confirm Blueprints still compile across the project.

| Command | Use it for |
|---|---|
| `build_plugin(plugin_path?, output_dir?, target_platforms?, compile_only?, timeout_seconds?)` | `RunUAT.bat BuildPlugin` — compile a plugin against the running editor's UE version. `compile_only=true` skips packaging for faster cycles. Returns warnings/errors counts + log_excerpt + log_path. |
| `run_automation_tests(test_filter?, project_path?, timeout_seconds?, report_path?)` | `UnrealEditor-Cmd -nullrhi -ExecCmds="Automation RunTests ..."`. Returns total/passed/failed/skipped + failed_tests array. Defaults filter to `"ECABridge"`. |
| `compile_project_blueprints(project_path?, timeout_seconds?, path_filter?)` | `UnrealEditor-Cmd -run=CompileAllBlueprints`. Surfaces BP-wide compilation errors. `path_filter` post-filters the errored list. |

**Where logs go:** `Project/Saved/ECABridge/BuildLogs/<timestamp>-<command>.log` — full output persisted even if the command times out. The result payload includes `log_path` so you can retrieve more than the 4KB tail if needed.

**Platform support:** Windows only at the moment. Mac returns a clear "platform not yet supported" error.

**Use case:** the "agent diagnoses then fixes a bug" loop now closes — make a fix, `compile_blueprint`, run `run_automation_tests` to confirm it didn't break anything else, done.

---

## Core UE5 Knowledge

### Lumen Lighting
Always set lights to **Movable** mobility. Static or Stationary lights won't contribute to Lumen's global illumination.

### Blueprint Instances vs Parent
Level-placed instances can retain stale editor overrides after the parent Blueprint is modified. Always check the level instance after changing the parent — you may need to revert overridden properties.

### Never Delete/Modify Referenced Meshes
Deleting or transforming mesh assets while actors reference them causes a `RegisteredElementType` assertion crash. **Before deleting any asset, run `get_asset_references(asset_path="...", direction="referencers")`** to confirm nothing depends on it.

**Safe pattern:** Create NEW mesh assets, verify they work, then swap references on actors.

If you hit this crash, restart the editor — no data is lost, but unsaved changes are gone.

### Rapid Actor Operations Crash
Spawning, deleting, and focusing the viewport on actors in quick succession triggers the same `RegisteredElementType` crash. Add pauses between spawn/delete/focus. Don't delete an actor immediately after focusing on it.

### Editor Sprites vs Actual Particles
Screenshots show editor sprites (component icons) that look like particles but aren't. Always verify Niagara effects by:
1. Check `is_active: true` via `get_actor_properties`
2. Run PIE and take a PIE screenshot — more reliable than editor screenshots for particles
3. Use pixel streaming for real-time visual confirmation

### Save Frequently
Niagara assertion and MetaSound crashes revert unsaved changes. Save options:

- `save_level()` — saves the current level and its dirty assets.
- `save_asset(asset_path="/Game/Path/AssetName")` — saves a single asset by content path. Returns `{saved, was_dirty}`.
- `save_dirty_assets(include_maps=false)` — saves every dirty content package (or also map packages with `include_maps=true`). Returns counts. This is the right tool after a batch of edits across multiple Blueprints/materials/widgets.
- `run_console_command("SaveAll")` — full editor save, slowest path.

After saving a Blueprint, run `dump_blueprint_graph` to confirm your nodes survived — silent save failures do happen.

---

## Niagara Particle System

### Creating a Niagara System

```bash
create_niagara_system(asset_path="/Game/Effects/MyEffect", template="default")
```

`template` resolves to `/Niagara/DefaultAssets/DefaultSystem` for keywords (`default`, `empty`, `sprite`, `fountain`) — the resulting system inherits a working sprite emitter and `is_active: true` when spawned. Pass a `/Game/...` path to duplicate any working system you already have.

The previous factory-based creation produced systems that compiled cleanly but never emitted particles (is_active stayed false even after force-activate). The fix duplicates `DefaultSystem` instead, bypassing the empty-system bug entirely.

### Setting Module Inputs

Two-step pattern — list first, then set:

```bash
# 1. Discover the actual user-facing inputs (these are NOT the same as get_niagara_modules' inner pins)
list_module_inputs(system_path="...", emitter_name="Fountain",
                   module_name="SpawnRate", script_usage="emitter_update")
# → [{name:"Module.SpawnRate", type:"NiagaraFloat", value_type:"float"}, ...]

# 2. Set using the discovered name (short or full handle both accepted)
set_niagara_module_input(system_path="...", emitter_name="Fountain",
                        module_name="SpawnRate", input_name="SpawnRate",
                        script_usage="emitter_update", value=250.0)
```

Supported `value_type` for `set_niagara_module_input`: float, int, bool, vector2, vector3, position, color. The error path on a wrong input_name lists what was available.

`script_usage` values: `particle_spawn`, `particle_update`, `emitter_spawn`, `emitter_update`, `system_spawn`, `system_update`. Same module name can appear in multiple stages (e.g., SpawnRate in emitter_update vs Initialize Particle in particle_spawn) — the script_usage disambiguates.

### Spawning and Verifying

```bash
spawn_niagara_effect(system_path="/Game/Effects/MyEffect",
                    location={x:0,y:0,z:200}, name="Test")
get_niagara_actors(system_filter="MyEffect")
# → confirms is_active: true
```

Editor screenshots don't capture live particles — use PIE screenshot or pixel streaming for visual verification.

### Still Broken

- `set_niagara_dynamic_input` — "Failed to load random range script." Use Python or bake the value.

### NiagaraComponent in Blueprints

`add_blueprint_component(component_type="Niagara", component_name="VFX")` works directly now — the component_type lookup falls back to `/Script/Niagara.NiagaraComponent`. Pair with `set_component_property(property_name="Asset", property_value="/Game/.../NS_Foo")` to assign the system.

For runtime spawning from a Blueprint graph, `SpawnSystemAtLocation` from NiagaraFunctionLibrary still applies.

---

## Materials — Creation and Editing

### Creating a Material

```bash
create_material(asset_path="/Game/Materials/M_Name", blend_mode="Opaque")
```

Blend modes: `"Opaque"`, `"Translucent"`, `"Additive"`, `"Masked"`.

**Before editing an existing material:** `dump_material_graph(material_path="...")` to read all nodes and connections first.

### Material Node Types (add_material_node)

| Node type | Use for |
|---|---|
| `Constant` | Single float |
| `Constant3Vector` | RGB color |
| `Multiply` / `Add` | Math ops |
| `TextureSample` | Texture input |
| `ScalarParameter` | Exposed float parameter |
| `VectorParameter` | Exposed color/vector parameter |
| `Fresnel` | Edge glow |

### Emissive Glow Pattern

Set node values via `set_material_node_property` (not `set_material_node_value` — that tool doesn't exist). Use `list_material_expression_types` to discover valid `node_type` values for your engine version.

```
create_material(asset_path="/Game/Materials/M_Glow", blend_mode="Opaque")

add_material_node(material_path="...", node_type="Constant3Vector", node_name="GlowColor")
set_material_node_property(material_path="...", node_name="GlowColor",
                           property_name="Constant", value="(R=1.0,G=0.4,B=0.0)")

add_material_node(material_path="...", node_type="Constant", node_name="GlowIntensity")
set_material_node_property(material_path="...", node_name="GlowIntensity",
                           property_name="R", value="5.0")  # >1.0 enables bloom

add_material_node(material_path="...", node_type="Multiply", node_name="EmissiveMultiply")
connect_material_nodes(material_path="...", from_node="GlowColor", from_pin="RGB",
                       to_node="EmissiveMultiply", to_pin="A")
connect_material_nodes(material_path="...", from_node="GlowIntensity", from_pin="",
                       to_node="EmissiveMultiply", to_pin="B")
connect_material_nodes(material_path="...", from_node="EmissiveMultiply", from_pin="",
                       to_node="MaterialOutput", to_pin="EmissiveColor")
```

For complex graphs, prefer `batch_edit_material_nodes` to do all node creation + connections in one atomic call — fewer round trips and clearer rollback on failure.

After editing, run `get_material_errors(material_path="...")` to check for compile errors. If the graph compiled but visuals are wrong, `dump_material_graph` and inspect the connection list.

**Key rule:** Emissive intensity must exceed 1.0 to trigger bloom. Values of 3–10 produce visible bloom.

**Gotcha:** If Emissive shows no glow, check that Post Process Volume has Bloom enabled.

### Translucent Material for Particles

Use `blend_mode="Translucent"` and `shading_model="Unlit"` — lit particle materials require normal vectors Niagara doesn't provide by default.

### Applying Materials

- To a static mesh actor: `set_actor_material(actor="ActorName", material_slot=0, material="/Game/Materials/M_Name.M_Name")`
- To a Niagara system: `set_niagara_material` (reliable path)
- To a Blueprint component: `set_component_property(property_name="OverrideMaterials[0]", property_value="/Game/Materials/M_Foo.M_Foo")` works for component-defaults. For runtime swap, `SetMaterial` Blueprint node still applies.

### Material Compilation Lag

After creating or modifying, shader compilation takes seconds to minutes. Don't check visual output until done. Poll with `dump_material_graph` — when it returns without errors, compilation is complete.

---

## UMG Widgets

**Before modifying an existing widget:** `dump_widget_tree(widget_path="...")` to read the full hierarchy. Use `get_widget_info` to inspect a single widget's variables and slot properties.

### Creating a Widget Blueprint

```
create_umg_widget_blueprint(widget_name="WBP_HealthBar", path="/Game/UI", parent_class="UserWidget")
```

### Adding Widget Elements

Three dedicated commands for the common cases (with richer initial setup):

```
add_text_block_to_widget(widget_path=".../WBP_HealthBar", text_block_name="HealthLabel",
                         text="HP", font_size=24, color={r:1,g:1,b:1,a:1})
add_button_to_widget(widget_path="...", button_name="StartButton", text="Start")
add_image_to_widget(widget_path="...", image_name="Icon")
```

For everything else, use `add_widget_element` — generic across all UMG classes:

```
add_widget_element(widget_path="...", widget_type="ProgressBar", element_name="HealthBar",
                   position={x:100,y:100}, size={width:300,height:30},
                   properties={Percent:0.75})

add_widget_element(widget_path="...", widget_type="VerticalBox", element_name="Stack")
add_widget_element(widget_path="...", widget_type="Border", element_name="Frame",
                   parent_name="Stack")  # nested inside Stack
```

`widget_type` is the unqualified UMG class name (`ProgressBar`, `VerticalBox`, `HorizontalBox`, `CanvasPanel`, `Border`, `Spacer`, `Overlay`, `ScrollBox`, `SizeBox`, `ScaleBox`, `Slider`, `CheckBox`, `GridPanel`, `UniformGridPanel`, `RichTextBlock`, `Throbber`, `CircularThrobber`, `NamedSlot`, `BackgroundBlur`, `RetainerBox`) or a fully qualified path (`/Script/UMG.ProgressBar`, `/Script/PluginX.MyWidget`).

Optional `parent_name` attaches under an existing panel. Without it, the new element goes on the root canvas — or, if the tree has no root yet and the new element is itself a panel, it becomes the root. `position` and `size` only apply on a CanvasPanel parent. `properties` is a JSON object applied via reflection (one entry per UPROPERTY on the constructed widget). The result includes `properties_set` and any `properties_failed` with a per-entry reason.

For a health bar: one ProgressBar element with `properties: {Percent: <float>}` is the right pattern. MVVM-bind the Percent property afterwards if you need runtime updates.

### MVVM Bindings (the real binding API)

ECABridge MVVM uses a viewmodel-first pattern. Bindings flow from a ViewModel object's properties to widget properties, not directly from Blueprint variables.

```
set_widget_viewmodel(widget_path="...", viewmodel_class="/Game/UI/VM_PlayerHUD.VM_PlayerHUD")
bind_text_to_viewmodel(widget_path="...", widget_name="HealthLabel",
                       viewmodel_property="HealthText")
bind_visibility_to_viewmodel(widget_path="...", widget_name="LowHealthWarning",
                             viewmodel_property="bIsLowHealth")
bind_image_to_viewmodel(widget_path="...", widget_name="HealthIcon",
                        viewmodel_property="HealthIconBrush")
```

For non-text/visibility/image bindings, use `add_viewmodel_binding` (general form). Inspect existing bindings with `get_viewmodel_bindings` and the widget's available MVVM-eligible properties with `get_widget_mvvm_properties`.

### Displaying a Widget in Game

Two paths:

**Direct (no Blueprint nodes):** `add_widget_to_viewport(widget_path="...", z_order=0)` — adds an instance of the widget to the player's viewport directly.

**Blueprint-driven (for runtime instancing in BP graphs):** `add_blueprint_function_node` with `function_name="CreateWidget"` and `target_class="WidgetBlueprintLibrary"`, wired into `AddToViewport`. Use this when the widget needs to respond to gameplay events.

**Gotcha:** If the widget appears blank at runtime, `CreateWidget` is missing the owning player context. Use `GetPlayerController(0)` as the Owner pin.

### In-World Widget Component (3D billboard)

```
add_blueprint_component(blueprint_path="...", component_type="Widget", component_name="HealthWidget")
set_component_property(blueprint_path="...", component_name="HealthWidget",
                       property_name="WidgetClass",
                       property_value="/Game/UI/WBP_HealthBar")
```

`WidgetClass` is a `TSubclassOf<UUserWidget>` (an FClassProperty). Pass either the asset path (`/Game/UI/WBP_HealthBar`) or the full generated-class path (`/Game/UI/WBP_HealthBar.WBP_HealthBar_C`); the asset-path form auto-expands.

Default draw mode is Screen Space; for world-space billboard, set `Space` to `"World"` via the same `set_component_property` call.

### Bind Widget Events to Blueprint Functions

The function must already exist on the Widget Blueprint (use `add_blueprint_event_node` or the editor to create it first):

```
bind_widget_event(widget_path="/Game/UI/WBP_HUD",
                  widget_name="StartButton",
                  event_name="OnClicked",
                  function_name="HandleStartClicked")
compile_blueprint(blueprint_path="/Game/UI/WBP_HUD")
```

`event_name` accepts both the bare event name (`OnClicked`, `OnHovered`) and the underlying delegate property (`OnClickedEvent`) — the resolver tries the literal first, then with an `Event` suffix. Without `function_name`, the widget is just marked as a variable (legacy behavior).

If you don't know the function name, list candidates:

```
dump_blueprint_graph(blueprint_path="/Game/UI/WBP_HUD")  # functions[] in result
```

To discover what widget element types you can pass to `add_widget_element`:

```
list_widget_classes(name_filter="Box")  # → CheckBox, ComboBox, HorizontalBox, VerticalBox, ScrollBox, ...
list_widget_classes()  # all UWidget subclasses, with is_panel flag for parent eligibility
```

---

## MetaSound — Crash Avoidance

### The Multiply (Audio) Crash

Setting a float literal on an Audio-type pin crashes at **RUNTIME** (not edit time):
- Crash: `bExpectsNone [MetasoundDataFactory.h:395]`
- **Rule:** Never set scalar values on Audio-type pins. Connect audio buffers to audio pins.

After a MetaSound crash, all custom nodes are wiped — only OnPlay/OnFinished/Output survive. You must recreate from scratch. Save before every PIE test.

### Pin Name Matching

Always call `dump_metasound_graph(metasound_path="...")` or `get_metasound_nodes(include_details=true)` before setting pins. Names are exact: SuperOscillator uses `Frequency`, `Voices`, `Detune` — not `Base Frequency`.

### Safe Signal Chain Pattern

```
PerlinNoise(Audio) → Add(Audio).PrimaryOperand
SuperOscillator.Audio → Add(Audio).AdditionalOperands
Add(Audio).Out → OnePole_LPF.In
OnePole_LPF.Out → MonoOutput
```

No Multiply (Audio) in the chain — intentional.

---

## Blueprint Wiring — Patterns and Gotchas

### Read Before Writing

Always call `dump_blueprint_graph(blueprint_path="...")` before editing. It returns every graph, node, pin, connection, variable, and component. Never guess the existing structure.

### Blueprint Lisp

ECABridge represents Blueprint graphs as Lisp-like S-expressions. Read with `dump_blueprint_graph`; the output is structured JSON. Write back with `batch_edit_blueprint_nodes`. The Lisp DSL format:

```lisp
(graph EventGraph
  (node BeginPlay
    (then (node PrintString (string "Hello"))))
  (node EventTick
    (DeltaSeconds (node Multiply (A (var DeltaSeconds)) (B 2.0)))))
```

Key rules:
- `(node NodeName (pin value) ...)` — one call per node
- `(then ...)` — chains exec pins
- `(var VarName)` — local variable reference
- `(self)` — actor reference

### AudioComponent Setup

1. `add_blueprint_component(component_type="Audio")` — NOT `"AudioComponent"`
2. `set_component_property(property_name="bAutoActivate", property_value=false)`
3. `set_component_property(property_name="Sound", property_value="/Game/Audio/MySound.MySound")` — works directly now (FObjectProperty handling). For runtime swaps, you can still use a `SetSound` Blueprint node.
4. Add `Play` / `Stop` at state transitions

### Inserting Nodes Into Existing Exec Chains

1. `find_blueprint_nodes` — locate the two connected nodes
2. `break_pin_connection` — disconnect them
3. `batch_edit_blueprint_nodes` — create new node(s)
4. `connect_blueprint_nodes` — wire: prev.then → new.execute, new.then → next.execute

### batch_edit_blueprint_nodes Tips

- Component ref: `{"type": "component", "component_name": "ComponentName"}`
- Function call: `{"type": "function", "function_name": "FuncName", "target": "ComponentName", "target_class": "ClassName"}`
- Exec pins must be wired separately with `connect_blueprint_nodes` after batch creation.

### Pin Value Formats

- Object reference: `/Game/Path/AssetName.AssetName`
- Struct (LinearColor, Vector): `(R=1.0,G=0.0,B=0.0,A=1.0)`

---

## UltraDynamicSky Plugin

- Spawn **Ultra_Dynamic_Sky** at origin. Spawn **Ultra_Dynamic_Weather** alongside it.
- Weather vars are floats 0–1. Each has a `- Manual Override` bool companion.
- **Set the manual override bool to `true` BEFORE setting the weather value** — otherwise random weather overrides it.
- First spawn triggers 150+ shader compiles. Wait before judging visuals.
- May conflict with existing DirectionalLights — hide or remove them.
- Weather particles (rain, snow) are most visible during PIE. Editor viewport shows sky/clouds but may not show particles.

---

## MetaHuman

ECABridge includes 22 MetaHuman commands for procedural character creation. The full technical reference (build environment, reflection patterns, groom flow, enum gotchas, 5.7 API pitfalls) lives in the Agile Lens knowledge base:

`~/knowledge/departments/engineering/metahuman-mcp-reference.md`

Read that file before working on any MetaHuman command implementation or debugging a MetaHuman pipeline failure. The `docs/METAHUMAN.md` in the ECABridge repo is a pointer to this same file.

---

## Reading Validation Errors — The Schema Is In The Response

When ECABridge rejects a call for a missing or wrong-type argument, the error response **embeds the full `inputSchema` for that tool inline**. Read it. Don't guess at the fix. Don't describe what you think the schema should be — copy what the response tells you it actually is.

### Wasted-turns pattern

> Agent calls `set_niagara_module_input` without `script_usage`.
> Server returns: `"Missing required argument: script_usage"`
> Agent: "I think it's `spawn`?" → fails → "Maybe `update`?" → fails → "Let me try `Spawn`?" → three wasted turns.

### One-turn pattern

> Same call, same error — but the response now also includes:
> ```json
> {
>   "error": "Missing required argument: script_usage",
>   "inputSchema": {
>     "properties": {
>       "script_usage": {
>         "type": "string",
>         "enum": ["particle_spawn","particle_update","emitter_spawn","emitter_update","system_spawn","system_update"]
>       },
>       "...": "..."
>     },
>     "required": ["system_path","emitter_name","module_name","input_name","script_usage","value"]
>   }
> }
> ```
> Agent reads the enum, picks the correct value, retries — done in one turn.

**Rule:** the embedded schema in the error response is authoritative. This skill manual is approximate. If they disagree, trust the schema.

---

## Screenshots — Inline Image Content

The screenshot commands return the PNG inline as MCP `image` content blocks **when you omit `file_path`**:

```json
{ "type": "image", "mimeType": "image/png", "data": "<base64-encoded PNG>" }
```

| Command | Use for |
|---|---|
| `take_camera_screenshot` | Editor camera / viewport view |
| `take_gameplay_screenshot` | Live PIE / SIE frame |
| `take_depth_screenshot` | Scene depth buffer |
| `take_metahuman_editor_screenshot` | The floating `MH_<Name>` MetaHuman editor Slate window |
| `take_screenshots_sweep` | Multi-angle / multi-camera capture in one call |

**Recommendation:** prefer the inline form — your client renders the image directly in the conversation, no disk round-trip and no file path bookkeeping. Pass `file_path` only when (a) your MCP client doesn't render image content blocks, or (b) you specifically need the file on disk for downstream tooling (render pipeline, ticket attachment, baselining).

---

## Error Quick Reference

| Error | Cause | Fix |
|---|---|---|
| `Unsupported property type 'X' for property 'Y'` | Property is a struct, array, map, or other unsupported reflection type | Use a Blueprint function node (Set… or batch_edit_blueprint_nodes) — `set_component_property` covers bool/int/float/double/string/name + object/soft-object/class/soft-class refs only |
| `Unknown component type` | Plugin component type that the module-prefix fallback didn't catch | Pass the fully qualified class path (e.g. `/Script/MyPlugin.MyComponent`). Common ones (Engine, Niagara, UMG, Paper2D, MovieScene, CinematicCamera) are auto-resolved. |
| `Input '<name>' not found in module '<X>'. Available inputs: [...]` | Wrong input name passed to set_niagara_module_input | The error message lists the valid names. Use the short name (`SpawnRate`) or the full handle (`Module.SpawnRate`). Run list_module_inputs first if you don't know what's there. |
| `Failed to load random range script` | `set_niagara_dynamic_input` is broken | No MCP workaround; use Python or bake the value |
| `bExpectsNone` crash at PIE | Float literal on Audio-type pin in MetaSound | Restart editor, remove the literal, use audio buffer connections |
| `RegisteredElementType` crash | Referenced mesh deleted/modified, or rapid spawn/delete sequence | Restart editor. Run `get_asset_references` before deleting anything. |
| `is_active: false` on Niagara actor | Pre-2026-04-30: factory-created system. Now fixed — re-create the system; create_niagara_system duplicates DefaultSystem under the hood and produces is_active=true | n/a |
| Widget blank at runtime | `CreateWidget` missing owning player context | Use `GetPlayerController(0)` as the Outer pin |
| Material shows no bloom | Emissive intensity ≤ 1.0 or Bloom disabled in Post Process | Set emissive multiplier > 1.0 (try 5.0) |
| Blueprint nodes missing after save | Silent save failure | Run `dump_blueprint_graph` to verify, recreate if missing |
