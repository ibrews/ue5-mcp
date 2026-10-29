import evidence from './evidence.json';
import { steps, buildPrompt } from './content.mjs';

const $ = id => document.getElementById(id);
const labels = ['Create Widget', 'Set Hired', 'Add to Viewport'];
const nodeIndex = id => evidence.nodes.findIndex(n => n.id === id);
const short = id => labels[nodeIndex(id)];
const prompt = buildPrompt(evidence);
let current = 0;
const wires = document.querySelector('.wires');

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

for (const [index, edge] of evidence.edges.entries()) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('class', `wire ${edge.kind} edge-${index}`);
  wires.append(path);
  const row = element('div', null, 'connection');
  row.dataset.edge = index;
  row.append(element('span', edge.kind.toUpperCase(), 'kind'));
  const endpoints = element('span', null, 'endpoint');
  const from = element('span');
  from.append(element('b', short(edge.from.node)), document.createTextNode('.' + edge.from.name));
  const to = element('span');
  to.append(element('b', short(edge.to.node)), document.createTextNode('.' + edge.to.name));
  endpoints.append(from, element('span', '→', 'arrow'), to);
  row.append(endpoints);
  $('connections').append(row);
}
for (const item of document.querySelectorAll('[data-stat]')) item.textContent = evidence.stats[item.dataset.stat];
$('evidence-count').textContent = evidence.edges.length + ' verified connections';
$('prompt-text').value = prompt;

function drawWires() {
  const diagram = $('diagram').getBoundingClientRect();
  if (!diagram.width || getComputedStyle(wires).display === 'none') return;
  wires.setAttribute('viewBox', `0 0 ${diagram.width} ${diagram.height}`);
  for (const [index, edge] of evidence.edges.entries()) {
    const points = ['from', 'to'].map(end => {
      const pin = document.querySelector(`[data-pin="${edge[end].node}.${edge[end].name}"]`).getBoundingClientRect();
      return { x: pin.left + pin.width / 2 - diagram.left, y: pin.top + pin.height / 2 - diagram.top };
    });
    const [a, b] = points, bend = (b.x - a.x) / 2;
    document.querySelector(`.edge-${index}`).setAttribute('d', `M${a.x} ${a.y} C${a.x + bend} ${a.y},${b.x - bend} ${b.y},${b.x} ${b.y}`);
  }
}
new ResizeObserver(drawWires).observe($('diagram'));

function setStep(index, { focus = false } = {}) {
  current = Math.max(0, Math.min(steps.length - 1, index));
  const step = steps[current];
  $('lesson-index').textContent = `0${current + 1} / 05`;
  $('step-title').textContent = step.title;
  $('step-text').textContent = step.text;
  $('takeaway').textContent = step.takeaway;
  $('progress').textContent = `Step ${current + 1} of 5: ${step.label}`;
  $('previous').disabled = current === 0;
  $('next').replaceChildren(document.createTextNode(current === 4 ? 'Copy prompt' : 'Next'), element('span', current === 4 ? '↗' : '→'));
  for (const button of document.querySelectorAll('[data-step]')) {
    if (Number(button.dataset.step) === current) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  }
  for (const button of document.querySelectorAll('[data-node]')) {
    const active = evidence.nodes[Number(button.dataset.node)].id === step.node;
    button.classList.toggle('active', active);
    button.classList.toggle('muted', Boolean(step.node) && !active);
    button.setAttribute('aria-pressed', String(active));
  }
  for (const [i, edge] of evidence.edges.entries()) {
    const active = !step.node || edge.from.node === step.node || edge.to.node === step.node;
    const row = document.querySelector(`[data-edge="${i}"]`);
    row.classList.toggle('dim', !active);
    row.classList.toggle('focus', Boolean(step.node) && active);
    const wire = document.querySelector(`.edge-${i}`);
    wire?.classList.toggle('dim', !active);
    wire?.classList.toggle('focus', Boolean(step.node) && active);
  }
  const selected = step.node ? evidence.nodes.filter(n => n.id === step.node) : evidence.nodes;
  $('pin-text').textContent = selected.map(node => [
    `${short(node.id)} [${node.id}]`, `Graph: ${evidence.graph.name} [${evidence.graph.id}]`,
    `Source lines: ${node.source_lines.join('–')}`,
    ...node.pins.map(pin => `${pin.direction} ${pin.name} (${pin.type})${pin.default_object ? ` = ${pin.default_object}` : ''}${pin.default_value != null ? ` = ${pin.default_value}` : ''}\n  PinId: ${pin.id}`),
  ].join('\n')).join('\n\n');
  $('step-copy').classList.remove('changed');
  requestAnimationFrame(() => $('step-copy').classList.add('changed'));
  requestAnimationFrame(drawWires);
  if (focus) document.querySelector(`[data-step="${current}"]`).focus();
}

for (const button of document.querySelectorAll('[data-step]')) {
  button.addEventListener('click', () => setStep(Number(button.dataset.step)));
  button.addEventListener('keydown', event => {
    const next = event.key === 'ArrowRight' ? current + 1 : event.key === 'ArrowLeft' ? current - 1 : event.key === 'Home' ? 0 : event.key === 'End' ? 4 : null;
    if (next != null) { event.preventDefault(); setStep(next, { focus: true }); }
  });
}
for (const button of document.querySelectorAll('[data-node]')) button.addEventListener('click', () => setStep(Number(button.dataset.node) + 1));
$('previous').addEventListener('click', () => setStep(current - 1));
$('next').addEventListener('click', () => current < 4 ? setStep(current + 1) : copyPrompt());

function setView(original) {
  $('original').hidden = !original;
  $('diagram').hidden = original;
  $('view-diagram').setAttribute('aria-pressed', String(!original));
  $('view-original').setAttribute('aria-pressed', String(original));
  $('diagram-note').textContent = original
    ? 'The highlighted area contains the same three nodes. Use the readable view to inspect each node and its connections.'
    : 'A readable reconstruction of exported pins. Select a node to inspect it. These connections are static evidence, not a running simulation.';
  if (!original) requestAnimationFrame(drawWires);
}
$('view-diagram').addEventListener('click', () => setView(false));
$('view-original').addEventListener('click', () => setView(true));

async function copyPrompt() {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(prompt);
    $('copy-status').textContent = 'Copied. Paste it into your AI chat when you’re ready.';
    $('copy-prompt').textContent = 'Copied — ready for your chat';
    if (current === 4) $('progress').textContent = 'Evidence and prompt copied';
  } catch {
    $('prompt-text').closest('details').open = true;
    $('prompt-text').focus();
    $('prompt-text').select();
    $('copy-status').textContent = 'Clipboard unavailable. The full prompt is selected below; copy it manually or use Save as text.';
  }
}
$('copy-prompt').addEventListener('click', copyPrompt);
$('save-prompt').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([prompt], { type: 'text/plain;charset=utf-8' }));
  const anchor = element('a');
  anchor.href = url; anchor.download = 'blueprint-reader-guided-prompt.txt';
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('copy-status').textContent = 'Prompt saved as a text file.';
});
setStep(0);
