import { startApp } from '../assets/app.js';
import { BrowserClient } from './client.mjs';
import { blueprintURL } from '../scripts/source-core.mjs';
import { example } from './example.mjs';

const api = new BrowserClient();
const $ = id => document.getElementById(id);
$('paste-input').before($('link-input'));
startApp(api);
$('open-blueprintue').addEventListener('click', () => {
  try { window.open(blueprintURL($('source-url').value.trim()).href, '_blank', 'noopener,noreferrer'); }
  catch (error) { $('status').textContent = error.message; $('status').classList.add('error'); }
});
$('use-copied-text').addEventListener('click', () => { $('paste-mode').click(); $('source-text').focus(); });
$('try-example').addEventListener('click', () => {
  $('paste-mode').click(); $('source-text').value = example; $('clear-files').click();
  $('ingest-form').requestSubmit();
});
