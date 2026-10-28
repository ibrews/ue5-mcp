import { Parser } from 'htmlparser2';
import { decodeHTML } from 'entities';
export { blueprintURL } from '../assets/source-input.js';

export function extractHTML(html) {
  let active = false, inTitle = false, title = '', text = '', ueVersion = null;
  const parser = new Parser({
    onopentag(name, attrs) {
      if (name === 'textarea' && ['code_to_copy', 'pastebin_data'].includes(attrs.id)) active = true;
      if (name === 'title') inTitle = true;
      if (name === 'meta' && attrs.name === 'ue-version') ueVersion = attrs.content;
    },
    ontext(s) { if (active) text += s; if (inTitle) title += s; },
    onclosetag(name) { if (name === 'textarea') active = false; if (name === 'title') inTitle = false; },
  }, { decodeEntities: true });
  parser.write(html); parser.end();
  if (!text.trim()) throw new Error('No Blueprint text found on the page. It may be private, expired, blocked, or use a changed page format. Supply the copied text instead.');
  // htmlparser2 treats textarea as raw text; HTML's textarea/RCDATA value still
  // needs exactly one entity decode. Do not recursively decode literal entities.
  return { text: decodeHTML(text), title: title.trim(), ue_version: ueVersion };
}

