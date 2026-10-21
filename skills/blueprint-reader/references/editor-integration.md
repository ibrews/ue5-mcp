# Connected editor inspection and modification

This skill handles links and clipboard exports locally. Live editor tooling can supply missing asset and function context; it is optional. Reuse the existing ue5-mcp field manual and discover actual server tools/schema rather than assuming a tool prefix.

The inspected `ECABridge` implementation provides `summarize_blueprint`, `dump_blueprint_graph`, `blueprint_to_lisp`, `find_blueprint_callers` and `diff_blueprints`. These are exact API names, not a guarantee every deployed server includes them. Tool metadata is authoritative for arguments. `summarize_blueprint` offers a compact execution-oriented overview; use a full graph dump for pin/default/data-flow evidence. Native JSON dumps are a different format from this reader's JSON; do not feed them to the clipboard parser.

For a requested edit: preserve the current asset, inspect exact node/pin IDs, identify affected callers and macro bodies, apply the smallest supported mutation, compile, save, then read back/diff and test the relevant event in Unreal. Confirm replication/authority and latent semantics in the live project when applicable. A topology check does not establish runtime behavior.

Avoid writing `blueprint_to_lisp` output back over an existing populated Blueprint. Field tests found append behavior, duplicate events, dropped macros and changed pin references. Lisp can be a helpful explanation view, but it is not a lossless interchange format. Use the full graph and surgical node/pin tools; validate uncertain operations on a duplicate. This reader never invokes a write tool itself.
