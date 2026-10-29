# Connected editor inspection and modification

This skill handles links, clipboard exports and native graph JSON locally. Live editor tooling can supply missing asset and function context; it is optional. Reuse the existing ue5-mcp field manual and discover actual server tools/schema rather than assuming a tool prefix.

The inspected `ECABridge` implementation provides `summarize_blueprint`, `dump_blueprint_graph`, `blueprint_to_lisp`, `find_blueprint_callers` and `diff_blueprints`. These are exact API names, not a guarantee every deployed server includes them. Tool metadata is authoritative for arguments. `summarize_blueprint` offers a compact execution-oriented overview; use a full graph dump for pin/default/data-flow evidence. The reader now detects native JSON and adapts it to the shared graph model; it does not treat JSON as clipboard syntax.

Save the complete `dump_blueprint_graph` result on disk, then run:

```sh
node scripts/read-blueprint.mjs native-dump.json --save-session graph.bp-session.json
node scripts/read-blueprint.mjs --session graph.bp-session.json --graph s1:g1 --node <node-guid>
```

Complete JSON-RPC/MCP envelopes are accepted. Reassemble continuation chunks
before importing; error/truncated responses fail closed. Legacy dumps have
incomplete pin/type/default/function metadata; warnings remain in the brief.
The richer `reader_schema_version:1` contract provides real pin IDs, hidden pins,
exact function/macro references and source metadata. Unknown versions fail.
Node raw output remains original JSON, never pasteable Blueprint code.

For a matched capture, request `include_clipboard:true` when the live schema
supports it, then run `node scripts/native-parity.mjs paired-dump.json`. A mismatch
exits 1; missing evidence exits 2. The comparison covers node/pin GUIDs, class,
pin names/directions/categories, string/object defaults, hidden/orphaned flags
and wires. It deliberately does not claim complete localized-text, container
value-type or arbitrary node-property fidelity. Engine version and dirty state
are included in the report. To compare against a saved binary too, begin with an
already saved asset, record its hash before/after, and require a clean package.
Keep private source assets and captured dumps local.

`diff_blueprints` with the GUID identity fix preserves repeated nodes; it no
longer guesses correspondence between unrelated assets from matching display
titles. Check `identity_scheme` and `identity_warnings` before interpreting a diff.

For a requested edit: preserve the current asset, inspect exact node/pin IDs, identify affected callers and macro bodies, apply the smallest supported mutation, compile, save, then read back/diff and test the relevant event in Unreal. Confirm replication/authority and latent semantics in the live project when applicable. A topology check does not establish runtime behavior.

Avoid writing `blueprint_to_lisp` output back over an existing populated Blueprint. Field tests found append behavior, duplicate events, dropped macros and changed pin references. Lisp can be a helpful explanation view, but it is not a lossless interchange format. Use the full graph and surgical node/pin tools; validate uncertain operations on a duplicate. This reader never invokes a write tool itself.
