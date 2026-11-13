#!/usr/bin/env node
/**
 * Builds docs/board/board.html, the project board, from the Markdown files that
 * are its single source of truth (see docs/conventions.md):
 *
 *   docs/board/cards/*.md        one file per section (module or work stream) with its cards
 *   docs/board/cards/_phases.md  the phases of docs/plan.md, with their gates
 *   docs/requirements.md         requirement text, type, source and status (card ID = requirement ID)
 *   docs/adr/NNN-*.md            the decisions, one file each (ADR-NNN)
 *   docs/architecture/*.md       the architecture notes
 *   .project/config.json         project name, language, modules, layers
 *
 * The page is self-contained (data inlined, no internet), so it opens straight
 * from disk. It also computes the execution order from dependencies + phase +
 * priority and names the next card to pick up.
 *
 *   node tools/board/build-board.mjs            build once, print the next card
 *   node tools/board/build-board.mjs --watch    rebuild on every change under docs/
 *   node tools/board/build-board.mjs --check    validate only, exit 1 on warnings
 *   node tools/board/build-board.mjs --hook     Claude Code PostToolUse hook (reads the
 *                                               tool JSON on stdin; rebuilds only for board inputs)
 *   node tools/board/build-board.mjs --stop     Claude Code Stop hook (rebuilds; reports
 *                                               warnings or a failure, never blocks)
 *
 * No dependencies: Node 18+ only.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, watch } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, relative, resolve, isAbsolute, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { I18N, LANGUAGES, fill, plural } from './i18n.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const DOCS = join(ROOT, 'docs');
const BOARD_DIR = join(DOCS, 'board');
const CARDS_DIR = join(BOARD_DIR, 'cards');
const OUT = join(BOARD_DIR, 'board.html');
const REQ_FILE = join(DOCS, 'requirements.md');
const ADR_DIR = join(DOCS, 'adr');
const ARCH_DIR = join(DOCS, 'architecture');
const CONFIG_FILE = join(ROOT, '.project', 'config.json');

// ─── Config and language ────────────────────────────────────────────────────

const readRaw = (f) => readFileSync(f, 'utf8').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
// Docs files may be wrapped in <div dir="rtl"> for editor preview; drop those lines.
// HTML comments (examples in the templates) are blanked, keeping their line breaks so line numbers stay right.
const read = (f) => readRaw(f)
  .replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ''))
  .replace(/^[ \t]*<\/?div\b[^>]*>[ \t]*$/gm, '');

// Vocabulary lookups use own keys only, so "constructor" or "toString" is never a valid value.
const has = (obj, key) => obj != null && Object.hasOwn(obj, key);
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

// Never throws: a bad config gives a note (shown as a warning) and the defaults.
function loadConfig() {
  const notes = [];
  let raw = {};
  if (existsSync(CONFIG_FILE)) {
    try {
      const parsed = JSON.parse(readRaw(CONFIG_FILE));
      if (isObject(parsed)) raw = parsed;
      else notes.push(['wConfig', { msg: 'not a JSON object' }]);
    } catch (e) { notes.push(['wConfig', { msg: e.message }]); }
  }
  let lang = String(raw.replyLanguage ?? 'en').toLowerCase();
  if (lang === 'ar') lang = 'ar-eg';
  if (!has(I18N, lang) || !has(LANGUAGES, lang)) { notes.push(['wLanguage', { v: String(raw.replyLanguage) }]); lang = 'en'; }
  const layers = isObject(raw.board) && isObject(raw.board.layers) && Object.keys(raw.board.layers).length ? raw.board.layers : null;
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : basename(ROOT),
    lang,
    modules: new Set(Array.isArray(raw.modules) ? raw.modules.map(String) : []),
    layers,
    notes,
  };
}

const CONFIG = loadConfig();
const L = I18N[CONFIG.lang];
const DIR = LANGUAGES[CONFIG.lang].dir;
const B = (key, params) => fill(L.build[key], params);
const cardsWord = (n) => plural(L.cards, n);
const ARROW = DIR === 'rtl' ? ' ← ' : ' → ';

// ─── Vocabulary ─────────────────────────────────────────────────────────────
// Keys are what the Markdown files use; labels come from the language file.

const ICONS = { 'todo': '○', 'clarify': '…', 'decision': '?', 'in-progress': '◐', 'review': '◑', 'uat': '◕', 'blocked': '✕', 'done': '✓' };
const STATUSES = Object.fromEntries(Object.keys(ICONS).map((k) => [k, { label: L.vocab.statuses[k], icon: ICONS[k] }]));
// Only these can be picked up next. `clarify` waits on the client, `decision`
// on the supervisor, `review`/`uat` on their approval, `blocked` on something else.
const ACTIONABLE = new Set(['todo', 'in-progress']);
// Work that has been handed over no longer holds up the cards that depend on it
// (a phase gate needs `done`; see plan()).
const DELIVERED = new Set(['review', 'uat', 'done']);
const HAS_CLIENT = CONFIG.modules.has('client');
const RISK_REQUIRED = CONFIG.modules.has('regulated');
// Statuses that belong to the client module, and what they mean without it.
const CLIENT_STATUSES = { clarify: 'decision', uat: 'review' };

const PRIORITIES = Object.fromEntries(['P0', 'P1', 'P2', 'P3'].map((k, i) => [k, { label: L.vocab.priorities[k], rank: i }]));
// Layers come from the config, in its order; the order is also the colour slot order on the page.
const LAYERS = Object.fromEntries(Object.entries(CONFIG.layers ?? L.defaultLayers).map(([k, label], i) => [k, { label: String(label), slot: (i % 8) + 1 }]));
const RISKS = L.vocab.risks;
const SIZES = Object.fromEntries(Object.entries({ S: 1, M: 2, L: 3, XL: 5 }).map(([k, w]) => [k, { ...L.vocab.sizes[k], weight: w }]));
const LOG_TYPES = Object.fromEntries(Object.entries(L.vocab.logTypes).map(([k, label]) => [k, { label }]));
// `unknown` only labels an ADR whose status is missing or wrong; it is never a valid value.
const DECISION_STATUSES = Object.fromEntries(Object.entries(L.vocab.decisionStatuses).map(([k, label]) => [k, { label }]));
const isDecisionStatus = (s) => s !== 'unknown' && has(DECISION_STATUSES, s);

// ─── Markdown ───────────────────────────────────────────────────────────────
// A small renderer for the subset the board files use: headings, paragraphs,
// lists (nested, task lists), tables, blockquotes, fences, inline code, bold,
// italic, links, and auto-links to card and decision IDs.

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const slug = (s) => s.trim().toLowerCase()
  .replace(/<[^>]+>/g, '').replace(/[`*_]/g, '')
  .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');

// Card IDs (ORD-08) and decision IDs (ADR-007) share one shape; the known-refs map tells them apart.
const REF_RE = /\b([A-Z][A-Z0-9]{0,5}-\d{2,3})\b/g;
const LIST_RE = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
// A link may be relative, an in-page hash, http(s) or mailto; anything else
// (javascript:, data:, file: …) is shown as plain text. Browsers drop control
// characters and spaces at the start of a URL, so they are ignored here too.
const isSafeUrl = (u) => {
  const s = u.replace(/[\u0000- ]/g, '');
  return !SCHEME_RE.test(s) || /^(https?|mailto):/i.test(s);
};
const tryDecode = (fn, s) => { try { return fn(s); } catch { return s; } };

// Table cells: `\|` is a pipe inside a cell, not a column break.
const cellsOf = (row) => {
  let s = row.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
};
const isFence = (line) => /^\s*```/.test(line);

function makeRenderer(knownRefs) {
  function inline(src) {
    const codes = [];
    let s = src.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
    s = esc(s);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      if (!isSafeUrl(u)) return `<span class="bad-link">${t}</span>`;
      const ext = /^https?:/i.test(u) ? ' target="_blank" rel="noopener"' : '';
      return `<a href="${u}"${ext}>${t}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
    // Auto-link IDs outside of tags only.
    s = s.split(/(<[^>]+>)/).map((part) => (part.startsWith('<') ? part : part.replace(REF_RE, (m, id) => {
      const ref = knownRefs.get(id);
      return ref ? `<a class="ref" href="#/${ref}/${id}" data-ref="${id}">${id}</a>` : m;
    }))).join('');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  }

  function renderList(lines) {
    const base = lines[0].match(/^\s*/)[0].length;
    const items = [];
    for (const l of lines) {
      const m = l.match(LIST_RE);
      if (m && m[1].length <= base) items.push({ ordered: /\d/.test(m[2]), text: m[3], sub: [] });
      else if (items.length) items[items.length - 1].sub.push(l);
    }
    const tag = items[0]?.ordered ? 'ol' : 'ul';
    const html = items.map((it) => {
      let text = it.text;
      let cls = '';
      let box = '';
      const tm = text.match(/^\[( |x|X)\]\s+(.*)$/);
      if (tm) {
        const on = tm[1] !== ' ';
        box = `<span class="chk${on ? ' on' : ''}" aria-hidden="true">${on ? '✓' : ''}</span>`;
        cls = ` class="task-item${on ? ' on' : ''}"`;
        text = tm[2];
      }
      const cont = [];
      const nested = [];
      for (const s of it.sub.filter((x) => x.trim())) {
        if (nested.length || LIST_RE.test(s)) nested.push(s); else cont.push(s.trim());
      }
      return `<li${cls}>${box}<span>${inline([text, ...cont].join(' '))}</span>${nested.length ? renderList(nested) : ''}</li>`;
    }).join('');
    return `<${tag}${tag === 'ul' && html.includes('task-item') ? ' class="tasklist"' : ''}>${html}</${tag}>`;
  }

  const isBlockStart = (l) => /^(#{1,6}\s|```|>|\s*\|)/.test(l) || LIST_RE.test(l) || /^(-{3,}|\*{3,})\s*$/.test(l);

  function render(src, headings = null, idPrefix = '') {
    const lines = src.replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const l = lines[i];
      let m;
      if (/^\s*$/.test(l)) { i++; continue; }

      if (/^```/.test(l)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++;
        out.push(`<pre class="code"><code>${esc(buf.join('\n'))}</code></pre>`);
        continue;
      }

      if ((m = l.match(/^(#{1,6})\s+(.*)$/))) {
        const lv = m[1].length;
        const id = idPrefix + slug(m[2]);
        if (headings) headings.push({ lv, text: m[2].replace(/[`*]/g, ''), id });
        out.push(`<h${lv} id="${id}">${inline(m[2])}</h${lv}>`);
        i++;
        continue;
      }

      if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }

      if (/^\s*\|/.test(l) && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(lines[i++]);
        const head = cellsOf(rows[0]).map((c) => `<th>${inline(c)}</th>`).join('');
        const body = rows.slice(2).map((r) => `<tr>${cellsOf(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
        out.push(`<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
        continue;
      }

      if (/^>\s?/.test(l)) {
        const buf = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
        out.push(`<blockquote>${render(buf.join('\n'))}</blockquote>`);
        continue;
      }

      if (LIST_RE.test(l)) {
        const buf = [];
        while (i < lines.length) {
          const cur = lines[i];
          if (LIST_RE.test(cur) || (/^\s{2,}\S/.test(cur) && buf.length)) { buf.push(cur); i++; continue; }
          if (/^\s*$/.test(cur) && i + 1 < lines.length && (LIST_RE.test(lines[i + 1]) || /^\s{2,}\S/.test(lines[i + 1]))) { i++; continue; }
          break;
        }
        out.push(renderList(buf));
        continue;
      }

      const buf = [l];
      i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) buf.push(lines[i++]);
      out.push(`<p>${inline(buf.join(' '))}</p>`);
    }
    return out.join('\n');
  }

  return { render, inline };
}

