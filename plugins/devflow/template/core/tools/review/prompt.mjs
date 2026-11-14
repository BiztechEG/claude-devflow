#!/usr/bin/env node
// Builds the reviewer prompt of batch N from tools/review/prompt.md, the batch scope
// (docs/reviews/batches/N.txt) and .project/config.json. Prints it to stdout.
//   node tools/review/prompt.mjs 12
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const n = process.argv[2];
if (!/^\d+$/.test(n ?? '')) { console.error('Usage: node tools/review/prompt.mjs <batch number>'); process.exit(1); }

const scopeFile = join(REPO, 'docs', 'reviews', 'batches', `${n}.txt`);
if (!existsSync(scopeFile)) { console.error(`Missing ${scopeFile}: write the batch scope first.`); process.exit(1); }

const cfgFile = join(REPO, '.project', 'config.json');
const cfg = existsSync(cfgFile) ? JSON.parse(readFileSync(cfgFile, 'utf8')) : {};
const lang = cfg.replyLanguage === 'ar-eg' ? 'ar-eg' : 'en';
const modules = cfg.modules ?? [];

const extra = [];
if (modules.includes('regulated')) extra.push('6. Compliance risks for an audited system: records, traceability, signatures, audit trail, validation evidence.');
if (modules.includes('offline-deploy')) extra.push('7. Anything that needs the internet at run time or install time (CDN, online fonts, licence activation, telemetry, auto-update).');

const format = lang === 'ar-eg'
  ? `Write the result in Arabic (Egyptian, plain) with English technical terms, as Markdown:
- Title: '# مراجعة: الدفعة ${n}'
- One table: | # | الخطورة | المكان | الملاحظة | الدليل | الاقتراح |
  - # is RV${n}-01, RV${n}-02, ...; الخطورة is عالية or متوسطة or منخفضة; المكان is file + line or section.
- Order by severity. At most 40 findings; fewer is fine if the work is sound.
- Then a short section '## ما يبدو سليمًا' with at most 5 bullets.`
  : `Write the result in English, as Markdown:
- Title: '# Review: batch ${n}'
- One table: | # | Severity | Where | Finding | Evidence | Suggestion |
  - # is RV${n}-01, RV${n}-02, ...; Severity is high, medium or low; Where is file + line or section.
- Order by severity. At most 40 findings; fewer is fine if the work is sound.
- Then a short section '## Looks sound' with at most 5 bullets.`;

const template = readFileSync(join(HERE, 'prompt.md'), 'utf8');
const values = {
  PROJECT_NAME: cfg.name ?? 'this',
  N: n,
  SCOPE: readFileSync(scopeFile, 'utf8').trim(),
  EXTRA_ANGLES: extra.join('\n'),
  OUTPUT_FORMAT: format,
};
process.stdout.write(template.replace(/\{\{(\w+)\}\}/g, (m, k) => values[k] ?? m));
