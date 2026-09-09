// Criterion 19: import boundaries and the Math.random ban, enforced as tests so
// CI fails on violation without any lint tooling.
//
//   ui -> game -> engine
//         game -> ai
//         ai   -> engine/coords.js ONLY (never board.js / fleet.js)
//   Nothing outside src/ui touches the DOM. Only src/rng.js mentions Math.random.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, posix } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

const FILES = walk(SRC);

/** @returns {{ file: string, layer: string, imports: string[] }[]} */
function graph() {
  return FILES.map((file) => {
    const source = readFileSync(file, 'utf8');
    const rel = posix.normalize(relative(SRC, file).split('\\').join('/'));
    const layer = rel.includes('/') ? rel.split('/')[0] : rel;
    const imports = [];
    const re = /(?:^|\n)\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(source))) {
      const spec = m[1] || m[2];
      assert.ok(spec.startsWith('.'), `${rel}: non-relative import ${spec} (no runtime dependencies)`);
      const target = posix.normalize(posix.join(posix.dirname(rel), spec));
      imports.push(target);
    }
    return { file: rel, layer, imports };
  });
}

function layerOf(path) {
  return path.includes('/') ? path.split('/')[0] : path;
}

const ALLOWED = {
  'rng.js': [],
  engine: ['engine'],
  ai: ['ai', 'engine/coords.js'],
  game: ['game', 'engine', 'ai', 'rng.js'],
  ui: ['ui', 'game', 'engine/coords.js', 'rng.js'],
};

describe('import boundaries', () => {
  test('all source files are in a known layer', () => {
    for (const { layer, file } of graph()) assert.ok(layer in ALLOWED, `unknown layer for ${file}`);
  });

  test('every import stays within the allowed direction', () => {
    for (const { file, layer, imports } of graph()) {
      for (const target of imports) {
        const ok = ALLOWED[layer].some((rule) => (rule.endsWith('.js') ? target === rule : layerOf(target) === rule));
        assert.ok(ok, `${file} may not import ${target}`);
      }
    }
  });

  test('ai never imports board.js or fleet.js, directly or via any file it imports', () => {
    const g = graph();
    const byFile = new Map(g.map((n) => [n.file, n]));
    const seen = new Set();
    const queue = g.filter((n) => n.layer === 'ai').map((n) => n.file);
    while (queue.length) {
      const f = queue.pop();
      if (seen.has(f)) continue;
      seen.add(f);
      assert.notEqual(f, 'engine/board.js', 'ai reaches engine/board.js');
      assert.notEqual(f, 'engine/fleet.js', 'ai reaches engine/fleet.js');
      const node = byFile.get(f);
      if (node) queue.push(...node.imports);
    }
    assert.ok(seen.has('engine/coords.js'));
  });

  test('ui is the only layer that references the DOM', () => {
    for (const { file, layer } of graph()) {
      if (layer === 'ui') continue;
      const src = readFileSync(join(SRC, file), 'utf8');
      assert.equal(/\b(document|window|localStorage|HTMLElement)\b/.test(src), false, `${file} references the DOM`);
    }
  });

  test('Math.random appears only in src/rng.js', () => {
    for (const { file } of graph()) {
      const src = readFileSync(join(SRC, file), 'utf8');
      if (file === 'rng.js') assert.match(src, /Math\.random/);
      else assert.equal(src.includes('Math.random'), false, `${file} uses Math.random`);
    }
    // Tests must be seeded too.
    const self = resolve(import.meta.filename);
    for (const f of walk(join(ROOT, 'test'))) {
      if (resolve(f) === self) continue;
      assert.equal(readFileSync(f, 'utf8').includes('Math.random'), false, `${f} uses Math.random`);
    }
  });

  test('the rule engine itself rejects a hypothetical ai -> board.js import', () => {
    const violation = { file: 'ai/hard.js', layer: 'ai', imports: ['engine/board.js'] };
    const ok = ALLOWED[violation.layer].some((rule) => (rule.endsWith('.js') ? violation.imports[0] === rule : layerOf(violation.imports[0]) === rule));
    assert.equal(ok, false);
  });

  test('the ai receives only redacted results from game.js', () => {
    const src = readFileSync(join(SRC, 'game/game.js'), 'utf8');
    assert.match(src, /ai\.observe\(aiMemory, coord, redacted\)/);
    assert.equal(/ai\.(chooseShot|observe)\([^)]*(playerBoard|enemyBoard)/.test(src), false);
  });
});
