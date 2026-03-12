---
name: ue5-mcp
description: >
  Unreal Engine 5 development via the ECABridge MCP plugin, pixel streaming, and Python editor scripting.
  Use this skill whenever the user's session has Unreal Engine MCP tools available (tools with names like
  create_blueprint, spawn_actor, add_material_node, create_niagara_system, etc.) or when the user mentions
  Unreal Engine, UE5, Blueprints, Niagara, MetaSound, or any UE game development workflow. Auto-trigger
  when unreal-editor MCP tools are detected. This skill contains hard-won knowledge from real debugging
  sessions — crash patterns, broken APIs, working workarounds, and the exact tool call patterns that
  actually succeed. Ignoring this skill when UE MCP tools are present will lead to hours of wasted time
  hitting known dead ends.
---

# UE5 MCP Development Skill

This skill contains battle-tested patterns for working with Unreal Engine 5 through MCP tools (ECABridge plugin), pixel streaming, and Python editor scripting. Every piece of advice here comes from actual failures, crashes, and debugging sessions — not documentation.

## Tool Strategy: When to Use What

You have three tools for interacting with UE5. Choosing the right one for each task saves enormous time.

### ECABridge MCP Tools (Primary)

The MCP plugin is your main interface. It handles structured operations well:

- Creating/modifying Blueprints (components, variables, node graphs via Blueprint Lisp or batch_edit)
- Spawning/deleting/transforming level actors
- Creating and editing materials, meshes, textures
- Reading Blueprint info, actor properties, asset metadata
- UMG widgets and MVVM bindings
- MetaSound creation and editing
- DataTable read/write
- Starting/stopping PIE (Play in Editor)
- Console commands via `run_console_command`
- Editor viewport screenshots

**Where MCP falls short** (use Python or pixel streaming instead):

- Cannot send keyboard/mouse input during PIE
- Cannot interact with editor UI elements (dropdowns, dialog buttons, context menus)
- Cannot set object reference properties on components (Sound, Mesh refs via `set_component_property` returns "Unsupported property type")
- Niagara module inputs are unreliable (see Niagara section)
- Cannot access editor preferences beyond what's explicitly exposed

### Pixel Streaming (localhost:80)

Use pixel streaming for things MCP genuinely can't do — game input during PIE and editor UI interaction. Don't leave the connection lingering.

- Pressing game keys during PIE (1, 2, WASD, etc.)
- Clicking editor UI elements MCP can't reach (viewport dropdown, orthographic views, dialog buttons)
- Visual verification of the live viewport
- Navigating editor menus

**Setup:** Always call `tabs_context_mcp` first — tab IDs change between sessions. You'll need to click "CLICK TO START" or "DISCONNECTED. CLICK TO RESTART" to activate.

**Important:** Pixel streaming captures input focus, blocking the user's editor access. Game viewport needs a click to capture focus before key input works. Audio can't be heard through pixel streaming — only the user can verify audio.

### Python Editor Scripting (via `unreal` module)

Python fills the gaps that MCP and pixel streaming can't cover. Run it via `run_console_command("py your_code_here")`.

