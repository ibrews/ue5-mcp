# ue5-mcp

A knowledge base for AI-assisted Unreal Engine 5 development via MCP.

When an AI agent connects to Unreal Engine through the [ECABridge MCP plugin](https://www.unrealengine.com/marketplace/en-US/product/ecabridge), it gains access to 200+ tools for manipulating Blueprints, materials, Niagara particles, MetaSound audio, meshes, widgets, and more. The tools are powerful but full of undocumented quirks — APIs that silently fail, crash patterns that only surface at runtime, and workarounds that take hours to discover through trial and error.

This skill gives your AI that knowledge upfront so it doesn't have to rediscover it every session.

## What's inside

- **Tool strategy** — when to use MCP tools vs pixel streaming vs Python editor scripting, and the tradeoffs of each
- **Python ↔ MCP data channel** — a workaround for reading Python script output back into MCP using Actor Tags (because there's no stdout pipe)
- **Niagara particles** — which MCP calls actually work, which silently fail, and the step-by-step pattern that produces visible particles (hint: most module inputs can't be set through the API)
- **MetaSound audio** — crash-causing patterns to avoid (connecting a Multiply node to an Audio output will crash your editor at runtime with zero warning at edit time)
- **Blueprint wiring** — patterns for AudioComponent setup, inserting nodes into existing exec chains, batch editing, and pin value formats that the API actually accepts
- **Core UE5 gotchas** — Lumen lighting requirements, instance override staleness, referenced mesh deletion crashes, editor sprite false positives

## Installation

### As a personal skill (all projects)

```bash
git clone https://github.com/ibrews/ue5-mcp.git ~/.claude/skills/ue5-mcp
```

### As a project skill (single project)

```bash
git clone https://github.com/ibrews/ue5-mcp.git .claude/skills/ue5-mcp
```

### Via Cowork UI

In the Claude desktop app: **Customize > Skills > "+" > Upload a skill** — zip this repo and upload it.

### Other AI agents (OpenClaw, etc.)

The `SKILL.md` file uses Claude's skill format (YAML frontmatter + markdown), but the content is universal. Feed it into your agent's system prompt or knowledge base. Strip the YAML frontmatter if your framework doesn't understand it — the knowledge sections stand on their own.

---

The skill auto-triggers when Unreal Engine MCP tools are detected in a session. Restart Claude after installing.

## Requirements

- Unreal Engine 5.x
- [ECABridge MCP plugin](https://www.unrealengine.com/marketplace/en-US/product/ecabridge) installed and connected
- An AI agent that can call MCP tools (Claude, OpenClaw, or any MCP-compatible agent)
- Optional: Pixel Streaming plugin (for visual verification and game input)
- Optional: Python Editor Script Plugin (for advanced scripting)

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