const stripHtml = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

// ─── Parsing ────────────────────────────────────────────────────────────────

const archAnchor = (file) => `arch-${slug(basename(file, '.md'))}`;
const ADR_FILE_RE = /^(\d{3})-.+\.md$/;
const isAdrFile = (name) => ADR_FILE_RE.test(name) && name !== '000-template.md';

// Links in the docs files are relative to their own folder. On the page they
// must be relative to docs/board/; links to architecture files become in-page
// links to the Architecture tab, and links to ADR files open the decision.
function fixLinks(md, fromFile) {
  const fromDir = dirname(fromFile);
  return md.replace(/\]\(([^)\s]+)\)/g, (all, url) => {
    // Any URL with a scheme is left as written; the renderer drops unsafe ones.
    if (SCHEME_RE.test(url)) return all;
    const [path, hash = ''] = url.split('#');
    // A bad %-sequence (e.g. "100%.md") is taken literally instead of failing the build.
    const target = path ? resolve(fromDir, tryDecode(decodeURI, path)) : fromFile;
    if (dirname(target) === ARCH_DIR && target.endsWith('.md')) {
      return `](#/architecture/${archAnchor(target)}${hash ? '-' + slug(tryDecode(decodeURIComponent, hash)) : ''})`;
    }
    const adr = basename(target).match(ADR_FILE_RE);
    if (dirname(target) === ADR_DIR && adr && isAdrFile(basename(target))) return `](#/decision/ADR-${adr[1]})`;
    if (!path) return all;
    let rel = relative(BOARD_DIR, target).replace(/\\/g, '/');
    // A path such as "javascript:x" would read as a scheme on the page; "./" keeps it relative.
    if (SCHEME_RE.test(rel)) rel = './' + rel;
    return `](${encodeURI(rel)}${hash ? '#' + hash : ''})`;
  });
}

function frontmatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return [{}, src, 0];
  const meta = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (mm) meta[mm[1]] = mm[2].trim();
  }
  return [meta, src.slice(m[0].length), m[0].split('\n').length - 1];
}

// Keys a card's meta line may hold; anything else (a typo such as "depend") is warned.
const CARD_KEYS = new Set(['status', 'priority', 'layer', 'layers', 'depends', 'size', 'phase', 'risk', 'q']);

// "> status: todo | priority: P1 | layer: core, ui"
function metaLine(line) {
  const meta = {};
  for (const part of line.replace(/^>\s*/, '').split('|')) {
    const m = part.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (m) meta[m[1].toLowerCase()] = m[2];
  }
  return meta;
}

const list = (v) => (v ?? '').split(/[,،]/).map((x) => x.trim()).filter((x) => x && x !== '-' && x !== '—');

const ID_RE = /^[A-Z][A-Z0-9]{0,5}-\d{2,3}$/;
const HEADING_RE = /^##\s+([A-Z][A-Z0-9]{0,5}-\d{2,3})\s*[·:|—–-]\s*(.+?)\s*$/;
const PHASE_RE = /^##\s+(\d{1,2})\s*[·:|—–-]\s*(.+?)\s*$/;
const LOG_HEAD_RE = /^#{3,4}\s+(Log|السجل)\s*$/;
const LOG_RE = /^-\s+(\d{4}-\d{2}-\d{2})(?:\s+\[([a-z-]+)\])?\s*(.*)$/;

// Splits a file into its intro and its `## ID · title` blocks. Headings inside
// code fences are examples, not cards.
function splitBlocks(body, lineOffset, headingRe = HEADING_RE) {
  const lines = body.split('\n');
  const intro = [];
  const blocks = [];
  let cur = null;
  let fence = false;
  lines.forEach((line, idx) => {
    if (isFence(line)) fence = !fence;
    const m = fence ? null : line.match(headingRe);
    if (m) {
      cur = { id: m[1], title: m[2], line: idx + 1 + lineOffset, lines: [] };
      blocks.push(cur);
    } else if (cur) cur.lines.push(line);
    else intro.push(line);
  });
  return { intro: intro.join('\n').trim(), blocks };
}

// Pulls the meta line and the log out of a block; the rest is the body.
// block.lines[k] is file line block.line + 1 + k, kept for warnings.
function splitBlock(block) {
  const lines = block.lines;
  const lineOf = (k) => block.line + 1 + k;
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  let meta = {};
  let metaAt = block.line;
  if (i < lines.length && /^>\s*[\w-]+\s*:/.test(lines[i])) { meta = metaLine(lines[i]); metaAt = lineOf(i); i++; }
  let logAt = -1;
  let fence = false;
  for (let k = i; k < lines.length; k++) {
    if (isFence(lines[k])) fence = !fence;
    else if (!fence && LOG_HEAD_RE.test(lines[k])) { logAt = k; break; }
  }
  const bodyLines = lines.slice(i, logAt === -1 ? lines.length : logAt);
  const log = [];
  if (logAt !== -1) {
    for (let k = logAt + 1; k < lines.length; k++) {
      const l = lines[k];
      const m = l.match(LOG_RE);
      if (m) log.push({ date: m[1], type: m[2] || 'note', text: m[3] || (m[2] === 'created' ? L.build.createdText : ''), line: lineOf(k) });
      else if (/^\s{2,}\S/.test(l) && log.length) log[log.length - 1].text += ' ' + l.trim();
    }
  }
  return { meta, metaAt, body: bodyLines.join('\n').trim(), log };
}

