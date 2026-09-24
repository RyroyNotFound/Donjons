// Minimal PSD layer compositor (normal + multiply blending, layer masks, per-layer tint).
import { readFileSync, writeFileSync } from "fs";
import { readPsd, initializeCanvas } from "ag-psd";
// Pixel buffers only, no real canvas needed.
const fakeCanvas = (width, height) => ({ width, height, getContext: () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() {}, drawImage() {} }) });
initializeCanvas(fakeCanvas, (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }));
import { PNG } from "pngjs";

const cache = new Map();
export function load(file) {
  if (!cache.has(file)) cache.set(file, readPsd(readFileSync(file), { useImageData: true, skipCompositeImageData: true, skipThumbnail: true }));
  return cache.get(file);
}

/** Composite leaves whose path (or an ancestor path) is in `show`. */
export function composite(psd, show) {
  const W = psd.width, H = psd.height;
  const baseLayer = psd.children.find((l) => l.name === "Base" || l.name === "Base Body");
  let baseBody = null;
  if (baseLayer?.imageData) {
    baseBody = new Uint8ClampedArray(W * H * 4);
    const bl = baseLayer.imageData;
    for (let y = 0; y < bl.height; y++) for (let x = 0; x < bl.width; x++) {
      const X = baseLayer.left + x, Y = baseLayer.top + y;
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      baseBody.set(bl.data.subarray((y * bl.width + x) * 4, (y * bl.width + x) * 4 + 4), (Y * W + X) * 4);
    }
  }
  const out = new Float32Array(W * H * 4); // premult-free RGBA 0..1
  const tints = new Map(show.filter((s) => typeof s === "object").map((s) => [s.path, s.tint]));
  const sel = new Set(show.map((s) => (typeof s === "object" ? s.path : s)));
  const matched = new Set();
  function draw(l, masks, tint) {
    const img = l.imageData; if (!img) return;
    const op = l.opacity ?? 1;
    const mult = l.blendMode === "multiply";
    for (let y = 0; y < img.height; y++) {
      const Y = l.top + y; if (Y < 0 || Y >= H) continue;
      for (let x = 0; x < img.width; x++) {
        const X = l.left + x; if (X < 0 || X >= W) continue;
        const si = (y * img.width + x) * 4;
        let a = (img.data[si + 3] / 255) * op;
        if (a <= 0) continue;
        for (const m of masks) {
          const mx = X - m.left, my = Y - m.top;
          const v = mx >= 0 && my >= 0 && mx < m.imageData.width && my < m.imageData.height ? m.imageData.data[(my * m.imageData.width + mx) * 4] : (m.defaultColor ?? 255);
          a *= v / 255;
        }
        if (a <= 0) continue;
        const di = (Y * W + X) * 4;
        const da = out[di + 3];
        for (let c = 0; c < 3; c++) {
          let s = img.data[si + c] / 255;
          if (tint) {
            // Tint only neutral/cool fabric pixels, never warm skin tones baked into the same layer.
            const r = img.data[si], b = img.data[si + 2];
            const warmth = r - b; // skin is warm (r >> b); fabric and its shading are neutral or cool
            const w = Math.max(0, Math.min(1, 1 - (warmth - 8) / 14));
            s *= 1 - w + (w * tint[c]) / 255;
          }
          if (mult) s = s * (da > 0 ? out[di + c] : 1);
          const oa = a + da * (1 - a);
          out[di + c] = oa > 0 ? (s * a + out[di + c] * da * (1 - a)) / oa : 0;
        }
        out[di + 3] = a + da * (1 - a);
      }
    }
  }
  function walk(ls, path, on, masks, tint) {
    for (const l of ls ?? []) {
      const p = path + "/" + l.name.trim();
      const isOn = on || sel.has(p);
      if (sel.has(p)) matched.add(p);
      const m = l.mask && l.mask.imageData ? [...masks, l.mask] : masks;
      const t = tints.get(p) ?? tint;
      if (l.children) walk(l.children, p, isOn, m, t);
      else if (isOn) draw(l, m, t);
    }
  }
  walk(psd.children, "", false, [], undefined);
  for (const s of sel) if (!matched.has(s)) throw new Error("layer not found: " + s);
  return { W, H, px: out };
}

export function crop({ W, px }, x0, y0, w, h, scale = 1) {
  const ow = Math.round(w * scale), oh = Math.round(h * scale);
  const png = new PNG({ width: ow, height: oh });
  const inv = 1 / scale;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    const sx0 = Math.floor(x0 + x * inv), sy0 = Math.floor(y0 + y * inv), s1 = Math.max(1, Math.round(inv));
    for (let yy = 0; yy < s1; yy++) for (let xx = 0; xx < s1; xx++) {
      const i = ((sy0 + yy) * W + sx0 + xx) * 4; const al = px[i + 3] ?? 0;
      r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al; n++;
    }
    const o = (y * ow + x) * 4;
    png.data[o] = a ? Math.round((r / a) * 255) : 0; png.data[o + 1] = a ? Math.round((g / a) * 255) : 0;
    png.data[o + 2] = a ? Math.round((b / a) * 255) : 0; png.data[o + 3] = Math.round((a / n) * 255);
  }
  return png;
}

export function sheet(pngs, cols, bg = [40, 30, 50]) {
  const w = pngs[0].width, h = pngs[0].height, rows = Math.ceil(pngs.length / cols);
  const s = new PNG({ width: w * cols, height: h * rows });
  for (let i = 0; i < s.data.length; i += 4) { s.data[i] = bg[0]; s.data[i + 1] = bg[1]; s.data[i + 2] = bg[2]; s.data[i + 3] = 255; }
  pngs.forEach((p, k) => { const ox = (k % cols) * w, oy = Math.floor(k / cols) * h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const si = (y * w + x) * 4, di = ((oy + y) * s.width + ox + x) * 4, a = p.data[si + 3] / 255;
      for (let c = 0; c < 3; c++) s.data[di + c] = Math.round(p.data[si + c] * a + s.data[di + c] * (1 - a)); } });
  return s;
}
export const save = (png, f) => writeFileSync(f, PNG.sync.write(png));
