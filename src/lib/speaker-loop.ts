/** Fold the tail into the head so the decoded PCM buffer has a continuous seam. */
export function crossfadeLoop(samples: Float32Array, overlap: number): Float32Array {
  const size = Math.min(Math.max(1, Math.floor(overlap)), Math.floor(samples.length / 3));
  if (size < 2) return samples.slice();
  const output = new Float32Array(samples.length - size);
  for (let i = 0; i < size; i++) {
    const phase = i / (size - 1);
    output[i] = samples[samples.length - size + i] * (1 - phase) + samples[i] * phase;
  }
  output.set(samples.subarray(size, samples.length - size), size);
  return output;
}
