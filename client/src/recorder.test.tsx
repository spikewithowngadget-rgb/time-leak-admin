// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useRecorder } from "./recorder";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("releases microphone access granted after the editor has closed without starting a recorder", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let resolvePermission: (stream: MediaStream) => void = () => {};
  const getUserMedia = vi.fn(
    () =>
      new Promise<MediaStream>((resolve) => {
        resolvePermission = resolve;
      }),
  );
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia },
    language: "en",
  });
  const constructed = vi.fn();
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported() {
        return true;
      }
      constructor() {
        constructed();
      }
    },
  );
  const stopTrack = vi.fn();
  const stream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream;
  const onDone = vi.fn();
  const onError = vi.fn();
  let control: ReturnType<typeof useRecorder> | undefined;
  function Editor() {
    control = useRecorder(onDone, onError);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(<Editor />);
  });
  const pending = control!.start();
  // A repeated click while the permission prompt is pending is coalesced.
  await control!.start();
  expect(getUserMedia).toHaveBeenCalledTimes(1);
  await act(async () => {
    root.unmount();
  });
  resolvePermission(stream);
  await pending;
  expect(stopTrack).toHaveBeenCalledTimes(1);
  expect(constructed).not.toHaveBeenCalled();
  expect(onDone).not.toHaveBeenCalled();
  expect(onError).not.toHaveBeenCalled();
});
