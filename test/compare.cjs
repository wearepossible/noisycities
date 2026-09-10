/**
 * Compares two directories of screenshots produced by capture.cjs.
 *
 * Identical files are settled by hash, which is the fast path and the strict
 * one: the interface is expected to match exactly, so zero differing bytes is
 * the pass condition. Only files that fail that test are decoded, and the pixel
 * diff is computed inside Chromium via a canvas — that avoids taking on an
 * image library as a dependency, which would defeat the point of this work.
 *
 * Usage:
 *   NODE_PATH=/opt/node22/lib/node_modules node test/compare.cjs <dirA> <dirB> [diffDir]
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [, , DIR_A, DIR_B, DIFF_DIR = 'test/diff'] = process.argv;
if (!DIR_A || !DIR_B) {
  console.error('usage: node test/compare.cjs <dirA> <dirB> [diffDir]');
  process.exit(1);
}

const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const pngs = (d) => fs.existsSync(d) ? fs.readdirSync(d).filter((f) => f.endsWith('.png')).sort() : [];

/** Compare two PNGs pixel by pixel; returns a count and a highlighted diff image. */
async function pixelDiff(page, fileA, fileB) {
  const toDataUrl = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  return page.evaluate(async ([a, b]) => {
    const load = (src) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = src;
    });
    const [ia, ib] = await Promise.all([load(a), load(b)]);

    if (ia.width !== ib.width || ia.height !== ib.height) {
      return { sizeMismatch: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
    }

    const draw = (img) => {
      const c = new OffscreenCanvas(img.width, img.height);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, img.width, img.height);
    };
    const da = draw(ia).data;
    const db = draw(ib).data;

    // Diff image: the "after" faded out, with changed pixels flagged in red.
    const out = new OffscreenCanvas(ia.width, ia.height);
    const octx = out.getContext('2d');
    const odata = octx.createImageData(ia.width, ia.height);
    let differing = 0;
    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;

    for (let i = 0; i < da.length; i += 4) {
      const same = da[i] === db[i] && da[i + 1] === db[i + 1]
                && da[i + 2] === db[i + 2] && da[i + 3] === db[i + 3];
      const px = (i / 4) % ia.width;
      const py = Math.floor((i / 4) / ia.width);
      if (same) {
        const grey = (db[i] * 0.299 + db[i + 1] * 0.587 + db[i + 2] * 0.114);
        odata.data[i] = odata.data[i + 1] = odata.data[i + 2] = 255 - (255 - grey) * 0.15;
        odata.data[i + 3] = 255;
      } else {
        differing++;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        odata.data[i] = 255; odata.data[i + 1] = 0;
        odata.data[i + 2] = 0; odata.data[i + 3] = 255;
      }
    }
    octx.putImageData(odata, 0, 0);
    const blob = await out.convertToBlob({ type: 'image/png' });
    const buf = new Uint8Array(await blob.arrayBuffer());

    return {
      differing,
      total: ia.width * ia.height,
      box: differing ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
      png: Array.from(buf),
    };
  }, [toDataUrl(fileA), toDataUrl(fileB)]);
}

(async () => {
  const a = pngs(DIR_A);
  const b = pngs(DIR_B);
  const onlyA = a.filter((f) => !b.includes(f));
  const onlyB = b.filter((f) => !a.includes(f));
  const common = a.filter((f) => b.includes(f));

  const changed = common.filter(
    (f) => sha(path.join(DIR_A, f)) !== sha(path.join(DIR_B, f))
  );

  console.log(`compared ${common.length} screenshots`);
  console.log(`  identical : ${common.length - changed.length}`);
  console.log(`  differing : ${changed.length}`);
  if (onlyA.length) console.log(`  only in ${DIR_A}: ${onlyA.length} (${onlyA.slice(0, 5).join(', ')}…)`);
  if (onlyB.length) console.log(`  only in ${DIR_B}: ${onlyB.length} (${onlyB.slice(0, 5).join(', ')}…)`);

  if (!changed.length) {
    console.log('\nPASS — every screenshot matches exactly.');
    process.exit(onlyA.length || onlyB.length ? 1 : 0);
  }

  fs.mkdirSync(DIFF_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto('about:blank');

  console.log('\ndifferences:');
  for (const f of changed) {
    const r = await pixelDiff(page, path.join(DIR_A, f), path.join(DIR_B, f));
    if (r.sizeMismatch) {
      console.log(`  ${f}: SIZE MISMATCH ${r.sizeMismatch}`);
      continue;
    }
    fs.writeFileSync(path.join(DIFF_DIR, f), Buffer.from(r.png));
    const pct = ((r.differing / r.total) * 100).toFixed(3);
    console.log(
      `  ${f}: ${r.differing} px (${pct}%)  region ${r.box.w}x${r.box.h} at ${r.box.x},${r.box.y}`
    );
  }

  await browser.close();
  console.log(`\nFAIL — ${changed.length} screenshots differ. Diff images in ${DIFF_DIR}/`);
  process.exit(1);
})();
