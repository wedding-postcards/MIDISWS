import fs from 'node:fs';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Vector3 } from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Bake the five Cyrillic outlines once. No font parser runs on the website.
const bytes = fs.readFileSync(new URL('../public/assets/fonts/CormorantGaramond-Bold.ttf', import.meta.url));
const data = new TTFLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const geometry = new TextGeometry('МИДИС', {
  font: new Font(data), size: 1, depth: .018, curveSegments: 8,
  bevelEnabled: true, bevelThickness: .004, bevelSize: .004, bevelSegments: 2,
});
geometry.computeBoundingBox();
const size = geometry.boundingBox.getSize(new Vector3());
geometry.center();
geometry.scale(1 / size.x, 1 / size.x, 1 / size.x);
geometry.deleteAttribute('uv');
const compact = mergeVertices(geometry, 1e-5);
// A plain BufferGeometry export avoids carrying generator options or the font.
const json = { metadata: { version: 4.7, type: 'BufferGeometry' }, data: { attributes: {}, index: { type: compact.index.array.constructor.name, array: Array.from(compact.index.array) } } };
for (const [key, attribute] of Object.entries(compact.attributes)) {
  json.data.attributes[key] = { itemSize: attribute.itemSize, type: 'Float32Array', array: Array.from(attribute.array, value => Math.round(value * 1e5) / 1e5), normalized: false };
}
fs.writeFileSync(new URL('../public/assets/midis/wordmark-gold.json', import.meta.url), JSON.stringify(json));
console.log(`Gold wordmark: ${geometry.attributes.position.count / 3} triangles; width normalized to 1.`);
