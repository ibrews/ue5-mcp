#!/usr/bin/env python3
"""Read-only, opt-in evaluation of an external bp-inspect executable.

This is an evaluation harness, not Blueprint Reader's binary import path.
All paths in the manifest are local; private inputs/output must not be committed.
"""
import argparse
import hashlib
import json
import re
import struct
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def package_metadata(data):
    """Identify the tested layouts; not a replacement Unreal package parser.

    Engine-version records are byte-scanned candidates with FString lengths
    checked, not inferred from project names or .uproject associations.
    """
    if len(data) < 52 or data[:4] != b'\xc1\x83\x2a\x9e':
        return {'error': 'Not a supported package header'}
    legacy = struct.unpack_from('<i', data, 4)[0]
    if legacy not in (-8, -9):
        return {'legacy_version': legacy, 'layout': 'not_inspected'}
    version = struct.unpack_from('<i', data, 16)[0]
    custom_offset = 48 if version >= 1016 else 24  # PACKAGE_SAVED_HASH
    count = struct.unpack_from('<i', data, custom_offset)[0]
    header_offset = 44 if version >= 1016 else 28 + count * 20
    if not 0 <= count <= len(data) // 20 or not 0 <= header_offset <= len(data) - 4:
        return {'legacy_version': legacy, 'error': 'Invalid custom version range'}
    header_size = struct.unpack_from('<i', data, header_offset)[0]
    if not 0 <= header_size <= len(data):
        return {'legacy_version': legacy, 'error': 'Invalid total header size'}
    records = []
    for match in re.finditer(rb'\+\+UE[45][^\x00]{0,100}\x00', data[:min(header_size, 20000)]):
        if match.start() < 14:
            continue
        length = struct.unpack_from('<i', data, match.start() - 4)[0]
        if length != len(match.group()):
            continue
        major, minor, patch, cl = struct.unpack_from('<HHHI', data, match.start() - 14)
        records.append({'version': f'{major}.{minor}.{patch}', 'changelist': cl,
                        'branch': match.group()[:-1].decode(), 'offset': match.start() - 14})
        if len(records) == 2:
            break
    return {'legacy_version': legacy, 'ue5_file_version': version,
            'header_size': header_size, 'custom_version_count': count,
            'custom_version_count_offset': custom_offset,
            'word_at_offset_24': struct.unpack_from('<i', data, 24)[0],
            'engine_version_record_candidates': records}


def execute(argv, directory, name):
    """Capture evidence on disk, never interpret source content as shell code."""
    stdout = directory / f'{name}.stdout'
    stderr = directory / f'{name}.stderr'
    with stdout.open('xb') as out, stderr.open('xb') as err:
        try:
            process = subprocess.run(argv, stdout=out, stderr=err, timeout=30)
            status = process.returncode
        except subprocess.TimeoutExpired:
            status = 'timeout'
    return {'exit': status, 'stdout': str(stdout), 'stderr': str(stderr),
            'stdout_bytes': stdout.stat().st_size,
            'stderr_preview': stderr.read_text(errors='replace')[:2000]}


def read_json(result):
    path = Path(result['stdout'])
    if path.stat().st_size > 64 * 1024 * 1024:
        return None
    try:
        return json.loads(path.read_text())
    except (ValueError, UnicodeError):
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--binary', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--node', default='node')
    args = parser.parse_args()
    cases = json.loads(args.manifest.read_text())['cases']
    ids = [case['id'] for case in cases]
    if not cases or len(ids) != len(set(ids)) or any(
            not re.fullmatch(r'[a-zA-Z0-9_-]+', name) for name in ids):
        parser.error('Cases need unique alphanumeric/dash/underscore IDs.')
    args.out.mkdir(parents=True, exist_ok=False)
    binary = args.binary.resolve(strict=True)
    version = execute([str(binary), '--version'], args.out, 'version')
    reader = Path(__file__).resolve().parents[2] / 'scripts/read-blueprint.mjs'
    report = {'created_at': datetime.now(timezone.utc).isoformat(),
              'binary': str(binary), 'binary_sha256': sha256(binary.read_bytes()),
              'version': Path(version['stdout']).read_text().strip(),
              'reader': str(reader), 'cases': [],
              'warning': 'Successful decoding is not proof of equivalence or runtime correctness.'}
    for case in cases:
        directory = args.out / case['id']
        directory.mkdir()
        path = Path(case['uasset']).resolve(strict=True)
        before = path.read_bytes()
        record = {'id': case['id'], 'uasset': str(path), 'bytes': len(before),
                  'sha256': sha256(before), 'provenance': case.get('provenance'),
                  'package_metadata': package_metadata(before),
                  'bp_inspect': execute([str(binary), '--json', str(path)], directory, 'binary')}
        decoded = read_json(record['bp_inspect'])
        if isinstance(decoded, dict):
            record['bp_inspect'].update(functions=len(decoded.get('functions', [])),
                                        exports=len(decoded.get('exports', [])),
                                        diagnostics=decoded.get('diagnostics', []))
        binary_ok = (record['bp_inspect']['exit'] == 0 and isinstance(decoded, dict)
                     and isinstance(decoded.get('exports'), list) and bool(decoded['exports'])
                     and isinstance(decoded.get('functions'), list) and not decoded.get('diagnostics'))
        record['binary_parse_ok'] = binary_ok
        record['input_unchanged'] = sha256(path.read_bytes()) == record['sha256']
        clipboard = case.get('clipboard')
        if clipboard:
            clipboard = Path(clipboard).resolve(strict=True)
            clip_hash = sha256(clipboard.read_bytes())
            result = execute([args.node, str(reader), str(clipboard), '--format', 'json'],
                             directory, 'clipboard')
            result.update(path=str(clipboard), sha256=clip_hash)
            graph = read_json(result)
            if isinstance(graph, dict) and isinstance(graph.get('graphs'), list):
                result.update(graphs=len(graph['graphs']),
                              nodes=sum(len(g['nodes']) for g in graph['graphs']),
                              warnings=sum(len(g['warnings']) for g in graph['graphs']))
            result['input_unchanged'] = sha256(clipboard.read_bytes()) == clip_hash
            record['clipboard'] = result
            clip_ok = result['exit'] == 0 and 'nodes' in result
            record['comparison'] = ('needs_manual_review' if binary_ok and clip_ok
                                    else 'blocked_by_parse_failure')
        else:
            record['comparison'] = ('missing_clipboard' if binary_ok
                                    else 'blocked_by_binary_parse_failure')
        report['cases'].append(record)
    report['binary_passes'] = sum(row['binary_parse_ok'] for row in report['cases'])
    report['integration_accepted'] = False  # Requires explicit, evidence-based semantic review.
    (args.out / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(args.out / 'report.json'),
                      'binary_passes': report['binary_passes'], 'cases': len(cases),
                      'comparisons': {row['id']: row['comparison'] for row in report['cases']}}, indent=2))
    return 0 if all(row['binary_parse_ok'] and row['input_unchanged']
                    and row['comparison'] == 'needs_manual_review'
                    and row['clipboard']['input_unchanged'] for row in report['cases']) else 2


if __name__ == '__main__':
    raise SystemExit(main())
