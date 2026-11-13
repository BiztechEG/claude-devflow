#!/usr/bin/env node
/**
 * Switches the reply language of a project, or the default for new projects.
 *
 *   node set-language.mjs ar-eg [--target <project dir>]   this project: CLAUDE.md block + .project/config.json
 *   node set-language.mjs en --global                      default for new projects (~/.claude/project-starter.json)
 *
 * Files, code and commit messages stay in English either way; this sets the language of
 * Claude's messages, review reports and the board page.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const lang = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--target');
if (!['en', 'ar-eg'].includes(lang ?? '')) { console.error('Usage: node set-language.mjs <en|ar-eg> [--target <dir> | --global]'); process.exit(1); }

if (argv.includes('--global')) {
  const file = join(homedir(), '.claude', 'project-starter.json');
  const cfg = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  cfg.defaultReplyLanguage = lang;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
  console.log(`✔ default reply language for new projects: ${lang} (${file})`);
  process.exit(0);
}

const ti = argv.indexOf('--target');
const target = resolve(ti === -1 ? '.' : argv[ti + 1]);
const cfgFile = join(target, '.project', 'config.json');
const claudeFile = join(target, 'CLAUDE.md');
if (!existsSync(cfgFile)) { console.error(`✕ ${cfgFile} not found: is this a project made with the kit?`); process.exit(1); }

// Check both files before changing either, so CLAUDE.md and the config never disagree on the language.
const cfg = JSON.parse(readFileSync(cfgFile, 'utf8'));
const re = /<!-- lang:[\w-]+ -->[\s\S]*?<!-- \/lang -->/;
const text = existsSync(claudeFile) ? readFileSync(claudeFile, 'utf8') : null;
if (text === null || !re.test(text)) {
  console.error(`✕ ${claudeFile} has no <!-- lang:… --> … <!-- /lang --> block. Put the markers back around its Communication section, then run this again. Nothing was changed.`);
  process.exit(1);
}

const block = readFileSync(join(HERE, '..', 'template', 'lang', `${lang}.md`), 'utf8').trim();
writeFileSync(claudeFile, text.replace(re, block));
cfg.replyLanguage = lang;
writeFileSync(cfgFile, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`✔ CLAUDE.md communication block → ${lang}`);
console.log(`✔ .project/config.json replyLanguage → ${lang} (board page and review reports follow it)`);
