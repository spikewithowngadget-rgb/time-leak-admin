import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Play,
  Pause,
  FileText,
  Image as ImageIcon,
  Video,
  Download,
  TriangleAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { fetchNoteFile } from "./api";
import { duration, fileName, formatSize } from "./utils";
import type { NoteType } from "./types";
import Modal from "./Modal";
import { translate as t } from "./i18n";
export function useNoteFile(url: string | undefined, isPublic = false) {
  const query = useQuery({
    queryKey: ["file", url, isPublic],
    queryFn: () => fetchNoteFile(url!, isPublic),
    enabled: !!url,
    staleTime: 600000,
    gcTime: 600000,
  });
  const [src, setSrc] = useState("");
  useEffect(() => {
    if (!query.data) {
      setSrc("");
      return;
    }
    const objectUrl = URL.createObjectURL(query.data);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);
  return { ...query, src };
}
export async function downloadFile(
  url: string,
  isPublic = false,
  name?: string,
) {
  const blob = await fetchNoteFile(url, isPublic);
  const src = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = src;
  anchor.download = name || fileName(url);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(src), 1000);
}
let activeAudio: HTMLAudioElement | null = null;
export function AudioPlayer({
  url,
  isPublic = false,
  compact = false,
}: {
  url: string;
  isPublic?: boolean;
  compact?: boolean;
}) {
  const { src, isError } = useNoteFile(url, isPublic);
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [length, setLength] = useState(0);
  const [broken, setBroken] = useState(false);
  const error = isError || broken;
  const toggle = () => {
    const audio = ref.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    if (activeAudio && activeAudio !== audio) activeAudio.pause();
    activeAudio = audio;
    void audio.play().catch(() => setBroken(true));
  };
  const seek = (value: number) => {
    if (ref.current && Number.isFinite(length) && length > 0)
      ref.current.currentTime = Math.max(0, Math.min(length, value));
  };
  return (
    <div className={`audio-player ${compact ? "compact" : ""}`}>
      <audio
        ref={ref}
        src={src || undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={() => setLength(ref.current?.duration || 0)}
        onTimeUpdate={() => setPosition(ref.current?.currentTime || 0)}
        onEnded={() => {
          setPlaying(false);
          setPosition(0);
          if (ref.current) ref.current.currentTime = 0;
        }}
        onError={() => {
          if (src) setBroken(true);
        }}
      />
      <button
        className="icon-btn audio-play"
        disabled={!src || error}
        aria-label={playing ? t("web_pause") : t("web_play")}
        onClick={toggle}
      >
        {error ? (
          <TriangleAlert size={25} />
        ) : playing ? (
          <Pause size={24} fill="currentColor" />
        ) : (
          <Play size={24} fill="currentColor" />
        )}
      </button>
      <div
        className="waveform"
        role="slider"
        tabIndex={0}
        aria-label={t("web_audioPosition")}
        aria-valuemin={0}
        aria-valuemax={Number.isFinite(length) ? Math.floor(length) : 0}
        aria-valuenow={Math.floor(position)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            seek(position + (e.key === "ArrowRight" ? 5 : -5));
          }
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seek(((e.clientX - rect.left) / rect.width) * length);
        }}
      >
        {Array.from({ length: 45 }, (_, i) => (
          <i
            key={i}
            className={i / 45 <= position / length ? "played" : ""}
            style={{
              height: `${(12 + ((i * 17 + 11) % 29)) * (i < 5 || i > 39 ? 0.3 : i < 10 || i > 34 ? 0.6 : 1)}px`,
            }}
          />
        ))}
      </div>
      <span className="audio-time">
        {error ? "--:--" : duration(length - position)}
      </span>
    </div>
  );
}
function PdfPreview({ data, full = false }: { data: Blob; full?: boolean }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    setLoading(true);
    setError(false);
    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const task = pdfjs.getDocument({
          data: new Uint8Array(await data.arrayBuffer()),
        });
        destroy = () => {
          void task.destroy();
        };
        const pdf = await task.promise;
        if (cancelled) return;
        const container = canvasRef.current!;
        container.replaceChildren();
        for (let i = 1; i <= (full ? pdf.numPages : 1); i++) {
          if (cancelled) break;
          const page = await pdf.getPage(i);
          const width = Math.min(
            full ? 1000 : 600,
            container.clientWidth || 600,
          );
          const initial = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: (width / initial.width) * devicePixelRatio,
          });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          container.appendChild(canvas);
          await page.render({ canvas, viewport }).promise;
        }
        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      destroy?.();
    };
  }, [data, full]);
  return (
    <div className={`pdf-preview ${full ? "pdf-full" : ""}`}>
      <div ref={canvasRef} />
      {loading && <span className="spinner" />}
      {error && (
        <div className="file-placeholder">
          <FileText size={44} />
          <span>PDF</span>
        </div>
      )}
    </div>
  );
}
export function Attachment({
  url,
  type,
  isPublic = false,
}: {
  url: string;
  type: NoteType;
  isPublic?: boolean;
}) {
  const { data, src, isPending, isError } = useNoteFile(url, isPublic);
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [text, setText] = useState("");
  const [imageError, setImageError] = useState(false);
  const name = fileName(url);
  const pdf = /\.pdf$/i.test(name) || data?.type === "application/pdf";
  const textual =
    /\.(txt|md|json|xml|csv|log|ini|ya?ml|html?|js|ts|css|rtf)$/i.test(name) ||
    data?.type.startsWith("text/");
  useEffect(() => {
    let active = true;
    if (data && textual)
      void data
        .slice(0, 2_000_000)
        .text()
        .then((value) => {
          if (active) setText(value);
        });
    return () => {
      active = false;
    };
  }, [data, textual]);
  if (type === "audio") return <AudioPlayer url={url} isPublic={isPublic} />;
  const Icon =
    type === "image" ? ImageIcon : type === "video" ? Video : FileText;
  const view = () => {
    if (
      type === "document" &&
      !pdf &&
      !textual &&
      !data?.type.startsWith("image/")
    )
      void downloadFile(url, isPublic);
    else setOpen(true);
  };
  return (
    <>
      <div className="attachment">
        <button
          className="file-heading"
          onClick={view}
          disabled={isPending || isError}
        >
          <Icon size={22} />
          <span title={name}>{name}</span>
          <small>{data ? formatSize(data.size) : ""}</small>
        </button>
        {isPending ? (
          <div className="file-placeholder">
            <span className="spinner" />
          </div>
        ) : isError || imageError ? (
          <div className="file-placeholder">
            <TriangleAlert size={40} />
            <span>{t("web_fileLoadError")}</span>
          </div>
        ) : type === "image" || data?.type.startsWith("image/") ? (
          <button className="image-preview" aria-label={name} onClick={view}>
            <img src={src} alt={name} onError={() => setImageError(true)} />
          </button>
        ) : type === "video" ? (
          <button
            className="video-preview"
            aria-label={t("web_play")}
            onClick={view}
          >
            <Play size={50} />
          </button>
        ) : pdf && data ? (
          <button className="document-preview" aria-label={name} onClick={view}>
            <PdfPreview data={data} />
          </button>
        ) : textual ? (
          <button className="document-preview text-preview" onClick={view}>
            <pre>{text.slice(0, 2500)}</pre>
          </button>
        ) : null}
      </div>
      {open && (
        <Modal
          title={name}
          onClose={() => {
            setOpen(false);
            setZoom(1);
          }}
          className={
            type === "image" || type === "video"
              ? "media-modal"
              : "document-modal"
          }
        >
          <div className="viewer-toolbar">
            {(type === "image" || pdf) && (
              <>
                <button
                  className="icon-btn"
                  aria-label={t("web_zoomOut")}
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                >
                  <ZoomOut size={21} />
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button
                  className="icon-btn"
                  aria-label={t("web_zoomIn")}
                  onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                >
                  <ZoomIn size={21} />
                </button>
              </>
            )}
            <button
              className="icon-btn"
              aria-label={t("calendar_action_download")}
              onClick={() => void downloadFile(url, isPublic)}
            >
              <Download size={21} />
            </button>
          </div>
          <div
            className="media-viewer"
            onWheel={
              type === "image"
                ? (e) =>
                    setZoom((z) =>
                      Math.max(0.5, Math.min(4, z - e.deltaY * 0.002)),
                    )
                : undefined
            }
          >
            <div style={{ width: `${zoom * 100}%`, minWidth: "50%" }}>
              {type === "image" || data?.type.startsWith("image/") ? (
                <img src={src} alt={name} />
              ) : type === "video" ? (
                <video src={src} controls autoPlay playsInline />
              ) : pdf && data ? (
                <PdfPreview data={data} full />
              ) : (
                <pre className="full-text">{text}</pre>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
