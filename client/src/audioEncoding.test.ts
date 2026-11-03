import { expect, it } from "vitest";
import { encodePcmToMp3, prepareRecordedAudio } from "./audioEncoding";

it("encodes a synthetic voice-frequency signal into 44.1 kHz mono MP3 frames", async () => {
  const sampleRate = 44_100;
  const samples = Float32Array.from(
    { length: sampleRate },
    (_, index) => 0.4 * Math.sin((2 * Math.PI * 440 * index) / sampleRate),
  );
  const file = await encodePcmToMp3([samples], sampleRate, "recording.webm");
  expect(file.type).toBe("audio/mpeg");
  expect(file.name).toBe("recording.mp3");
  expect(file.size).toBeGreaterThan(12_000);
  const bytes = new Uint8Array(await file.arrayBuffer());
  let frameCount = 0;
  let offset = 0;
  const bitrates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  while (offset + 4 <= bytes.length) {
    // MPEG-1 Layer III, 44.1 kHz, mono; this verifies the produced container
    // rather than merely checking that the encoder returned nonempty bytes.
    expect(bytes[offset]).toBe(0xff);
    expect(bytes[offset + 1] & 0xfe).toBe(0xfa);
    expect((bytes[offset + 2] >> 2) & 3).toBe(0);
    expect(bytes[offset + 3] >> 6).toBe(3);
    const bitrate = bitrates[bytes[offset + 2] >> 4];
    expect(bitrate).toBe(128);
    const padding = (bytes[offset + 2] >> 1) & 1;
    offset += Math.floor((144_000 * bitrate) / sampleRate) + padding;
    frameCount++;
  }
  expect(frameCount).toBeGreaterThanOrEqual(39);
  expect(offset).toBe(bytes.length);
});

it("keeps native MP4 audio unchanged without a decoding context", async () => {
  const bytes = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 77, 52, 65]);
  const file = await prepareRecordedAudio(
    new Blob([bytes], { type: "audio/mp4;codecs=mp4a.40.2" }),
    "title.webm",
  );
  expect(file.name).toBe("title.m4a");
  expect(file.type).toBe("audio/mp4");
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
});

it("rejects empty or misaligned PCM instead of uploading broken audio", async () => {
  await expect(encodePcmToMp3([new Float32Array()])).rejects.toThrow();
  await expect(
    encodePcmToMp3([new Float32Array(30), new Float32Array(20)]),
  ).rejects.toThrow();
});
