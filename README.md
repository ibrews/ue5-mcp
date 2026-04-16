# ue5-mcp

A knowledge base for AI-assisted Unreal Engine 5 development via MCP.

When an AI agent connects to Unreal Engine through [ECABridge](https://github.com/EpicGames/UnrealEngine/tree/ue5-main/Engine/Plugins/Experimental/ECABridge), it gains access to 200+ tools for manipulating Blueprints, materials, Niagara particles, MetaSound audio, meshes, widgets, and more. The tools are powerful but full of undocumented quirks — APIs that silently fail, crash patterns that only surface at runtime, and workarounds that take hours to discover through trial and error.

This plugin gives your AI that knowledge upfront so it doesn't have to rediscover it every session.

## What's inside

- **Tool strategy** — when to use MCP tools vs pixel streaming vs Python editor scripting, and the tradeoffs of each
- **Python ↔ MCP data channel** — a workaround for reading Python script output back into MCP using Actor Tags (because there's no stdout pipe)
- **Niagara particles** — `create_niagara_system` produces systems that compile clean but never emit particles. The working pattern uses `duplicate_asset` on an existing system instead. Most module inputs can't be set through the API.
- **MetaSound audio** — crash-causing patterns to avoid (connecting a Multiply node to an Audio output will crash your editor at runtime with zero warning at edit time)
- **Blueprint wiring** — patterns for AudioComponent setup, inserting nodes into existing exec chains, batch editing, and pin value formats that the API actually accepts
- **Core UE5 gotchas** — Lumen lighting requirements, instance override staleness, referenced mesh deletion crashes, editor sprite false positives

## ECABridge

[ECABridge](https://github.com/EpicGames/UnrealEngine/tree/ue5-main/Engine/Plugins/Experimental/ECABridge) is Epic's experimental MCP plugin for Unreal Engine. It ships with UE 5.8, but compiled builds are available for UE 5.7 on Mac and Windows. See the [livestream intro](https://youtube.com/live/HLVxmSw1jNg) for setup and a walkthrough.

Note: The ECABridge source link requires a GitHub account linked to your Epic Games account to access.

## Installation

### As a plugin (recommended — auto-updates from GitHub)

Add the marketplace and install:

```
/plugin marketplace add ibrews/ue5-mcp
/plugin install ue5-mcp@ibrews-ue5-mcp
```

Works in both Claude Code and Cowork. Updates automatically when you push changes to the repo.

### Cowork (manual upload)

1. [Download this repo as a ZIP](https://github.com/ibrews/ue5-mcp/archive/refs/heads/main.zip)
2. In Claude desktop: **Customize > Skills > "+" > Upload a skill** → select the zip

### Claude Code (as a standalone skill)

```bash
git clone https://github.com/ibrews/ue5-mcp.git ~/.claude/skills/ue5-mcp
```

### Other AI agents (OpenClaw, etc.)

The `SKILL.md` file uses Claude's skill format (YAML frontmatter + markdown), but the content is universal. Feed it into your agent's system prompt or knowledge base. Strip the YAML frontmatter if your framework doesn't understand it — the knowledge sections stand on their own.

---

The skill auto-triggers when Unreal Engine MCP tools are detected in a session. Restart Claude after installing.

## Requirements

- Unreal Engine 5.x
- [ECABridge](https://github.com/EpicGames/UnrealEngine/tree/ue5-main/Engine/Plugins/Experimental/ECABridge) MCP plugin installed and connected
- An AI agent that can call MCP tools (Claude, OpenClaw, or any MCP-compatible agent)
- Optional: Pixel Streaming plugin (for visual verification and game input)
- Optional: Python Editor Script Plugin (for advanced scripting)

## Things to Try

1. **Install the skill and ask your agent to create a new Blueprint Actor** — with ECABridge connected, the Blueprint appears in the Content Browser within seconds; no manual editor clicking required.
2. **Ask the agent to create a Niagara particle system** — the skill guides it to use `duplicate_asset` on an existing system instead of `create_niagara_system` (which compiles clean but never emits); you should see particles in the viewport.
3. **Ask the agent to wire an AudioComponent to a MetaSound asset** — the skill warns against the crash pattern (Multiply node → Audio output) and provides the safe wiring sequence; the editor should not crash.
4. **Ask the agent to run `dump_blueprint_graph` on any Blueprint in your project** — you get a complete JSON dump of all graphs, nodes, pins, and connections that the LLM can reason about directly.
5. **Ask the agent to batch-rename all assets in a folder using the Python Editor Script Plugin** — the skill describes the Python ↔ MCP data channel workaround (Actor Tags as a stdout pipe) so results flow back to the agent correctly.

## How it works

The skill is a single `SKILL.md` file. When loaded, it gives your AI agent context about:

1. **What tools to reach for** — MCP for asset manipulation, pixel streaming for visual verification, Python for batch operations
2. **What will break** — specific API calls that compile clean but produce no results, crash the editor, or silently corrupt assets
3. **What actually works** — tested patterns with exact parameter formats, workaround sequences, and the order of operations that matters

The knowledge is organized by subsystem (Niagara, MetaSound, Blueprints, etc.) so the agent can quickly find relevant guidance for whatever it's working on.

## Contributing

This is a living document. If you discover new MCP quirks, crash patterns, or workarounds, open a PR or issue. The kind of knowledge that belongs here is the stuff you'd never find in official docs — things that only surface after hitting a wall and debugging your way through.

Especially welcome:
- New subsystem coverage (Sequencer, Control Rig, PCG, etc.)
- Corrections to existing patterns that no longer apply after ECABridge updates
- Platform-specific gotchas (Linux, console targets)

## Origin

Built during real UE5 development sessions using Claude + ECABridge, including a self-landing rocket project that exercised Blueprints, Niagara, MetaSound, materials, Python scripting, and pixel streaming. Every entry traces back to an actual failure or hours-long debugging session.

## License

MIT
