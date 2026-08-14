import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export class DiffImagesError extends Error {}

export interface DiffImagesResult {
  width: number;
  height: number;
  diffPixels: number;
  totalPixels: number;
  /** `diffPixels / totalPixels` — 0 means pixel-identical. */
  ratio: number;
  /** `pixelmatch`'s visual diff overlay, PNG-encoded. */
  diffPng: Buffer;
}

/**
 * Decodes two PNG buffers and pixel-diffs them via `pixelmatch` — the pure,
 * browser-free half of the visual-conformance loop (see `examples/visualDiff.ts`
 * for the orchestration half: rendering a real component in a browser,
 * screenshotting it, and calling this). Deliberately does not attempt a
 * pass/fail verdict itself — a similarity ratio isn't a binary answer the
 * way `checkTokensResolve`'s "does this token exist" is; what counts as
 * "close enough" is a threshold decision left to the caller.
 */
export function diffImages(actual: Buffer, reference: Buffer): DiffImagesResult {
  const actualPng = PNG.sync.read(actual);
  const referencePng = PNG.sync.read(reference);

  if (actualPng.width !== referencePng.width || actualPng.height !== referencePng.height) {
    throw new DiffImagesError(
      `image dimensions don't match: actual is ${actualPng.width}x${actualPng.height}, reference is ${referencePng.width}x${referencePng.height}`
    );
  }

  const { width, height } = actualPng;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(actualPng.data, referencePng.data, diff.data, width, height, { threshold: 0.1 });
  const totalPixels = width * height;

  return { width, height, diffPixels, totalPixels, ratio: diffPixels / totalPixels, diffPng: PNG.sync.write(diff) };
}
