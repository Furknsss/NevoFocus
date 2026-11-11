import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');

test('Focus header has no notification shortcut and an icon-only white minimize button', () => {
  const page = read('src/components/ActiveFocusSession.tsx');
  assert.doesNotMatch(page, /title="Bildirim & Canlı Kapsül"/);
  assert.doesNotMatch(page, /<span>Küçült<\/span>/);
  assert.match(page, /aria-label="Seansı Küçült \(Mini Ekrana Geç\)"/);
  assert.match(page, /<Minimize2 className="w-4 h-4 text-white"\s*\/>/);
  assert.match(page, /aria-label=\{isFullscreen \? 'Tam Ekrandan Çık' : 'Tam Ekran'\}/);
});

test('task drawer scrollbar is locally black with white thumb', () => {
  const page = read('src/components/ActiveFocusSession.tsx');
  const styles = read('src/index.css');
  assert.match(page, /nevo-dark-scrollbar space-y-1\.5 max-h-48 overflow-y-auto/);
  assert.match(styles, /\.nevo-dark-scrollbar\s*\{\s*scrollbar-width: thin;\s*scrollbar-color: #ffffff #000000;/);
  assert.match(styles, /\.nevo-dark-scrollbar::-webkit-scrollbar-track\s*\{\s*background: #000000;/);
  assert.match(styles, /\.nevo-dark-scrollbar::-webkit-scrollbar-thumb\s*\{\s*background: #ffffff;/);
  assert.match(styles, /\.nevo-dark-scrollbar::-webkit-scrollbar-button\s*\{\s*display: none;/);
});
