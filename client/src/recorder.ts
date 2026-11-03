import { useCallback, useEffect, useRef, useState } from "react";
import { translate as t } from "./i18n";
import { prepareRecordedAudio } from "./audioEncoding";

export function useRecorder(
  onDone: (file: File) => void,
  onError: (error: unknown) => void,
  maxSeconds?: number,
) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [processing, setProcessing] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number>(0);
  const mounted = useRef(true);
  const generation = useRef(0);
  const starting = useRef<number | null>(null);
  const processingRequest = useRef<number | null>(null);
  const done = useRef(onDone);
  const error = useRef(onError);
  done.current = onDone;
  error.current = onError;

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = async () => {
    if (
      !mounted.current ||
      starting.current !== null ||
      processingRequest.current !== null ||
      recorder.current !== null
    )
      return;
    const request = ++generation.current;
    starting.current = request;
    let media: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(t("web_audioUnsupported"));
      media = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Permission can arrive after the editor has closed. Stop that stream
      // before creating a recorder or invoking callbacks into an old screen.
      if (!mounted.current || request !== generation.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mime = [
        "audio/mp4",
        "audio/ogg;codecs=opus",
        "audio/webm;codecs=opus",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const rec = new MediaRecorder(
        media,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: BlobPart[] = [];
      let failed = false;
      rec.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      rec.onstop = async () => {
        clearInterval(timer.current);
        media?.getTracks().forEach((track) => track.stop());
        if (stream.current === media) stream.current = null;
        if (recorder.current === rec) recorder.current = null;
        if (!mounted.current || request !== generation.current) return;
        setRecording(false);
        if (failed) return;
        const blob = new Blob(chunks, { type: rec.mimeType });
        if (blob.size < 1024) {
          error.current(new Error(t("calendar_status_saveError")));
          return;
        }
        processingRequest.current = request;
        setProcessing(true);
        try {
          const file = await prepareRecordedAudio(blob);
          // Encoding/decoding can finish after this editor has been closed or
          // a newer recording has started. Never deliver a stale attachment.
          if (mounted.current && request === generation.current)
            done.current(file);
        } catch (cause) {
          if (mounted.current && request === generation.current)
            error.current(new Error(t("calendar_status_saveError"), { cause }));
        } finally {
          if (processingRequest.current === request)
            processingRequest.current = null;
          if (mounted.current && request === generation.current)
            setProcessing(false);
        }
      };
      rec.onerror = (event) => {
        failed = true;
        if (mounted.current && request === generation.current)
          error.current(event);
        if (rec.state === "recording") rec.stop();
        else {
          clearInterval(timer.current);
          media?.getTracks().forEach((track) => track.stop());
          if (recorder.current === rec) recorder.current = null;
          if (stream.current === media) stream.current = null;
          if (mounted.current && request === generation.current)
            setRecording(false);
        }
      };
      rec.start(250);
      setRecording(true);
      setSeconds(0);
      const started = Date.now();
      timer.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        setSeconds(elapsed);
        if (maxSeconds && elapsed >= maxSeconds && rec.state === "recording")
          rec.stop();
      }, 250);
    } catch (cause) {
      media?.getTracks().forEach((track) => track.stop());
      if (stream.current === media) stream.current = null;
      if (request === generation.current) recorder.current = null;
      if (mounted.current && request === generation.current) {
        setRecording(false);
        error.current(cause);
      }
    } finally {
      if (starting.current === request) starting.current = null;
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      starting.current = null;
      processingRequest.current = null;
      clearInterval(timer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.onerror = null;
        if (recorder.current.state === "recording") recorder.current.stop();
        recorder.current = null;
      }
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, []);

  return { recording, processing, seconds, start, stop };
}
