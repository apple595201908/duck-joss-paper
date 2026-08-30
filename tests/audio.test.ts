import { describe, expect, it } from 'vitest';
import {
  renderTempleFestivalBgm,
  TEMPLE_BGM_DURATION_SECONDS,
} from '../src/game/audio';

describe('original temple-festival BGM', () => {
  it('renders a finite, peak-safe stereo loop at the requested sample rate', () => {
    const rendered = renderTempleFestivalBgm(8_000);

    expect(rendered.durationSeconds).toBe(TEMPLE_BGM_DURATION_SECONDS);
    expect(rendered.left).toHaveLength(8_000 * TEMPLE_BGM_DURATION_SECONDS);
    expect(rendered.right).toHaveLength(rendered.left.length);

    let peak = 0;
    let energy = 0;
    let stereoDifference = 0;
    let allFinite = true;
    for (let index = 0; index < rendered.left.length; index += 1) {
      const left = rendered.left[index];
      const right = rendered.right[index];
      allFinite &&= Number.isFinite(left) && Number.isFinite(right);
      peak = Math.max(peak, Math.abs(left), Math.abs(right));
      energy += Math.abs(left) + Math.abs(right);
      stereoDifference += Math.abs(left - right);
    }

    expect(allFinite).toBe(true);
    expect(peak).toBeGreaterThan(0.1);
    expect(peak).toBeLessThanOrEqual(0.841);
    expect(energy / rendered.left.length).toBeGreaterThan(0.01);
    expect(stereoDifference / rendered.left.length).toBeGreaterThan(0.001);
  });

  it('rejects unusably low sample rates', () => {
    expect(() => renderTempleFestivalBgm(4_000)).toThrow(RangeError);
  });
});
