const OUTPUT_SAMPLE_RATE = 44_100;
const MP3_BLOCK_SAMPLES = 1_152;

/** Encode mono/stereo PCM without keeping a second full-length PCM copy. */
export async function encodePcmToMp3(
  channels: readonly Float32Array[],
  sampleRate = OUTPUT_SAMPLE_RATE,
  name = `voice-${Date.now()}`,
): Promise<File> {
  const length = channels[0]?.length || 0;
  if (
    channels.length < 1 ||
    channels.length > 2 ||
    !length ||
    channels.some((channel) => channel.length !== length) ||
    !Number.isFinite(sampleRate) ||
    sampleRate <= 0
  ) {
    throw new Error("Invalid PCM audio");
  }
  // Keep the encoder out of the initial application bundle.
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const encoder = new Mp3Encoder(channels.length, sampleRate, 128);
  const left = new Int16Array(MP3_BLOCK_SAMPLES);
  const right =
    channels.length === 2 ? new Int16Array(MP3_BLOCK_SAMPLES) : undefined;
  const parts: ArrayBuffer[] = [];
  const append = (bytes: Uint8Array) => {
    if (!bytes.length) return;
    // lamejs actually returns signed bytes; copying preserves their bit pattern
    // and gives Blob an owned ArrayBuffer rather than an encoder scratch view.
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    parts.push(copy.buffer);
  };
  const pcmSample = (value: number) => {
    const sample = Number.isFinite(value)
      ? Math.max(-1, Math.min(1, value))
      : 0;
    return sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  };
  let yieldAt = performance.now() + 8;
  for (let offset = 0; offset < length; offset += MP3_BLOCK_SAMPLES) {
    const count = Math.min(MP3_BLOCK_SAMPLES, length - offset);
    for (let index = 0; index < count; index++) {
      left[index] = pcmSample(channels[0][offset + index]);
      if (right) right[index] = pcmSample(channels[1][offset + index]);
    }
    append(
      encoder.encodeBuffer(left.subarray(0, count), right?.subarray(0, count)),
    );
    // Long recordings must leave time for the interface to render and respond.
    if (performance.now() >= yieldAt) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      yieldAt = performance.now() + 8;
    }
  }
  append(encoder.flush());
  if (!parts.length) throw new Error("Audio encoder returned no data");
  return new File(parts, `${name.replace(/\.[^/.]+$/, "")}.mp3`, {
    type: "audio/mpeg",
  });
}

/** Preserve native Safari AAC; make Chromium/Firefox Opus portable as MP3. */
export async function prepareRecordedAudio(
  blob: Blob,
  name = `voice-${Date.now()}`,
): Promise<File> {
  if (!blob.size) throw new Error("Empty audio recording");
  const mime = blob.type.split(";")[0].trim().toLowerCase();
  const base = name.replace(/\.[^/.]+$/, "");
  if (["audio/mp4", "audio/m4a", "audio/x-m4a"].includes(mime)) {
    return new File([blob], `${base}.m4a`, { type: "audio/mp4" });
  }
  if (["audio/mpeg", "audio/mp3"].includes(mime)) {
    return new File([blob], `${base}.mp3`, { type: "audio/mpeg" });
  }
  const browser = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
    webkitOfflineAudioContext?: typeof OfflineAudioContext;
  };
  const Context = browser.AudioContext || browser.webkitAudioContext;
  if (!Context) throw new Error("Audio decoding is not supported");
  const context = new Context();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    // No sound is played; release the decoding context immediately.
    await context.close().catch(() => {});
  }
  if (!decoded.length || !decoded.numberOfChannels)
    throw new Error("Empty decoded audio recording");
  const channelCount = Math.min(2, decoded.numberOfChannels);
  let pcm = decoded;
  if (
    decoded.sampleRate !== OUTPUT_SAMPLE_RATE ||
    decoded.numberOfChannels > 2
  ) {
    const OfflineContext =
      browser.OfflineAudioContext || browser.webkitOfflineAudioContext;
    if (!OfflineContext) throw new Error("Audio resampling is not supported");
    const offline = new OfflineContext(
      channelCount,
      Math.max(1, Math.ceil(decoded.duration * OUTPUT_SAMPLE_RATE)),
      OUTPUT_SAMPLE_RATE,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    pcm = await offline.startRendering();
  }
  return encodePcmToMp3(
    Array.from({ length: channelCount }, (_, index) =>
      pcm.getChannelData(index),
    ),
    OUTPUT_SAMPLE_RATE,
    base,
  );
}
