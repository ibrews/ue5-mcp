# Sharing Blueprint Reader

Ready-to-adapt launch copy for Alex Coulombe Presents. These are drafts, not a record of posts sent. Link people to the [live browser reader](https://ibrews.github.io/ue5-mcp/) or [agent installation guide](https://github.com/ibrews/ue5-mcp/tree/main/skills/blueprint-reader#readme), not a local `127.0.0.1` address.

## Main post

I accidentally broke Claude by overloading it with raw Unreal Blueprint code. A whole graph, plus its macros, is a lot of text to drop into a conversation.

I wanted an easier way to parse that data next time, so I built Blueprint Reader.

Give it a BlueprintUE link, copied nodes, or text files with your graph and its macros. It reads the connections locally and produces a compact brief for your AI assistant, with an overview, missing context, and improvement tips tied to specific nodes.

One real 30-node Blueprint went from 81,358 bytes of source to a 1,336-byte brief. The full source stays available for follow-up, so you can start with “what does this do?” and then get specific about a branch, an event, or a change you want to make.

It works as a shared skill for Codex and Claude Code. You can also try it in your browser with no installation, then copy the brief into another chat tool. Paste raw code or a BlueprintUE link: the website fetches linked exports automatically and parses the graph locally. Pasted code and files stay in your browser.

Free and open source under MIT. No Unreal editor, MCP connection, or AI API key needed to run the reader.

Try it on a graph you've been meaning to untangle. I'd love to hear what it helps you understand, and where it gets stuck.

[Try Blueprint Reader](https://ibrews.github.io/ue5-mcp/)

## Short post

I accidentally broke Claude with too much raw Unreal Blueprint code. So I built Blueprint Reader: paste an export, get a compact AI brief, then inspect the exact nodes. Free, MIT licensed, and now runs in your browser. Also available as a skill for Codex and Claude Code.

[Try it](https://ibrews.github.io/ue5-mcp/)

## One sentence

Blueprint Reader turns Unreal Blueprint exports and BlueprintUE links into small, useful briefs for Codex and Claude Code, with the original graph available for precise follow-up.

## Visuals and evidence

- [Social preview card](../skills/blueprint-reader/assets/branding/social-card.png): a simple title, connected nodes and reading lens, with the established ivory/green palette. Both the reader and trailer Pages URLs include Open Graph/Twitter metadata. Matching [ICO](../skills/blueprint-reader/assets/branding/favicon.ico) and [SVG](../skills/blueprint-reader/assets/branding/favicon.svg) icons ship with the pages. [Provenance and rebuild instructions](../skills/blueprint-reader/assets/branding/README.md).
- [42-second trailer](https://ibrews.github.io/ue5-mcp/trailer/): opens with the Claude story as source pages overwhelm an illustrated chat, shows an actual BlueprintUE import and Copy action, then follows the real widget connections with a create/store/display animation. The source stays visible as the brief moves into a chat. Clarifying captions and an original instrumental score; works muted. [Poster](assets/blueprint-reader-trailer-poster.jpg), [transcript and rebuild instructions](trailer/README.md).
- [README / social graphic](assets/blueprint-reader-overview.png): workflow illustration, generated with the built-in image tool. The [generation prompt](assets/blueprint-reader-overview-prompt.txt) is included for reproducibility of the art direction, not a promise of identical pixels.
- [Real interface screenshot](assets/blueprint-reader-local-ui.png): reader 0.2.2, 2026-10-21, the AI brief tab after ingesting Nicola's public [Extended dialogue system](https://blueprintue.com/blueprint/6v52d8no/).
- Verified in the local interface: 1 graph, 30 nodes, 107 pins, 38 wires, one missing engine macro body; 81,358 source bytes and 1,336 UTF-8 brief bytes. No private project export is shown.

The brief deliberately omits detail. Do not describe this as lossless compression, a universal reduction ratio, or a measured token/cost saving. Tips are static checks with node evidence, not a comprehensive correctness audit. The reader prepares explanations and edit plans; it does not modify Unreal assets.

## Where to send people

Send people to **[ibrews.github.io/ue5-mcp](https://ibrews.github.io/ue5-mcp/)**. The website parses text and files locally in a browser worker. For automatic BlueprintUE imports, our Vercel helper fetches the linked export; graph parsing still runs locally. Pasted code and files never go to the helper. Use the installed skill for direct agent integration. The optional `127.0.0.1` page remains local to whoever runs `npm start`.

The core stays free. Education, worked examples, review clinics and hands-on support are the complementary paid direction; no membership is needed to use the reader.
