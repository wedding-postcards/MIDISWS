import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Alegreya is OFL-1.1; its retained license is assets/fonts/midis/Alegreya-OFL.txt.
// fontTools instantiates wght=550 before Three reads the outlines: no synthetic bold.
// Use MIDIS_FONT_PYTHON when Python is outside PATH; build tooling stays temporary.
const source = fileURLToPath(new URL('../public/assets/fonts/midis/Alegreya-variable.ttf', import.meta.url));
const instance = fileURLToPath(new URL('../public/assets/fonts/midis/Alegreya-550.ttf', import.meta.url));
const tools = fileURLToPath(new URL('../../.tmp/fonttools-bake', import.meta.url));
const python = process.env.MIDIS_FONT_PYTHON || 'python';
const program = `
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
font = TTFont(sys.argv[1], recalcTimestamp=False)
font = instantiateVariableFont(font, {"wght": 550}, inplace=True)
font["OS/2"].usWeightClass = 550
assert "fvar" not in font and "gvar" not in font
font.save(sys.argv[2])
`;
const result = spawnSync(python, ['-c', program, source, instance], {
  encoding: 'utf8',
  env: { ...process.env, PYTHONPATH: [tools, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter) },
});
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr || 'Alegreya instancing failed');

const bytes = fs.readFileSync(instance);
const data = new TTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const geometry = new TextGeometry('МИДИС', {
  font: new Font(data), size: 1, depth: .012, curveSegments: 12,
  // A ~2px rounded chamfer at desktop size reads under the shared film grain.
  bevelEnabled: true, bevelThickness: .0075, bevelSize: .0075, bevelSegments: 3,
});
geometry.computeBoundingBox();
const size = geometry.boundingBox.getSize(new Vector3());
geometry.center();
geometry.scale(1 / size.x, 1 / size.x, 1 / size.x);
geometry.deleteAttribute('uv');
const compact = mergeVertices(geometry, 1e-5);
const json = {
  metadata: { version: 4.7, type: 'BufferGeometry', generator: 'Alegreya OFL true wght=550' },
  data: { attributes: {}, index: { type: compact.index.array.constructor.name, array: Array.from(compact.index.array) } },
};
for (const [key, attribute] of Object.entries(compact.attributes)) {
  json.data.attributes[key] = {
    itemSize: attribute.itemSize, type: 'Float32Array',
    array: Array.from(attribute.array, value => Math.round(value * 1e5) / 1e5), normalized: false,
  };
}
fs.writeFileSync(new URL('../public/assets/midis/wordmark-alegreya.json', import.meta.url), JSON.stringify(json));
console.log(`Alegreya 550: ${geometry.attributes.position.count / 3} triangles; width normalized to 1.`);
