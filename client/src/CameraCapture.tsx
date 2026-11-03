import { useEffect, useRef, useState } from "react";
import { Camera, Video, Square, RotateCcw, Check } from "lucide-react";
import Modal from "./Modal";
import { translate as t } from "./i18n";
export default function CameraCapture({
  videoMode,
  onClose,
  onDone,
  onFallback,
  notify,
}: {
  videoMode: boolean;
  onClose: () => void;
  onDone: (file: File) => void;
  onFallback: () => void;
  notify: (message: string) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState("");
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (videoMode && !window.MediaRecorder) {
      notify(t("web_recordingUnsupported"));
      onFallback();
      return;
    }
    void (async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: videoMode,
        });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        if (ref.current) ref.current.srcObject = media;
        setReady(true);
      } catch {
        if (!cancelled) {
          notify(t("web_cameraDenied"));
          onFallback();
        }
      }
    })();
    return () => {
      cancelled = true;
      if (recorder.current) {
        recorder.current.onstop = null;
        recorder.current.onerror = null;
        if (recorder.current.state === "recording") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);
  useEffect(() => {
    if (!file) {
      setPreview("");
      if (ref.current) ref.current.srcObject = stream.current;
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const capture = () => {
    if (videoMode) {
      if (recording) {
        recorder.current?.stop();
        return;
      }
      try {
        if (!window.MediaRecorder) throw new Error("unsupported");
        const mime = [
          "video/mp4",
          "video/webm;codecs=vp9,opus",
          "video/webm",
        ].find((m) => MediaRecorder.isTypeSupported(m));
        const rec = new MediaRecorder(
          stream.current!,
          mime ? { mimeType: mime } : undefined,
        );
        const chunks: BlobPart[] = [];
        rec.ondataavailable = (e) => {
          if (e.data.size) chunks.push(e.data);
        };
        rec.onstop = () => {
          const type = rec.mimeType;
          setFile(
            new File(
              chunks,
              `video-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`,
              { type },
            ),
          );
          setRecording(false);
        };
        rec.onerror = () => {
          rec.onstop = null;
          stream.current?.getTracks().forEach((track) => track.stop());
          setRecording(false);
          notify(t("web_recordingUnsupported"));
          onFallback();
        };
        rec.start(250);
        recorder.current = rec;
        setRecording(true);
      } catch {
        stream.current?.getTracks().forEach((track) => track.stop());
        notify(t("web_recordingUnsupported"));
        onFallback();
      }
    } else {
      const video = ref.current!;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (blob)
            setFile(
              new File([blob], `photo-${Date.now()}.jpg`, {
                type: "image/jpeg",
              }),
            );
        },
        "image/jpeg",
        0.92,
      );
    }
  };
  return (
    <Modal
      title={t(videoMode ? "calendar_cameraVideo" : "calendar_cameraPhoto")}
      onClose={onClose}
      busy={recording}
      className="camera-modal"
    >
      <div className="camera-view">
        {file ? (
          videoMode ? (
            <video src={preview} controls playsInline />
          ) : (
            <img src={preview} alt={t("web_cameraPhoto")} />
          )
        ) : (
          <video ref={ref} autoPlay muted playsInline />
        )}
      </div>
      <div className="modal-actions">
        {file ? (
          <>
            <button
              className="btn btn-outlined"
              onClick={() => setFile(undefined)}
            >
              <RotateCcw size={18} />
              {t("web_retake")}
            </button>
            <button className="btn btn-save" onClick={() => onDone(file)}>
              <Check size={18} />
              {t("web_usePhoto")}
            </button>
          </>
        ) : (
          <button className="btn btn-save" disabled={!ready} onClick={capture}>
            {recording ? (
              <Square size={20} />
            ) : videoMode ? (
              <Video size={20} />
            ) : (
              <Camera size={20} />
            )}{" "}
            {t(recording ? "web_stopRecording" : "web_capture")}
          </button>
        )}
      </div>
    </Modal>
  );
}