Best for:
- Niagara parameter manipulation (MCP's #1 gap)
- Batch asset operations (bulk rename, LOD generation, asset auditing)
- Sequencer control
- Setting object reference properties MCP can't handle
- Custom validation and introspection

**The critical problem:** Python stdout goes to the UE log, not back to MCP. You can't directly read Python output.

**The workaround — Actor Tags data channel:**

```python
# Python writes results into an actor's tags
import unreal
result = "whatever you need to return"
note = unreal.EditorLevelLibrary.spawn_actor_from_class(
    unreal.Note, unreal.Vector(0, 0, 9999)
)
note.tags = [result[:200]]  # tags are Name type, keep short
```

Then read back via MCP: `get_actor_properties("Note")` → check `tags` array. Delete the Note actor when done. For longer output, split across multiple tags.

**Gotcha:** Writing new tags to an already-existing actor sometimes returns stale data. Spawn a fresh Note actor for each Python output read, then delete it after.

**Required plugins:** Python Editor Script Plugin, Python Foundation Packages. Optional but useful: Sequencer Scripting, Geometry Script, PCG Python Interop.

---

## Core UE5 Knowledge

### Lumen Lighting
Always set lights to **Movable** mobility when using Lumen. Lumen requires movable lights for dynamic GI. Static or Stationary lights won't contribute to Lumen's global illumination.

### Blueprint Instances vs Parent
Level-placed instances can retain stale editor overrides even after the parent Blueprint is modified. Always check the level instance after changing the parent. You may need to revert overridden properties on the instance to pick up the new defaults.

### Never Delete/Modify Referenced Meshes
Deleting or transforming mesh assets while actors reference them causes a `RegisteredElementType` assertion crash (`UTypedElementRegistry::GetElementImpl → USelection::GetObjectForElementHandle`). This also happens when selecting broken Niagara actors.

**Safe pattern:** Always create NEW mesh assets, verify they work, then swap references on actors. Never force-delete assets that are in use.

If you hit this crash, just restart the editor — no data is lost.

### Editor Sprites vs Actual Particles
Static screenshots from `take_gameplay_screenshot` show editor selection sprites (component icons) that look like particles but are NOT real particles. Always verify particle effects by:
1. Spawning the Niagara effect as an actor in the level and visually confirming via pixel streaming
2. Running PIE and checking there too

Never assume a particle effect works just because it compiles. Drop it in the scene and look at it.

### Save Frequently
Editor crashes (Niagara assertion, MetaSound crash) revert unsaved changes. Context window compactions lose track of what was already done. Save after every few meaningful changes. Verify with `find_blueprint_nodes` or `blueprint_to_lisp` that your nodes actually exist before moving on.

---

## Niagara Particle System — What Works and What Doesn't

Niagara is the area where MCP has the most limitations. Knowing exactly what works saves hours.

### Creating Niagara Systems (MCP)

**What works:**
- `create_niagara_system` — creates an empty system
- `add_niagara_emitter` with template names (e.g., Fountain) — adds a working emitter with proper module wiring
- `set_niagara_curve` — WORKS reliably for ScaleColor (color curves) and FloatFromCurve (size/float curves)
- `set_niagara_material` — WORKS for assigning materials to sprite renderers

**What's broken or unreliable:**
- `set_niagara_module_input` — most inputs return "Input not found" (SpawnRate, Loop Duration, Gravity, sprite size). Enum-type inputs like Loop Behavior sometimes work.
- `set_niagara_dynamic_input` — BROKEN. "Failed to load random range script" for all attempts.

**Working pattern for creating a Niagara effect:**
1. `create_niagara_system` with sprite template
2. `add_niagara_emitter` from a template (Fountain works)
3. Create a translucent material with a ParticleColor node → BaseColor (RGB) and Opacity (A)
4. `set_niagara_material` to assign it
5. `set_niagara_curve` for color and size over lifetime
6. Accept default spawn rate and velocity (you can't change them via MCP)
7. **Drop the effect in the scene and visually verify it produces particles**

### Niagara Components in Blueprints

This is a major gap. You cannot add a NiagaraComponent to a Blueprint via MCP or Python:

- `add_blueprint_component` returns "Unknown component type" for all variants ("Niagara", "NiagaraComponent", "NiagaraParticleSystem")
- `add_niagara_component` only adds to level actor INSTANCES, not the Blueprint definition
- Python's `unreal` module cannot access Blueprint SCS (Simple Construction Script) to add components

**Workaround:** Use the `SpawnSystemAtLocation` Blueprint function node (from NiagaraFunctionLibrary):
- Add via `add_blueprint_function_node` with `function_name: "SpawnSystemAtLocation"`, `target_class: "NiagaraFunctionLibrary"`
- Set `SystemTemplate` pin to the Niagara system asset path
- Set `bAutoDestroy=true`, `bAutoActivate=true`
- Wire `GetActorLocation` to the `Location` pin
- Insert into the exec chain at the appropriate gameplay moment

This spawns the effect at runtime and auto-cleans up when done.

---

## MetaSound — Crash Avoidance

MetaSound has a specific crash pattern you must avoid.

### The Multiply (Audio) Crash
Setting a float literal on an Audio-type pin causes an assertion crash at RUNTIME (not edit time):
- Crash signature: `bExpectsNone [MetasoundDataFactory.h:395]`
- Root cause: Audio-type pins expect audio buffer connections, not scalar values. The editor doesn't validate this — it only crashes when you play.
- **Rule:** Never use `set_metasound_node_input` to set scalar values on Audio-type pins. For gain control, connect audio sources to both inputs of a Multiply node.

### Graph Wipe After Crash
After an assertion crash during PIE, MetaSound graphs can lose ALL custom nodes. Only the 3 interface nodes (OnPlay, OnFinished, Output) survive.
- **Prevention:** Save frequently. Always save a MetaSound before testing it in PIE.
- **Recovery:** You must recreate all nodes from scratch.

### Pin Name Matching
`set_metasound_node_input` requires exact pin names. Always call `get_metasound_nodes` with `include_details=true` first to discover the actual names. Example: SuperOscillator uses `Frequency`, `Voices`, `Detune` — not `Base Frequency`, `Num Voices`, `Detune Cents`.

### Working Signal Chain Pattern
This pattern produces sound without risking the Multiply crash:
```
PerlinNoise(Audio) → Add(Audio).PrimaryOperand
SuperOscillator.Audio → Add(Audio).AdditionalOperands
Add(Audio).Out → OnePole_LPF.In
OnePole_LPF.Out → MonoOutput
```
No Multiply (Audio) node in the chain — that's intentional.

---

## Blueprint Wiring — Patterns and Gotchas

### AudioComponent Setup
1. Add component: `add_blueprint_component` with type `"Audio"` (NOT `"AudioComponent"`)
2. Disable auto-activate: `set_component_property` → `bAutoActivate = false`
3. Cannot set Sound property via MCP (returns "Unsupported property type")
4. **Workaround:** Add a `SetSound` function node in BeginPlay. Set the `NewSound` pin to the asset path (e.g., `/Game/Audio/MySound.MySound`)
5. Add `Play` / `Stop` function nodes at state transitions

### Inserting Nodes Into Existing Exec Chains
1. Find the two connected nodes with `find_blueprint_nodes`
2. `break_pin_connection` between them
3. Create new node(s) via `batch_edit_blueprint_nodes`
4. Wire: previous.then → new_node.execute, new_node.then → next.execute

### batch_edit_blueprint_nodes Tips
- Component references: `{"type": "component", "component_name": "ComponentName"}`
- Function calls: `{"type": "function", "function_name": "FuncName", "target": "ComponentName", "target_class": "ClassName"}`
- Exec pins must be wired separately after batch creation using `connect_blueprint_nodes`

### Pin Value Formats
- `set_blueprint_pin_value` works for: strings, numbers, bools, object references
- Object reference format: `/Game/Path/AssetName.AssetName`
- Struct pins (LinearColor, Vector): `(R=1.0,G=0.0,B=0.0,A=1.0)`

---

## UltraDynamicSky Plugin

If the project uses UltraDynamicSky:

- **Ultra_Dynamic_Sky** — sky dome, sun, moon, clouds, atmosphere. Spawn at origin.
- **Ultra_Dynamic_Weather** — weather system. Spawn alongside sky actor.
- Weather variables are floats 0-1. Each has a `- Manual Override` bool companion.
- Set the manual override bool to `true` BEFORE setting the weather value, otherwise random weather overrides it.
- Weather particles (rain, snow) are most visible during PIE — the editor viewport shows sky/clouds but not all particle effects.
- First spawn triggers 150+ shader compiles. Wait before judging visuals.
- May conflict with existing DirectionalLights — hide or remove them.
