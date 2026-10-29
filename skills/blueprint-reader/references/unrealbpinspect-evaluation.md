# UnrealBPInspect evaluation — 2026-10-29

**Decision: do not enable binary `.uasset` import yet.** The unmodified
[UnrealBPInspect v1.1.1](https://github.com/MarcedForLife/UnrealBPInspect/releases/tag/v1.1.1)
executable failed on ten of twelve real local assets carrying UE 5.6–5.8
engine-version records. The two successes use an older package layout despite
their 5.6 version label. No asset was modified, no editor was launched, and no
third-party binary or source has been bundled with Blueprint Reader.

## What ran

macOS ARM64 release, verified against GitHub's release SHA-256:
`ba44956a3ce85bd4e3052b21a536c44ac9a0cde392f1de946d5ba5375ea199d2`.
Release source/tag: `f239a655f9194e47e2ee5e19c1c373731d0cefea`.
Each asset was read using `bp-inspect --json <file>`, with a 30-second timeout,
separate stdout/stderr capture, and before/after source SHA-256 checks.
The [sanitized result manifest](evaluations/unrealbpinspect-1.1.1.json) preserves
file hashes, package metadata and outcomes without raw graphs or local paths.

| Assets tested | Saved engine record | UE5 package version | Result |
|---|---|---|---|
| Wobble target | 5.6.0 Release | 1017 | Header failure |
| VR pawn, menu | 5.6.0 Main | 1013 | Decoded; 45 and 15 functions, no diagnostics |
| Disco floor, rocket, MiniMe | 5.7.4 Release | 1018 | All three fail |
| Third-person character | 5.7.3 Release | 1018 | Header failure |
| Swap hands, XR pawn, projectile | 5.8.2 Release | 1018 | All three fail |
| Vehicle pawn, time-trial game mode | 5.8.0 Main / Dev-Release | 1018 | Both fail |
| Four upstream controls | UE4.27 ×2, UE5.3, UE5.5 | Original upstream fixtures | All four decode without diagnostics |

The `.uproject` association was not used to label asset versions: projects can
contain assets saved by several different engine releases. Version records were
located in the package header, their serialized string lengths checked, and
their ordering/layout checked against the installed engine source. The harness
labels these byte-scanned records as candidates rather than claiming a complete
package-summary parser.

## Failure mechanism

All ten failures exit 2, emit no JSON, and report
`invalid custom version count <integer>`. The reported integer equals the four
bytes at file offset 24. In the newer tested layout, that is part of the saved
hash, not the custom-version count. The actual counts at offset 48 are 10–16.

The upstream [`read_package_header`](https://github.com/MarcedForLife/UnrealBPInspect/blob/f239a655f9194e47e2ee5e19c1c373731d0cefea/src/parser.rs#L92)
reads the count immediately after the licensee version. Unreal's
`FPackageFileSummary` serialization, gated by `PACKAGE_SAVED_HASH` (1016), first
writes a 20-byte saved hash and the four-byte total header size. It also moves
the old header-size field. Fixing only the count offset would be insufficient;
the subsequent layout and decoder still need validation. This evaluation did
not patch, re-save, or downgrade assets to make them pass.

## Clipboard comparison: incomplete, explicitly

The existing real camera clipboard control still parses through Blueprint
Reader: **3 graphs, 699 nodes, 2,798 pins, 852 wires and 18 topology warnings**.
Its full JSON and bounded brief were regenerated locally. It is an independent,
unpaired control; it does **not** establish equivalence with any asset above.

For the ten binary failures there is no decoded logic to compare. Matching
editor clipboard exports were not available for the two older-layout successes.
Consequently, **no same-asset semantic parity result is claimed**. Successful
decoding alone does not justify integrating the tool or using pseudocode as an
asset writer. Existing clipboard/BlueprintUE inputs remain the supported path.

## Repeat the evaluation

The opt-in [evaluation harness](../tests/manual/evaluate-uasset.py) accepts a
verified executable and a local manifest. It does not install software, update
Git configuration, upload assets, or alter the reader's production behavior.

```json
{
  "cases": [
    {
      "id": "camera",
      "uasset": "/absolute/path/BP_Camera.uasset",
      "clipboard": "/absolute/path/BP_Camera-clipboard.txt",
      "provenance": {"revision": "record the exact asset/export revision"}
    }
  ]
}
```

Run from the skill directory, using a new output directory each time:

```bash
python3 tests/manual/evaluate-uasset.py \
  --binary /absolute/path/bp-inspect \
  --manifest /absolute/path/private-cases.json \
  --out /absolute/path/private-evaluation
```

Outputs contain private source paths, exports and decoded content: keep them
local. `clipboard` is optional, but its absence is recorded as a missing
comparison. Exit 2 means a parse failed, a comparison input is missing, or an
input changed during testing. Exit 0 means both representations parsed and
need manual review, **not** that they agree. `integration_accepted` stays false.

## Gate before integration

1. Re-test an upstream revision that handles the newer package layout. Retain
   older-format controls and exact file identities.
2. Export the same saved asset revision from Unreal. Include event graphs,
   relevant functions and macros; a node selection is not a whole asset.
3. Compare branches, function calls, defaults, loops, latent continuations and
   missing dependencies. Keep all partial-decoding diagnostics visible. Compare
   behavior and evidence, not node counts against compiled instruction counts.
4. Only then add an optional local adapter with bounded output. Browser support
   is a separate engineering task. Preserve the upstream Apache-2.0 license and
   notices if distributing its code or binary.

The upstream [UE 5.6+ coverage issue](https://github.com/MarcedForLife/UnrealBPInspect/issues/51)
tracks the broader version gap. No issue/comment or private fixture was sent
upstream as part of this evaluation.