// docs/requirements.md: every table row whose first cell is a requirement ID,
// grouped under the `## PREFIX · Module` heading above it.
function loadRequirements(warn) {
  const reqs = new Map();
  if (!existsSync(REQ_FILE)) return reqs;
  let group = '';
  read(REQ_FILE).split('\n').forEach((line, idx) => {
    const h = line.match(/^#{2,3}\s+(.*)$/);
    if (h) group = h[1].replace(/[`*]/g, '').trim();
    if (!/^\|/.test(line)) return;
    const [id, text = '', type = '', source = '', status = ''] = cellsOf(line);
    if (!ID_RE.test(id)) return;
    if (reqs.has(id)) { warn('docs/requirements.md', idx + 1, B('wDupReq', { id, first: reqs.get(id).line })); return; }
    reqs.set(id, { id, textMd: fixLinks(text, REQ_FILE), type: type.toLowerCase(), source, status: status.toLowerCase(), group, line: idx + 1 });
  });
  return reqs;
}

// docs/adr/NNN-slug.md: "# ADR-007: Title", then "- Status: …", "- Date: …", "- Cards: …", then the body.
function loadDecisions(warn) {
  const decisions = [];
  let intro = '';
  if (!existsSync(ADR_DIR)) return { decisions, intro };
  const readme = join(ADR_DIR, 'README.md');
  if (existsSync(readme)) intro = read(readme).split('\n').filter((l) => /^>/.test(l)).join('\n');
  for (const name of readdirSync(ADR_DIR).filter(isAdrFile).sort()) {
    const full = join(ADR_DIR, name);
    const rel = relative(ROOT, full).replace(/\\/g, '/');
    const lines = read(full).split('\n');
    const ti = lines.findIndex((l) => /^#\s+/.test(l));
    const tm = ti === -1 ? null : lines[ti].match(/^#\s+(ADR-\d{3})\s*[·:|—–-]\s*(.+?)\s*$/);
    if (!tm) { warn(rel, ti + 1, B('wAdrTitle')); continue; }
    const id = tm[1];
    if (id.slice(4) !== name.slice(0, 3)) warn(rel, ti + 1, B('wAdrNumber', { id }));
    if (decisions.some((d) => d.id === id)) { warn(rel, ti + 1, B('wDup', { id })); continue; }
    const fields = {};
    const fieldLine = {};
    let k = ti + 1;
    for (; k < lines.length; k++) {
      const l = lines[k];
      if (!l.trim()) { if (Object.keys(fields).length) break; continue; }
      const fm = l.match(/^[-*]\s+([A-Za-z]+)\s*:\s*(.*?)\s*$/);
      if (!fm) break;
      fields[fm[1].toLowerCase()] = fm[2];
      fieldLine[fm[1].toLowerCase()] = k + 1;
    }
    // A missing or wrong status is shown as unknown, never as accepted.
    const rawStatus = (fields.status ?? '').trim();
    let status = rawStatus.toLowerCase();
    let supersededBy = null;
    const sm = rawStatus.match(/^superseded\s+by\s+(ADR-\d{3})/i);
    if (sm) { status = 'superseded'; supersededBy = sm[1].toUpperCase(); }
    if (!rawStatus) { warn(rel, ti + 1, B('wAdrNoStatus', { id })); status = 'unknown'; }
    else if (!isDecisionStatus(status)) { warn(rel, fieldLine.status, B('wAdrStatus', { id, v: rawStatus })); status = 'unknown'; }
    // Section headings inside an ADR sit under the decision title on the page.
    const body = lines.slice(k).join('\n').trim().replace(/^(#{1,4})\s/gm, (_, h) => '#'.repeat(Math.min(h.length + 2, 6)) + ' ');
    decisions.push({
      id, title: tm[2], date: fields.date ?? '', status, supersededBy, cards: list(fields.cards),
      bodyMd: fixLinks(body, full), file: rel, line: ti + 1, cardsLine: fieldLine.cards ?? ti + 1,
    });
  }
  return { decisions, intro: fixLinks(intro, readme) };
}

// Architecture files in the order of architecture/README.md, then any others.
function loadArchitecture() {
  if (!existsSync(ARCH_DIR)) return [];
  const readme = join(ARCH_DIR, 'README.md');
  const names = [];
  if (existsSync(readme)) {
    for (const m of read(readme).matchAll(/\]\(([^)#\s]+\.md)\)/g)) {
      const f = resolve(ARCH_DIR, m[1]);
      if (dirname(f) === ARCH_DIR && existsSync(f) && !names.includes(f)) names.push(f);
    }
  }
  for (const f of readdirSync(ARCH_DIR).filter((x) => x.endsWith('.md') && x !== 'README.md').sort()) {
    const full = join(ARCH_DIR, f);
    if (!names.includes(full)) names.push(full);
  }
  const files = existsSync(readme) ? [readme, ...names] : names;
  return files.map((f) => {
    const md = fixLinks(read(f), f);
    const h1 = md.match(/^#\s+(.+)$/m);
    return { file: f, id: archAnchor(f), title: f === readme ? L.build.archReadme : (h1 ? h1[1].trim() : basename(f)), md };
  });
}

function load() {
  const warnings = [];
  const warn = (file, line, msg) => warnings.push(`${file}${line ? ':' + line : ''} — ${msg}`);
  for (const [key, params] of CONFIG.notes) warn('.project/config.json', 0, B(key, params));

  if (!existsSync(CARDS_DIR)) throw new Error(`Missing ${CARDS_DIR}`);
  const relRoot = (f) => relative(ROOT, f).replace(/\\/g, '/');

  // Phases.
  const phases = [];
  const phasesFile = join(CARDS_DIR, '_phases.md');
  let phasesIntro = '';
  if (existsSync(phasesFile)) {
    const [, body, off] = frontmatter(read(phasesFile));
    const { intro, blocks } = splitBlocks(body, off, PHASE_RE);
    phasesIntro = fixLinks(intro, phasesFile);
    for (const b of blocks) {
      if (phases.some((p) => p.id === b.id)) { warn(relRoot(phasesFile), b.line, B('wDup', { id: b.id })); continue; }
      const { meta, body: text } = splitBlock(b);
      phases.push({ id: b.id, title: b.title, order: phases.length, goal: meta.goal ?? '', gate: list(meta.gate), bodyMd: fixLinks(text, phasesFile) });
    }
  }
  const phaseIndex = new Map(phases.map((p, i) => [p.id, i]));

  // Sections and cards.
  const reqs = loadRequirements(warn);
  const sections = [];
  const tasks = [];
  const files = readdirSync(CARDS_DIR).filter((f) => f.endsWith('.md') && !f.startsWith('_')).sort();
  for (const f of files) {
    const full = join(CARDS_DIR, f);
    const rel = relRoot(full);
    const [fm, body, off] = frontmatter(read(full));
    if (!fm.id) { warn(rel, 1, B('wNoId')); continue; }
    // The section ID goes into the page's HTML and links, so only the documented shape is accepted.
    if (!/^[A-Z][A-Z0-9]{0,5}$/.test(fm.id)) { warn(rel, 1, B('wSectionId', { v: fm.id })); continue; }
    if (sections.some((s) => s.id === fm.id)) { warn(rel, 1, B('wDup', { id: fm.id })); continue; }
    const { intro, blocks } = splitBlocks(body, off);
    const kind = fm.kind === 'requirements' ? 'requirements' : 'work';
    sections.push({
      id: fm.id, title: fm.title ?? fm.id, order: Number(fm.order ?? 99), kind,
      descMd: fixLinks([fm.description ?? '', intro].filter(Boolean).join('\n\n'), full), file: rel,
    });
    for (const b of blocks) {
      const { meta, metaAt: ml, body: text, log } = splitBlock(b);
      const t = {
        id: b.id, title: b.title, section: fm.id, file: rel, line: b.line,
        status: meta.status ?? 'todo',
        priority: (meta.priority ?? 'P2').toUpperCase(),
        layers: list(meta.layer ?? meta.layers),
        depends: list(meta.depends),
        size: (meta.size ?? 'M').toUpperCase(),
        phase: meta.phase ?? '',
        risk: (meta.risk ?? '').toLowerCase(),
        questions: list(meta.q),
        bodyMd: fixLinks(text, full),
        log: log.map((e) => ({ ...e, text: fixLinks(e.text, full) })),
        req: reqs.get(b.id) ?? null,
      };
      const id = b.id;
      if (!id.startsWith(fm.id + '-')) warn(rel, b.line, B('wPrefix', { id, prefix: fm.id }));
      if (kind === 'requirements' && !t.req) warn(rel, b.line, B('wReqMissing', { id }));
      if (!has(STATUSES, t.status)) { warn(rel, ml, B('wStatus', { id, v: t.status })); t.status = 'todo'; }
      if (!HAS_CLIENT && has(CLIENT_STATUSES, t.status)) {
        const as = CLIENT_STATUSES[t.status];
        warn(rel, ml, B('wStatusModule', { id, v: t.status, as }));
        t.status = as;
      }
      for (const k of Object.keys(meta)) if (!CARD_KEYS.has(k)) warn(rel, ml, B('wMetaKey', { id, v: k }));
      if (t.status === 'clarify' && !t.questions.length) warn(rel, ml, B('wClarifyQ', { id }));
      if (!has(PRIORITIES, t.priority)) { warn(rel, ml, B('wPriority', { id, v: t.priority })); t.priority = 'P2'; }
      if (!has(SIZES, t.size)) { warn(rel, ml, B('wSize', { id, v: t.size })); t.size = 'M'; }
      if (t.risk && !has(RISKS, t.risk)) { warn(rel, ml, B('wRisk', { id, v: t.risk })); t.risk = ''; }
      if (RISK_REQUIRED && kind === 'requirements' && !t.risk) warn(rel, ml, B('wRiskMissing', { id }));
      if (!t.layers.length) warn(rel, ml, B('wNoLayer', { id }));
      t.layers = t.layers.filter((l) => has(LAYERS, l) || (warn(rel, ml, B('wLayer', { id, v: l, allowed: Object.keys(LAYERS).join(', ') })), false));
      if (phases.length && !phaseIndex.has(t.phase)) warn(rel, ml, B('wPhase', { id, v: t.phase }));
      for (const e of t.log) if (!has(LOG_TYPES, e.type)) { warn(rel, e.line, B('wLogType', { id, v: e.type })); e.type = 'note'; }
      t.metaLine = ml;
      tasks.push(t);
    }
  }
  sections.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  // Every requirement that is not dropped needs a card in its module section.
  const reqSections = new Set(sections.filter((s) => s.kind === 'requirements').map((s) => s.id));
  const cardIds = new Set(tasks.map((t) => t.id));
  for (const r of reqs.values()) {
    if (r.status === 'dropped') continue;
    const prefix = r.id.split('-')[0];
    if (!reqSections.has(prefix)) warn('docs/requirements.md', r.line, B('wNoSection', { id: r.id, prefix }));
    else if (!cardIds.has(r.id)) warn('docs/requirements.md', r.line, B('wNoCard', { id: r.id }));
  }

  const { decisions, intro: decisionsIntro } = loadDecisions(warn);
  const architecture = loadArchitecture();

  return { phases, phasesIntro, sections, tasks, reqs, decisions, decisionsIntro, architecture, warnings, warn, phaseIndex };
}

// ─── Planning ───────────────────────────────────────────────────────────────

function plan(model) {
  const { tasks, phases, sections, decisions, warn, phaseIndex } = model;
  const byId = new Map();
  for (const t of tasks) {
    if (byId.has(t.id)) warn(t.file, t.line, B('wDup', { id: t.id }));
    byId.set(t.id, t);
  }
  const secOrder = new Map(sections.map((s, i) => [s.id, i]));

  // A phase gate (e.g. the client's signature on the screens) is an implicit
  // dependency of every card in that phase.
  // A gate is recorded as such even when the card also lists it in depends.
  const phaseById = new Map(phases.map((p) => [p.id, p]));
  for (const t of tasks) {
    t.gated = [];
    for (const g of phaseById.get(t.phase)?.gate ?? []) {
      if (g === t.id) continue;
      t.gated.push(g);
      if (!t.depends.includes(g)) t.depends.push(g);
    }
  }

  // A dependency that does not exist still holds the card (a typo must not make it ready).
  for (const t of tasks) {
    t.missing = t.depends.filter((d) => !byId.has(d));
    for (const d of t.missing) warn(t.file, t.metaLine, B('wDepMissing', { id: t.id, dep: d }));
    t.depends = t.depends.filter((d) => byId.has(d));
    t.dependents = [];
  }
  for (const t of tasks) for (const d of t.depends) byId.get(d).dependents.push(t.id);

  // A gate opens its phase only when done; review or uat is not enough.
  const gateIds = new Set(phases.flatMap((p) => p.gate));
  const delivered = (d) => (gateIds.has(d) ? byId.get(d).status === 'done' : DELIVERED.has(byId.get(d).status));

  for (const t of tasks) {
    const pi = phaseIndex.get(t.phase) ?? 99;
    for (const d of t.depends) {
      const dep = byId.get(d);
      if ((phaseIndex.get(dep.phase) ?? 99) > pi) warn(t.file, t.metaLine, B('wDepLater', { id: t.id, phase: t.phase, dep: d, depPhase: dep.phase }));
      if (t.status === 'done' && !delivered(d)) warn(t.file, t.metaLine, B('wDoneDep', { id: t.id, dep: d }));
    }
  }
  for (const t of tasks) t.delivered = delivered(t.id);

  // Decisions ↔ cards: an ADR's Cards line, any card it names, and any ADR a card names.
  const decIds = new Set(decisions.map((d) => d.id));
  const refsIn = (s) => [...s.matchAll(REF_RE)].map((m) => m[1]);
  for (const d of decisions) {
    for (const c of d.cards) if (!byId.has(c)) warn(d.file, d.cardsLine, B('wAdrCard', { id: d.id, card: c }));
    if (d.supersededBy && !decIds.has(d.supersededBy)) warn(d.file, d.line, B('wAdrSupersededBy', { id: d.id, by: d.supersededBy }));
    d.tasks = [...new Set([...d.cards, ...refsIn(d.bodyMd)].filter((id) => byId.has(id)))];
  }
  for (const t of tasks) {
    const own = refsIn([t.bodyMd, ...t.log.map((e) => e.text)].join(' ')).filter((id) => decIds.has(id));
    const named = decisions.filter((d) => d.tasks.includes(t.id)).map((d) => d.id);
    t.decisions = [...new Set([...own, ...named])].sort();
  }

  // Transitive "unlocks": how many cards are waiting, directly or not, on this one.
  // `path` only stops cycles; every node gets its full reachable set, so a card
  // reached through two branches still counts for both.
  const memo = new Map();
  const reach = (id, path = new Set()) => {
    if (memo.has(id)) return memo.get(id);
    path.add(id);
    const acc = new Set();
    for (const c of byId.get(id).dependents) {
      if (path.has(c)) continue;
      acc.add(c);
      for (const x of reach(c, path)) acc.add(x);
    }
    path.delete(id);
    acc.delete(id);
    memo.set(id, acc);
    return acc;
  };
  for (const t of tasks) t.unlocks = reach(t.id).size;

  // Execution order: Kahn's algorithm, always taking the available card with
  // the earliest phase, then the highest priority, then the one that unblocks
  // the most, then section order, then ID.
  const key = (t) => [
    phaseIndex.get(t.phase) ?? 99,
    PRIORITIES[t.priority].rank,
    -t.unlocks,
    secOrder.get(t.section) ?? 99,
    Number(t.id.split('-')[1]),
  ];
  const cmp = (a, b) => { const ka = key(a); const kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i]; return 0; };
  const indeg = new Map(tasks.map((t) => [t.id, t.depends.length]));
  const avail = tasks.filter((t) => !t.depends.length);
  const order = [];
  while (avail.length) {
    avail.sort(cmp);
    const t = avail.shift();
    order.push(t.id);
    for (const c of t.dependents) {
      indeg.set(c, indeg.get(c) - 1);
      if (indeg.get(c) === 0) avail.push(byId.get(c));
    }
  }
  if (order.length < tasks.length) {
    const stuck = tasks.filter((t) => !order.includes(t.id));
    warn('board', 0, B('wCycle', { ids: stuck.map((t) => t.id).join(', ') }));
    order.push(...stuck.sort(cmp).map((t) => t.id));
  }
  order.forEach((id, i) => { byId.get(id).seq = i + 1; });

  for (const t of tasks) {
    t.waitingOn = [...t.missing, ...t.depends.filter((d) => !delivered(d))];
    t.ready = ACTIONABLE.has(t.status) && t.waitingOn.length === 0;
  }

  // The queue simulates working down the order: a card joins once everything it
  // depends on is delivered or already ahead of it in the queue. So it shows what
  // comes after the next card, not merely what happens to be ready right now.
  // Cards behind the client or the supervisor never join until they answer.
  const current = order.filter((id) => byId.get(id).status === 'in-progress');
  const settled = new Set(tasks.filter((t) => delivered(t.id)).map((t) => t.id));
  const upcoming = [];
  for (const id of order) {
    const t = byId.get(id);
    if (!ACTIONABLE.has(t.status) || t.missing.length || !t.depends.every((d) => settled.has(d))) continue;
    settled.add(id);
    if (t.status !== 'in-progress') upcoming.push(id);
  }
  const next = upcoming.find((id) => byId.get(id).ready) ?? null;
  const queue = next ? [next, ...upcoming.filter((id) => id !== next)] : upcoming;
  return { order, current, next, queue: queue.slice(0, 6), byId };
}

// ─── Build ──────────────────────────────────────────────────────────────────

function build({ write = true } = {}) {
  const model = load();
  const p = plan(model);
  const refs = new Map([
    ...model.tasks.map((t) => [t.id, 'task']),
    ...model.decisions.map((d) => [d.id, 'decision']),
  ]);
  const { render } = makeRenderer(refs);

  const archToc = [];
  const archFiles = model.architecture.map((a) => {
    const heads = [];
    const html = render(a.md, heads, `${a.id}-`);
    archToc.push({ lv: 1, text: a.title, id: a.id });
    for (const h of heads) if (h.lv === 2) archToc.push({ lv: 2, text: h.text, id: h.id });
    return { id: a.id, html };
  });

  // All three requirement counts leave dropped requirements out.
  const liveReqs = [...model.reqs.values()].filter((r) => r.status !== 'dropped');
  const liveReqCards = model.tasks.filter((t) => t.req && t.req.status !== 'dropped');
  const data = {
    project: CONFIG.name,
    lang: CONFIG.lang,
    dir: DIR,
    modules: [...CONFIG.modules],
    builtAt: new Date().toISOString(),
    t: { ...L.page, locale: L.locale, sep: L.sep, cards: L.cards },
    vocab: {
      statuses: STATUSES, priorities: PRIORITIES, layers: LAYERS, sizes: SIZES, risks: RISKS, logTypes: LOG_TYPES,
      decisionStatuses: DECISION_STATUSES, reqTypes: L.vocab.reqTypes, reqStatuses: L.vocab.reqStatuses,
    },
    phasesHtml: render(model.phasesIntro),
    phases: model.phases.map((ph) => ({ id: ph.id, title: ph.title, goal: ph.goal, gate: ph.gate, html: render(ph.bodyMd) })),
    sections: model.sections.map((s) => ({ id: s.id, title: s.title, kind: s.kind, file: s.file, html: render(s.descMd) })),
    tasks: model.tasks.map((t) => {
      const html = render(t.bodyMd);
      const reqHtml = t.req ? render(t.req.textMd) : '';
      const checks = [...t.bodyMd.matchAll(/^\s*[-*+]\s+\[( |x|X)\]/gm)];
      return {
        id: t.id, title: t.title, section: t.section, status: t.status, priority: t.priority,
        layers: t.layers, depends: t.depends, gated: t.gated, dependents: t.dependents, size: t.size, phase: t.phase, risk: t.risk,
        questions: t.questions, decisions: t.decisions,
        seq: t.seq, ready: t.ready, waitingOn: t.waitingOn, unlocks: t.unlocks, delivered: t.delivered,
        file: t.file, line: t.line, html,
        req: t.req ? { html: reqHtml, type: t.req.type, source: t.req.source, status: t.req.status, group: t.req.group } : null,
        checks: { done: checks.filter((c) => c[1] !== ' ').length, total: checks.length },
        log: t.log.map((e) => ({ date: e.date, type: e.type, html: render(e.text).replace(/^<p>|<\/p>$/g, '') })),
        text: `${t.id} ${t.title} ${stripHtml(html)} ${stripHtml(reqHtml)} ${t.questions.join(' ')}`.toLowerCase(),
      };
    }),
    requirements: { total: liveReqs.length, carded: liveReqCards.length, done: liveReqCards.filter((t) => t.status === 'done').length },
    order: p.order, current: p.current, next: p.next, queue: p.queue,
    decisionsHtml: render(model.decisionsIntro),
    decisions: model.decisions.map((d) => ({ id: d.id, title: d.title, date: d.date, status: d.status, supersededBy: d.supersededBy, tasks: d.tasks, file: d.file, html: render(d.bodyMd) })),
    architecture: { files: archFiles, toc: archToc },
    warnings: model.warnings,
  };

  if (write) {
    const css = readRaw(join(HERE, 'board.css'));
    const js = readRaw(join(HERE, 'board-client.js'));
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    writeFileSync(OUT, page({ css, js, json }), 'utf8');
  }
  return { data, model, p };
}

function page({ css, js, json }) {
  return `<!doctype html>
<html lang="${LANGUAGES[CONFIG.lang].htmlLang}" dir="${DIR}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(B('pageTitle', { project: CONFIG.name }))}</title>
<style>
${css}
</style>
</head>
<body>
<!-- Generated by tools/board/build-board.mjs — do not edit; edit docs/board/cards/*.md and rebuild. -->
<div id="app" class="app"></div>
<div id="tip" class="tip" role="tooltip" hidden></div>
<script id="board-data" type="application/json">${json}</script>
<script>
${js}
</script>
</body>
</html>
`;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function report({ data, p }, { wrote = true } = {}) {
  const ts = data.tasks;
  const w = (t) => SIZES[t.size].weight;
  const total = ts.reduce((a, t) => a + w(t), 0);
  const doneW = ts.filter((t) => t.status === 'done').reduce((a, t) => a + w(t), 0);
  const pct = total ? Math.round((doneW / total) * 100) : 0;
  const by = (s) => ts.filter((t) => t.status === s).length;
  const line = (id) => { const t = p.byId.get(id); return B('rLine', { id: t.id, title: t.title, priority: t.priority, layers: t.layers.join('+'), phase: t.phase }); };
  const st = (s) => `${STATUSES[s].label} ${by(s)}`;

  console.log(wrote ? B('rWrote', { path: relative(process.cwd(), OUT) || OUT }) : B('rCheckOnly'));
  const parts = [
    B('rCards', { cards: cardsWord(ts.length), sections: data.sections.length }),
    B('rDone', { n: by('done'), pct }),
    st('in-progress'), st('review'),
    ...(HAS_CLIENT ? [st('uat'), st('clarify')] : []),
    st('decision'), st('blocked'),
  ];
  console.log(`  ${parts.join(' · ')}`);
  if (data.requirements.total) console.log(`  ${B('rRequirements', data.requirements)}`);
  if (p.current.length) console.log(B('rCurrent') + p.current.map(line).join('\n    '));
  console.log(p.next ? B('rNext', { line: line(p.next) }) : B('rNone'));
  if (p.queue.length > 1) console.log(B('rAfter', { list: p.queue.slice(1).join(ARROW) }));
  const pending = ts.filter((t) => t.status === 'decision');
  if (pending.length) console.log(B('rDecision', { list: pending.map((t) => t.id).join(', ') }));
  if (data.warnings.length) {
    console.log(B('rWarnings', { n: data.warnings.length }));
    for (const x of data.warnings) console.log(`  - ${x}`);
  }
}

// Inputs of the board: anything under docs/ (but the page itself), the board tool, and the config.
function isBoardInput(file) {
  const abs = resolve(file);
  // relative() compares Windows paths without case, so "f:\" and "F:\" match.
  const same = (a, b) => relative(a, b) === '';
  if (same(abs, OUT)) return false;
  if (same(abs, CONFIG_FILE)) return true;
  for (const base of [DOCS, HERE]) {
    const rel = relative(base, abs);
    if (rel && !rel.startsWith('..') && !isAbsolute(rel) && /\.(md|css|js|mjs)$/.test(rel)) return true;
  }
  return false;
}

// PostToolUse hook: silent when the edited file is not a board input or the build
// is clean; warnings go back to Claude as context; a crash exits 2 so Claude sees it.
async function hook() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  let file = '';
  try {
    const payload = JSON.parse(input);
    file = payload.tool_input?.file_path ?? payload.tool_response?.filePath ?? '';
  } catch {
    return;
  }
  if (!file || !isBoardInput(file)) return;
  try {
    const { data } = build();
    if (data.warnings.length) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: `${B('rHook', { n: data.warnings.length })}\n- ${data.warnings.join('\n- ')}`,
        },
      }));
    }
  } catch (e) {
    process.stderr.write(B('rHookFail', { file: relative(ROOT, resolve(file)), msg: e.message }) + '\n');
    process.exit(2);
  }
}

// Stop hook: rebuilds in case a file changed outside Write/Edit (a shell command).
// Silent when clean; warnings or a failure reach the user as a systemMessage.
// It never blocks the stop, so it always exits 0.
function stopHook() {
  let msg = '';
  try {
    const { data } = build();
    const n = data.warnings.length;
    if (n) msg = `${B('rStop', { n })}\n- ${data.warnings.slice(0, 5).join('\n- ')}${n > 5 ? '\n- …' : ''}`;
  } catch (e) {
    msg = B('rStopFail', { msg: e.message });
  }
  if (msg) process.stdout.write(JSON.stringify({ systemMessage: msg }));
}

const args = new Set(process.argv.slice(2));
if (args.has('--hook')) {
  await hook();
} else if (args.has('--stop')) {
  stopHook();
} else if (args.has('--check')) {
  const r = build({ write: false });
  report(r, { wrote: false });
  process.exit(r.data.warnings.length ? 1 : 0);
} else {
  report(build());
  if (args.has('--watch')) {
    console.log(B('rWatch'));
    let timer = null;
    // Each rebuild runs in a new process, so changes to the config (language,
    // modules, layers) and to the board tool itself are picked up too.
    const rebuild = () => spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { stdio: 'inherit' });
    const onChange = (base) => (_, file) => {
      if (!file || !isBoardInput(join(base, file))) return;
      clearTimeout(timer);
      timer = setTimeout(rebuild, 150);
    };
    watch(DOCS, { recursive: true }, onChange(DOCS));
    watch(HERE, onChange(HERE));
    if (existsSync(dirname(CONFIG_FILE))) watch(dirname(CONFIG_FILE), onChange(dirname(CONFIG_FILE)));
  }
}
