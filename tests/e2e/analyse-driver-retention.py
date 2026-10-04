"""Trace the observed EdgeDriver timer -> closure -> Promise result retention."""
import argparse
from collections import Counter
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--snapshot', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
r = json.loads(args.snapshot.read_text(encoding='utf-8'))
n, e, strings, meta = r['nodes'], r['edges'], r['strings'], r['snapshot']['meta']
nf, ef = meta['node_fields'], meta['edge_fields']
w, ew = len(nf), len(ef)
nt, et = meta['node_types'][0], meta['edge_types'][0]
ni = {key: nf.index(key) for key in nf}
ei = {key: ef.index(key) for key in ef}
starts, cursor = [], 0
for p in range(0, len(n), w):
    starts.append(cursor)
    cursor += n[p + ni['edge_count']] * ew

def name(p):
    return strings[n[p + ni['name']]]

def edges(p):
    for at in range(starts[p // w], starts[p // w] + n[p + ni['edge_count']] * ew, ew):
        kind = et[e[at + ei['type']]]
        label = str(e[at + ei['name_or_index']]) if kind in ('element', 'hidden') else strings[e[at + ei['name_or_index']]]
        yield label, e[at + ei['to_node']], kind

def named_child(p, wanted):
    return next((child for _, child, kind in edges(p) if kind != 'weak' and name(child) == wanted), None)

def property_child(p, wanted):
    return next((child for label, child, kind in edges(p) if kind != 'weak' and label == wanted), None)

commands, roots, examples = Counter(), [], []
timers = [p for p in range(0, len(n), w) if name(p) == 'DOMTimer']
for timer in timers:
    action = named_child(timer, 'ScheduledAction')
    function = named_child(action, 'V8Function') if action is not None else None
    if function is None:
        continue
    closure = next((child for _, child, kind in edges(function) if kind != 'weak' and nt[n[child]] == 'closure'), None)
    context = property_child(closure, 'context') if closure is not None else None
    if context is None:
        continue
    script = property_child(context, 'script')
    arguments = property_child(context, 'args')
    promise = property_child(context, 'promise')
    if script is None or arguments is None or promise is None or '__TAURI_INTERNALS__.invoke' not in name(script):
        continue
    command = property_child(arguments, '0')
    commands[name(command) if command is not None else 'unknown'] += 1
    result = property_child(promise, 'reactions_or_result')
    if result is not None:
        roots.append(result)
    if len(examples) < 3:
        examples.append({'command': name(command) if command is not None else None, 'chain': ['DOMTimer', 'ScheduledAction', 'V8Function', 'closure', 'context', 'promise'], 'promiseEdges': [label for label, _, _ in edges(promise)]})

# Count unique plain-result graph nodes, excluding prototypes/metadata/weak edges.
visited, stack = set(), roots[:]
while stack:
    p = stack.pop()
    if p in visited:
        continue
    visited.add(p)
    for label, child, kind in edges(p):
        if kind == 'weak' or label in ('__proto__', 'map', 'constructor', 'prototype'):
            continue
        if nt[n[child]] in ('object', 'array', 'string', 'concatenated string', 'sliced string', 'number', 'bigint'):
            stack.append(child)
result = {'domTimerCount': len(timers), 'driverNativeReadTimerCount': sum(commands.values()), 'commands': dict(commands), 'resultRoots': len(roots), 'plainResultGraphNodes': len(visited), 'plainResultGraphSelfMiB': sum(n[p + ni['self_size']] for p in visited) / 1048576, 'examples': examples, 'scope': 'Direct heap edges from driver wrapper timers to resolved native read results. Self-size of this plain-result subgraph is not a formal dominator retained-size calculation.'}
args.output.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
