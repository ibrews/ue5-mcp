# ue5-mcp

A knowledge base for AI-assisted Unreal Engine 5 development via the [ECABridge MCP plugin](https://www.unrealengine.com/marketplace/en-US/product/ecabridge). Built for [Claude](https://claude.ai) (Cowork / Claude Code), but the knowledge is useful for any AI agent that connects to UE5 through MCP.

## What this is

When Claude connects to Unreal Engine through the [ECABridge MCP plugin](https://www.unrealengine.com/marketplace/en-US/product/ecabridge), it gains access to 200+ tools for manipulating Blueprints, materials, Niagara particles, MetaSound audio, and more. The tools are powerful but full of undocumented quirks — APIs that silently fail, crash patterns that only surface at runtime, and workarounds that take hours to discover through trial and error.

This skill gives Claude that knowledge upfront so it doesn't have to rediscover it every session.

## What's covered

- **Tool strategy** — when to use MCP tools vs pixel streaming vs Python editor scripting, and the limitations of each
- **Python ↔ MCP data channel** — a workaround pattern for reading Python script output back through MCP (Actor Tags)
- **Niagara particles** — the full map of what MCP calls work, which are broken, and the step-by-step pattern that actually produces visible particles
- **MetaSound audio** — crash-causing patterns to avoid (the Multiply Audio bug will crash your editor at runtime with no warning at edit time)
- **Blueprint wiring** — patterns for AudioComponent setup, inserting nodes into exec chains, batch editing, and pin value formats
- **Core UE5 gotchas** — Lumen lighting requirements, instance override staleness, referenced mesh deletion crashes, editor sprite false positives

## Requirements

- Unreal Engine 5.x with the [ECABridge MCP plugin](https://www.unrealengine.com/marketplace/en-US/product/ecabridge) installed and connected
- An AI agent that can call MCP tools (Claude, OpenClaw, or any MCP-compatible agent)
- Optional: Pixel Streaming plugin enabled (for visual verification and game input)
- Optional: Python Editor Script Plugin enabled (for advanced scripting)

## Installation

### Cowork (Claude desktop app)

Clone into your skills directory:

```bash
git clone git@github.com:ibrews/ue5-mcp.git ~/.skills/skills/ue5-mcp
```

The skill auto-triggers when Unreal Engine MCP tools are detected in a session.

### Claude Code

Clone into your project or global skills directory:

```bash
git clone git@github.com:ibrews/ue5-mcp.git .claude/skills/ue5-mcp
```

### OpenClaw and other AI agents

The `SKILL.md` file uses Claude's skill format (YAML frontmatter + markdown), but the actual content — tool strategies, crash patterns, broken APIs, working workarounds — is universal to anyone using UE5's ECABridge MCP tools regardless of which AI is driving them.

To use with a non-Claude agent, feed the content of `SKILL.md` into your agent's system prompt or knowledge base. The file is plain markdown beneath the YAML header. Strip the frontmatter if your agent doesn't understand it — the knowledge sections stand on their own.

If your agent framework has its own skill/plugin format, adapt the markdown content into that format. The information doesn't change; only the packaging does.

## Updating

```bash
cd <path-to-skill>/ue5-mcp
git pull
```

## Contributing

This skill is a living document. If you discover new MCP quirks, crash patterns, or workarounds, open a PR or issue. The kind of knowledge that belongs here is the stuff you'd never find in official docs — things that only surface after you've hit the wall and debugged your way through.

## Origin

Built during a series of real UE5 development sessions using Claude + ECABridge, including a self-landing rocket project that exercised Blueprints, Niagara, MetaSound, materials, Python scripting, and pixel streaming. Every entry in the skill traces back to an actual failure or hours-long debugging session.
