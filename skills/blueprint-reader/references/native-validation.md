# Native graph validation — 2026-10-29

Four private Blueprints from UE 5.7 and 5.8 projects were copied into an isolated
project and loaded in **UE 5.8.4, CL58902052**. The native bridge at commit
`cb720e866caca587a17b1500df23267bf7ed4d62` exported `reader_schema_version:1` JSON
and actual Unreal clipboard text from each same loaded graph. Reader 0.4.0
compared both forms locally. Private binaries and exports are not redistributed.

| Sample | Source project | Graphs | Nodes | Pins | Wires | Scoped comparison |
|---|---|---:|---:|---:|---:|---|
| A | UE 5.7 | 2 | 22 | 70 | 14 | Match |
| B | UE 5.7 | 2 | 107 | 329 | 79 | Match |
| C | UE 5.8 | 2 | 16 | 59 | 20 | Match; orphaned pin warning retained |
| D | UE 5.8 | 2 | 25 | 93 | 23 | Match |

All four copies matched their source hashes before loading, remained byte-for-byte
unchanged afterward, and reported `package_dirty:false`. Dependencies were not
copied wholesale: B reported compilation warnings and C reported a compilation
error. This is **not** a project compile or gameplay test.

Comparison covers node/pin GUIDs, node classes, pin names/directions/categories,
string/object defaults, hidden/orphaned flags and wires. It does not establish
full property, localized-text or container-type fidelity, external macro/function
body coverage, recursively collapsed graphs, or independent `.uasset` decoding.

The real captures exposed native `FName` `None` versus an omitted clipboard name;
the adapter now normalizes this consistently. Matching orphaned pins remain
warnings, while actual mismatches and unresolved topology fail the comparison.
A small synthetic regression covers both behaviors without sharing private data.

The full JavaScript suite passes 50 tests with one optional private fixture
skipped; the private 699-node camera clipboard fixture also passes separately.
Node/browser consistency includes 102 real UEBlueprint clipboard fixtures.
Run `npm test`, `npm run build:web`, and
`node scripts/native-parity.mjs your-paired-dump.json` to reproduce the checks
with your own inputs.
