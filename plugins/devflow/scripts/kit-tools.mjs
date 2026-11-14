/**
 * The kit's own tools in a project (tools/board, tools/checks, tools/review), shared by scaffold.mjs and update.mjs.
 * A project records the kit version and a hash of each tool file as the kit wrote it in .project/kit.json,
 * so an update can tell a file the project changed from one it only has in an older version.
 * Node 18+, no packages.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const PLUGIN = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TOOLS_ROOT = join(PLUGIN, 'template', 'core');
export const KIT_VERSION = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8')).version;
export const KIT_FILE = '.project/kit.json';

// Line endings do not count: Git may check a file out with CRLF on Windows.
export const hashOf = (buf) => createHash('sha256').update(String(buf).replace(/\r\n?/g, '\n')).digest('hex').slice(0, 16);

/** Map of project-relative path ("tools/board/board.css") → absolute path of the kit's copy. */
export function kitTools() {
  const out = new Map();
  (function walk(dir) {
    for (const n of readdirSync(dir).sort()) {
      const full = join(dir, n);
      if (statSync(full).isDirectory()) walk(full);
      else out.set(relative(TOOLS_ROOT, full).replace(/\\/g, '/'), full);
    }
  })(join(TOOLS_ROOT, 'tools'));
  return out;
}

export const kitRecord = (files) => `${JSON.stringify({ kit: 'devflow', version: KIT_VERSION, files }, null, 2)}\n`;
