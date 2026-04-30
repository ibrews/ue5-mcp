---
name: ue5-mcp
description: >
  Unreal Engine 5 development via the ECABridge MCP plugin, pixel streaming, and Python editor scripting.
  Use this skill whenever the user's session has Unreal Engine MCP tools available (tools with names like
  create_blueprint, create_actor, add_material_node, create_niagara_system, dump_blueprint_graph, etc.) or
  when the user mentions Unreal Engine, UE5, Blueprints, Niagara, MetaSound, or any UE game development
  workflow. Auto-trigger when unreal-editor MCP tools are detected. This skill contains hard-won knowledge
  from real debugging sessions — crash patterns, broken APIs, working workarounds, and the exact tool call
  patterns that actually succeed. Ignoring this skill when UE5 MCP tools are present will lead to hours of
  wasted time hitting known dead ends.
---

# UE5 MCP Development Skill

Battle-tested patterns for working with Unreal Engine 5 through ECABridge MCP tools (390+ tools on localhost:3000), pixel streaming, and Python editor scripting. Every piece of advice here comes from actual failures, crashes, and debugging sessions — not documentation.

**ECABridge plugin:** https://github.com/ibrews/ECABridge  
**This skill:** https://github.com/ibrews/ue5-mcp

---

## Session Startup Checklist

Run these steps at the start of every UE5 MCP session before doing any work.

1. **Understand the project state first.** Run `dump_level()` to see all actors currently in the scene. Run `find_assets(path_filter="/Game/")` to see what assets exist. Never assume — read first, then act.
2. **Check for existing Niagara systems** — `find_assets(class_filter="NiagaraSystem", path_filter="/Game/")`. If any exist, plan to `duplicate_asset` one instead of calling `create_niagara_system` (which is broken — see Niagara section).
3. **Before editing any Blueprint**, call `dump_blueprint_graph(blueprint_path="...")` to get the complete graph. Never guess the existing node structure.
4. **Before editing any material**, call `dump_material_graph(material_path="...")` to read the current node graph.
5. **Verify pixel streaming if needed** — `tabs_context_mcp` to get the current tab ID. Activate before starting, not mid-task.
6. **Save after every meaningful change.** `save_level()` for level + dirty assets, or `run_console_command("SaveAll")` for a full editor save.

---

## Rosetta Stone: Read Before You Write

ECABridge includes deep introspection commands that serialize any UE5 asset into structured JSON. **Use these before modifying anything.** Trying to edit a Blueprint, material, or Niagara system without reading its current structure first leads to broken connections and wasted calls.

| Command | Use it for |
|---|---|
| `dump_blueprint_graph(blueprint_path)` | Complete graph — all nodes, pins, connections, variables, components |
| `dump_material_graph(material_path)` | All expression nodes, connections, material properties, compilation errors |
| `dump_niagara_system(system_path)` | Emitter stacks, renderers, module inputs, parameter bindings |
| `dump_widget_tree(widget_path)` | Full widget hierarchy — parent-child structure, slot properties, visibility |
| `dump_level(max_actors=100)` | All actors with transforms, components, tags (lightweight or deep mode) |
| `dump_asset(asset_path)` | Full JSON of any asset — all UPROPERTYs, sub-objects, references, metadata |
| `find_assets(class_filter, path_filter)` | Search asset registry by class, path, or name wildcard |
| `get_asset_references(asset_path, direction)` | Dependency graph — what references what (use before deleting anything) |
| `dump_metasound_graph(metasound_path)` | All MetaSound nodes, pins, connections, source inputs/outputs |
| `dump_animation_blueprint(abp_path)` | State machines, transitions, AnimGraph nodes |
| `dump_level_sequence(sequence_path)` | All bindings, tracks, sections, keyframe channel data |
| `dump_datatable(datatable_path)` | Schema with types + all row data |

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

## Tool Strategy: When to Use What

### Quick Decision Table

| What you need to do | Use |
|---|---|
| Read any asset structure (Blueprint, material, Niagara, widget) | `dump_*` Rosetta Stone commands first |
| Create/modify Blueprint graphs, components, variables | MCP |
| Create/edit materials, Niagara systems, MetaSounds | MCP |
| Spawn, move, delete level actors | MCP |
| UMG widgets, DataTables | MCP |
| Keyboard/mouse input during PIE | Pixel streaming |
| Click editor UI elements (menus, dialogs, dropdowns) | Pixel streaming |
| Visual verification of live gameplay/particles | Pixel streaming |
| Niagara parameter manipulation (SpawnRate, velocity) | Python |
| Setting object reference properties MCP can't handle | Python |
| Bulk asset operations, Sequencer control | Python |
| Reading Python output back into MCP | Actor Tags data channel |

### ECABridge MCP Tools (Primary)

390+ tools on `localhost:3000`. Categories include: Actor, Blueprint, Blueprint Node, Material, Material Node, Mesh, Niagara, MetaSound, MVVM, Widget/UMG, Sequencer, Animation, Lighting, Environment/PCG, AI/Navigation, DataTable, Editor, Asset.

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
- Niagara module inputs are unreliable (see Niagara section)

