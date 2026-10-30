#!/usr/bin/env node
/**
 * Executable version of the design house rules.
 *
 * The rules were research, then prose, then a hand-applied sweep; prose does not
 * survive a refactor. This script is the gate: it fails the build when a banned
 * pattern returns to the frontend source.
 *
 * Deliberately narrow: it checks utilities and tokens, not taste. Judgement calls
 * (is this headline two lines at 360px?) stay with a human or a browser.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', 'apps', 'web', 'src');
const SKIP_DIRS = new Set(['vendor']);

/** Utilities banned outright, with the reason printed on failure. */
const BANNED = [
  { pattern: /\bfont-mono\b/, reason: 'monospace outside real code (use <code>/<pre>)' },
  { pattern: /\buppercase\b/, reason: 'uppercase labels are decoration, not information' },
  { pattern: /\btracking-\[(?!-)/, reason: 'wide tracking belongs to eyebrows; neither is allowed' },
  { pattern: /\btracking-wider?\b/, reason: 'wide tracking belongs to eyebrows; neither is allowed' },
  { pattern: /\bbg-gradient-/, reason: 'gradients are banned on every surface' },
  { pattern: /linear-gradient|radial-gradient|conic-gradient/, reason: 'gradients are banned on every surface' },
  { pattern: /\bbackdrop-blur/, reason: 'glass/blur is banned' },
  { pattern: /\bshadow-(?!none)/, reason: 'no shadows at rest' },
  { pattern: /\bdrop-shadow-/, reason: 'no glows' },
  { pattern: /\bsw-grain\b|\bsw-ticks\b|\bsw-grid-bg\b/, reason: 'decorative texture layers were removed' },
];

/** Files where a rule is legitimate: the vendored library keeps its own CSS. */
const ALLOW_FILE = [/vendor\//, /\.test\.tsx?$/, /house-rules/];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry)) out.push(full);
  }
  return out;
}

/** A line that is inside <code>/<pre> markup may use monospace. */
function codeContext(lines, index) {
  for (let i = index; i >= Math.max(0, index - 12); i -= 1) {
    if (/<(code|pre)\b/.test(lines[i]) && !/<\/(code|pre)>/.test(lines[i])) return true;
    const opened = (lines[i].match(/<(code|pre)\b/g) ?? []).length;
    const closed = (lines[i].match(/<\/(code|pre)>/g) ?? []).length;
    if (opened > closed) return true;
  }
  return false;
}

const violations = [];
for (const file of walk(ROOT)) {
  const rel = path.relative(path.resolve(ROOT, '..', '..', '..'), file);
  if (ALLOW_FILE.some((re) => re.test(rel))) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) return;
    if (/<(code|pre)\b/.test(line)) return;
    if (/^\s*--font-mono:/.test(line)) return;
    for (const rule of BANNED) {
      if (!rule.pattern.test(line)) continue;
      if (rule.pattern.source.includes('font-mono') && codeContext(lines, index)) continue;
      violations.push({ file: rel, line: index + 1, reason: rule.reason, source: line.trim().slice(0, 140) });
    }
  });
}

if (violations.length === 0) {
  console.log(`ui rules: ${walk(ROOT).length} files scanned, no violations`);
  process.exit(0);
}

console.error(`ui rules: ${violations.length} violation(s)\n`);
for (const v of violations) {
  console.error(`${v.file}:${v.line} — ${v.reason}\n  ${v.source}`);
}
process.exit(1);
