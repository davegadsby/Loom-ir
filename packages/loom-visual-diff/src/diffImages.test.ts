import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { diffImages, DiffImagesError } from "./diffImages.js";

/** Builds a small solid-color PNG buffer, with one pixel overridden (0,0) to `topLeft` if given. */
function makePng(width: number, height: number, color: [number, number, number, number], topLeft?: [number, number, number, number]): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) << 2;
      const [r, g, b, a] = x === 0 && y === 0 && topLeft ? topLeft : color;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

describe("diffImages", () => {
  it("reports zero diff for pixel-identical images", () => {
    const a = makePng(4, 4, [255, 0, 0, 255]);
    const b = makePng(4, 4, [255, 0, 0, 255]);
    const result = diffImages(a, b);
    expect(result).toMatchObject({ width: 4, height: 4, diffPixels: 0, totalPixels: 16, ratio: 0 });
  });

  it("reports a nonzero ratio when exactly one pixel differs", () => {
    const a = makePng(4, 4, [255, 0, 0, 255]);
    const b = makePng(4, 4, [255, 0, 0, 255], [0, 255, 0, 255]);
    const result = diffImages(a, b);
    expect(result.diffPixels).toBe(1);
    expect(result.totalPixels).toBe(16);
    expect(result.ratio).toBeCloseTo(1 / 16);
    expect(result.diffPng.length).toBeGreaterThan(0);
  });

  it("throws DiffImagesError when dimensions don't match", () => {
    const a = makePng(4, 4, [255, 0, 0, 255]);
    const b = makePng(8, 4, [255, 0, 0, 255]);
    expect(() => diffImages(a, b)).toThrow(DiffImagesError);
    expect(() => diffImages(a, b)).toThrow(/4x4.*8x4/);
  });
});