**Recently fixed** (don't reach for Python first for these):
- Object reference properties (Sound, StaticMesh, Material, WidgetClass) now work via `set_component_property` — pass the asset path as `property_value`.
- Generic UMG widget creation: `add_widget_element(widget_type="ProgressBar"|"VerticalBox"|...)` — see UMG section.
- `save_asset(asset_path)` and `save_dirty_assets()` for non-level persistence.

### Pixel Streaming (localhost:80)

Use for things MCP genuinely can't do. Always call `tabs_context_mcp` first — tab IDs change between sessions. You'll need to click "CLICK TO START" or "DISCONNECTED. CLICK TO RESTART" to activate.

- Game key input during PIE (1, 2, WASD, etc.)
- Clicking editor UI elements MCP can't reach
- Real-time visual verification

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

### CRITICAL: `create_niagara_system` Creates Broken Systems

**`create_niagara_system` + `add_niagara_emitter` produces systems that NEVER emit particles.** The system compiles, `dump_niagara_system` reports correct modules, `get_niagara_emitters` looks normal — but `is_active: false` when spawned, zero particles rendered. Even forcing activation via Python produces zero particles. 100% reproducible across all templates.

### Working Pattern: `duplicate_asset`

1. **Find an existing working Niagara system:** `find_assets(class_filter="NiagaraSystem", path_filter="/Game/")`. If none exist, the user must create one manually in the Niagara editor (once only).
2. `duplicate_asset(source_path="...", destination_path="...")`
3. `set_niagara_material` — works on duplicated systems
4. `set_niagara_curve` — works for ScaleColor and FloatFromCurve
5. Spawn it: `spawn_niagara_effect(system_path="...", location={x:0,y:0,z:0})` or via the Blueprint `SpawnSystemAtLocation` node
6. **Verify:** `get_actor_properties("...")` → check `is_active: true`. If false, system is broken.
7. **Visual verify:** Use PIE screenshot or pixel streaming. Editor screenshots don't capture live particles.

**Use `dump_niagara_system(system_path="...")` to inspect a system before duplicating it** — confirms it has working emitters and renderers.

### What's Broken Everywhere

- `set_niagara_module_input` — returns "Input not found" for most inputs (SpawnRate, Loop Duration, Gravity, sprite size). Enum inputs like Loop Behavior sometimes work.
- `set_niagara_dynamic_input` — BROKEN. "Failed to load random range script."
- `add_blueprint_component` for NiagaraComponent — returns "Unknown component type."
- `add_niagara_component` — only adds to level actor instances, not Blueprint definitions.

### NiagaraComponent in Blueprints — Workaround

Use `SpawnSystemAtLocation` from NiagaraFunctionLibrary as a Blueprint function node:
- `add_blueprint_function_node(function_name="SpawnSystemAtLocation", target_class="NiagaraFunctionLibrary")`
- Set `SystemTemplate` pin: `/Game/Path/NS_Asset.NS_Asset`
- Set `bAutoDestroy=true`, `bAutoActivate=true`
- Wire `GetActorLocation` to the `Location` pin

### Particle Appearance Limitations

You inherit the source system's velocity direction and spawn rate because `set_niagara_module_input` can't change most parameters. If you need exhaust smoke but the source is a Fountain (upward + gravity), particles shoot up, not backward. Choose the source system carefully or ask the user to create one with the right baseline behavior.

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
```

Setting the `WidgetClass` property via `set_component_property` is unreliable. Set it via a Blueprint function node calling `SetWidgetClass` in the construction script or BeginPlay. Default draw mode is Screen Space; for world-space billboard, set `Space` to `"World"` via the Blueprint graph.

### Bind Widget Events to Blueprint Functions

```
bind_widget_event(widget_path="...", widget_name="StartButton", event_name="OnClicked",
                  blueprint_path="/Game/Blueprints/BP_HUD", function_name="HandleStart")
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

## Error Quick Reference

| Error | Cause | Fix |
|---|---|---|
| `Unsupported property type 'X' for property 'Y'` | Property is a struct, array, map, or other unsupported reflection type | Use a Blueprint function node (Set… or batch_edit_blueprint_nodes) — `set_component_property` covers bool/int/float/double/string/name + object/soft-object/class/soft-class refs only |
| `Unknown component type` | `add_blueprint_component` with "Niagara" or "NiagaraComponent" | Use `SpawnSystemAtLocation` Blueprint node instead |
| `Input not found` (set_niagara_module_input) | Most Niagara module inputs unreachable via MCP | Accept default or use Python |
| `Failed to load random range script` | `set_niagara_dynamic_input` is broken | No MCP workaround; use Python or bake the value |
| `bExpectsNone` crash at PIE | Float literal on Audio-type pin in MetaSound | Restart editor, remove the literal, use audio buffer connections |
| `RegisteredElementType` crash | Referenced mesh deleted/modified, or rapid spawn/delete sequence | Restart editor. Run `get_asset_references` before deleting anything. |
| `is_active: false` on Niagara actor | System created with `create_niagara_system` | Delete it, `duplicate_asset` a working system instead |
| Widget blank at runtime | `CreateWidget` missing owning player context | Use `GetPlayerController(0)` as the Outer pin |
| Material shows no bloom | Emissive intensity ≤ 1.0 or Bloom disabled in Post Process | Set emissive multiplier > 1.0 (try 5.0) |
| Blueprint nodes missing after save | Silent save failure | Run `dump_blueprint_graph` to verify, recreate if missing |
