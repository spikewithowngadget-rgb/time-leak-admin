import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Mic,
  Images,
  FileText,
  CalendarDays,
  Plus,
  Square,
  Repeat2,
  Pencil,
  Trash2,
  Download,
  Share2,
  Link,
  Send,
  MessageCircle,
  ArrowUpRight,
  CloudUpload,
  Check,
  RefreshCw,
} from "lucide-react";
import { notesApi, getAd, errorMessage } from "./api";
import { Attachment, AudioPlayer, downloadFile } from "./Media";
import NoteEditor from "./NoteEditor";
import CameraCapture from "./CameraCapture";
import Modal from "./Modal";
import { useRecorder } from "./recorder";
import {
  dateKey,
  parseDate,
  monthDays,
  noteDates,
  badgeCount,
  duration,
  safeUrl,
} from "./utils";
import { translate as t, getLocale } from "./i18n";
import type { Note, NoteMeta, SharedNote } from "./types";
export function NoteCard({
  note,
  isPublic = false,
  onEdit,
  onDelete,
  onShare,
  notify,
}: {
  note: Note | SharedNote;
  isPublic?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  notify: (m: string) => void;
}) {
  return (
    <article className={`note-card ${note.is_completed ? "completed" : ""}`}>
      <div className="note-card-heading">
        {note.lifecycle === "recurring" && <Repeat2 size={18} />}
        <h3>{note.title || t("web_type_" + note.note_type)}</h3>
        {note.title_audio_url && <Mic size={17} />}{" "}
        {onEdit && (
          <button
            className="icon-btn"
            aria-label={t("noteSheet_titleEdit")}
            onClick={onEdit}
          >
            <Pencil size={20} />
          </button>
        )}
      </div>
      {note.title_audio_url && (
        <AudioPlayer url={note.title_audio_url} isPublic={isPublic} compact />
      )}
      {note.note_files.map((url, i) => (
        <Attachment
          key={`${url}-${i}`}
          url={url}
          type={note.note_type}
          isPublic={isPublic}
        />
      ))}
      <div className="note-actions">
        {onDelete && (
          <button onClick={onDelete}>
            <Trash2 size={20} />
            <span>{t("calendar_action_delete")}</span>
          </button>
        )}
        <button
          onClick={() =>
            void Promise.all(
              note.note_files.map((url) => downloadFile(url, isPublic)),
            ).catch((e) => notify(errorMessage(e)))
          }
        >
          <Download size={20} />
          <span>{t("calendar_action_download")}</span>
        </button>
        {onShare && (
          <button onClick={onShare}>
            <Share2 size={20} />
            <span>{t("share_title")}</span>
          </button>
        )}
      </div>
    </article>
  );
}
export function AdBanner() {
  const { data: ad } = useQuery({
    queryKey: ["ad"],
    queryFn: getAd,
    retry: false,
    refetchOnWindowFocus: false,
  });
  if (
    !ad?.is_active ||
    !ad.image_url ||
    !safeUrl(ad.target_url) ||
    !safeUrl(ad.image_url)
  )
    return null;
  return (
    <a
      className="ad-banner"
      href={safeUrl(ad.target_url)}
      target="_blank"
      rel="noopener noreferrer"
    >
      <img src={safeUrl(ad.image_url)} alt="" />
      <span className="ad-label">Ad</span>
      <strong>{ad.title}</strong>
      <i>
        <ArrowUpRight size={24} />
      </i>
    </a>
  );
}
export default function Calendar({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const today = dateKey(new Date());
  const current = parseDate(today);
  const deepDate = new URLSearchParams(location.search).get("date");
  const initial =
    deepDate && /^\d{4}-\d{2}-\d{2}$/.test(deepDate)
      ? dateKey(parseDate(deepDate))
      : "";
  const [month, setMonth] = useState(() =>
    initial ? parseDate(initial) : current,
  );
  const [selected, setSelected] = useState(initial);
  const [editor, setEditor] = useState<{
    date: string;
    file?: File;
    note?: Note;
  }>();
  const [cameraChoice, setCameraChoice] = useState(false);
  const [camera, setCamera] = useState<"photo" | "video">();
  const [deleting, setDeleting] = useState<Note>();
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<{ url: string; title: string }>();
  const [dragging, setDragging] = useState(false);
  const [pendingDate, setPendingDate] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const years = useRef<HTMLDivElement>(null);
  const from = dateKey(new Date(current.getFullYear(), current.getMonth(), 1));
  const to = `${current.getFullYear() + 10}-12-31`;
  const metaQuery = useQuery({
    queryKey: ["meta", from, to],
    queryFn: () => notesApi.meta(from, to),
  });
  const past =
    month.getFullYear() < current.getFullYear() ||
    (month.getFullYear() === current.getFullYear() &&
      month.getMonth() < current.getMonth());
  const monthFrom = dateKey(new Date(month.getFullYear(), month.getMonth(), 1));
  const monthTo = dateKey(
    new Date(month.getFullYear(), month.getMonth() + 1, 0),
  );
  const pastQuery = useQuery({
    queryKey: ["meta", monthFrom, monthTo],
    queryFn: () => notesApi.meta(monthFrom, monthTo),
    enabled: past,
  });
  const meta = [
    ...new Map(
      [...(metaQuery.data || []), ...(pastQuery.data || [])].map((n) => [
        n.id,
        n,
      ]),
    ).values(),
  ];
  const dated = new Map<string, NoteMeta[]>();
  for (const note of meta)
    for (const day of noteDates(note))
      dated.set(day, [...(dated.get(day) || []), note]);
  const notesQuery = useQuery({
    queryKey: ["notes", selected],
    queryFn: async () => {
      const list = await notesApi.byDate(selected);
      const missing = (dated.get(selected) || []).filter(
        (n) => n.lifecycle === "recurring" && !list.some((x) => x.id === n.id),
      );
      return [
        ...list,
        ...(await Promise.all(missing.map((n) => notesApi.get(n.id)))),
      ];
    },
    enabled: !!selected,
  });
  useEffect(() => {
    const e = metaQuery.error || pastQuery.error || notesQuery.error;
    if (e) notify(errorMessage(e));
  }, [metaQuery.error, pastQuery.error, notesQuery.error]);
  const noteCount = meta.reduce(
    (count, n) =>
      count +
      noteDates(n).filter(
        (d) => d >= today && !(n.is_completed && n.lifecycle !== "recurring"),
      ).length,
    0,
  );
  useEffect(() => {
    document.title = `${noteCount ? `(${noteCount}) ` : ""}TimeLeak`;
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>;
    };
    void nav.setAppBadge?.(noteCount).catch(() => {});
  }, [noteCount]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]"))
        setSelected("");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  const recorder = useRecorder(
    (file) => setEditor({ date: pendingDate || selected || today, file }),
    (e) => notify(errorMessage(e, t("web_microphoneDenied"))),
  );
  const choose = (date: string) => {
    setSelected(date);
    setMonth(parseDate(date));
    const url = new URL(location.href);
    url.searchParams.set("date", date);
    history.replaceState({}, "", url);
  };
  const ensureDate = () => {
    if (selected) return selected;
    if (
      month.getFullYear() === current.getFullYear() &&
      month.getMonth() === current.getMonth()
    ) {
      choose(today);
      return today;
    }
    notify(t("calendar_selectDayFirst"));
    return "";
  };
  const pickFile = (accept: string, capture = false, date?: string) => {
    const day = date || ensureDate();
    if (!day) return;
    setPendingDate(day);
    const el = input.current!;
    el.accept = accept;
    el.value = "";
    if (capture) el.setAttribute("capture", "environment");
    else el.removeAttribute("capture");
    el.click();
  };
  const openCamera = (mode: "photo" | "video") => {
    setCameraChoice(false);
    const day = ensureDate();
    if (!day) return;
    setPendingDate(day);
    if (
      matchMedia("(pointer: coarse)").matches ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      pickFile(mode === "photo" ? "image/*" : "video/*", true, day);
      return;
    }
    setCamera(mode);
  };
  const shiftMonth = (delta: number) => {
    if (recorder.recording) return;
    setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  };
  const refreshed = () => {
    setEditor(undefined);
    void queryClient.invalidateQueries({ queryKey: ["notes"] });
    void queryClient.invalidateQueries({ queryKey: ["meta"] });
  };
  const drop = (files: FileList, date?: string) => {
    setDragging(false);
    if (files.length > 1) {
      notify(t("web_oneFile"));
      return;
    }
    const day = date || ensureDate();
    if (files[0] && day) {
      choose(day);
      setEditor({ date: day, file: files[0] });
    }
  };
  const deleteNote = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await notesApi.remove(deleting.id);
      setDeleting(undefined);
      refreshed();
      notify(t("calendar_status_fileDeleted"));
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const startShare = async (note: Note) => {
    try {
      const result = await notesApi.share(note.id);
      setShare({ url: result.share_url, title: note.title || "TimeLeak" });
    } catch (e) {
      notify(errorMessage(e));
    }
  };
  const weekdayFormatter = new Intl.DateTimeFormat(getLocale(), {
    weekday: "short",
  });
  const futureDates = [...dated.keys()].filter((d) => d >= today);
  const monthTitle = new Intl.DateTimeFormat(getLocale(), {
    month: "long",
  }).format(month);
  return (
    <main className="workspace">
      <input
        ref={input}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setEditor({ date: pendingDate || selected || today, file });
        }}
      />
      <aside className="calendar-column">
        <div className="calendar-panel">
          <div className="calendar-panel-title">
            <span>
              <CalendarDays size={19} />
              {t("web_calendar")}
            </span>
            <button
              className="today-button"
              onClick={() => {
                setMonth(current);
                choose(today);
              }}
            >
              {t("web_today")}
            </button>
          </div>
          <div className="year-selector">
            <button
              className="icon-btn"
              aria-label={t("web_previousYears")}
              onClick={() =>
                years.current?.scrollBy({ left: -140, behavior: "smooth" })
              }
            >
              <ChevronLeft size={20} />
            </button>
            <div ref={years} className="year-scroll">
              {Array.from(
                { length: 11 },
                (_, i) => current.getFullYear() + i,
              ).map((year) => (
                <button
                  key={year}
                  className={`year-pill ${month.getFullYear() === year ? "selected" : ""}`}
                  onClick={() => setMonth(new Date(year, month.getMonth(), 1))}
                >
                  {year}
                  {futureDates.some((d) => d.startsWith(`${year}-`)) && <i />}
                </button>
              ))}
            </div>
            <button
              className="icon-btn"
              aria-label={t("web_nextYears")}
              onClick={() =>
                years.current?.scrollBy({ left: 140, behavior: "smooth" })
              }
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="month-selector">
            <button
              className="icon-btn"
              aria-label={t("web_previousMonth")}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft size={24} />
              {futureDates.some(
                (d) =>
                  d >=
                    dateKey(
                      new Date(month.getFullYear(), month.getMonth() - 1, 1),
                    ) && d < monthFrom,
              ) && <i />}
            </button>
            <h2>
              {monthTitle}
              <small>{month.getFullYear()}</small>
            </h2>
            <button
              className="icon-btn"
              aria-label={t("web_nextMonth")}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight size={24} />
              {futureDates.some((d) => d > monthTo) && <i />}
            </button>
          </div>
          <div className="weekdays">
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>
                {weekdayFormatter.format(new Date(2026, 10, 2 + i))}
              </span>
            ))}
          </div>
          <div
            className={`calendar-grid ${metaQuery.isPending ? "loading" : ""}`}
          >
            {monthDays(month).map((date) => {
              const key = dateKey(date);
              const own = date.getMonth() === month.getMonth();
              const badge = badgeCount(dated.get(key) || [], key, today);
              return (
                <button
                  key={key}
                  aria-label={new Intl.DateTimeFormat(getLocale(), {
                    dateStyle: "full",
                  }).format(date)}
                  aria-pressed={selected === key}
                  className={`day ${own ? "panel3d" : "other-month"} ${selected === key ? "selected" : ""} ${key === today ? "today" : ""}`}
                  onClick={() => choose(key)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add("drag-over");
                  }}
                  onDragLeave={(e) =>
                    e.currentTarget.classList.remove("drag-over")
                  }
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove("drag-over");
                    drop(e.dataTransfer.files, key);
                  }}
                >
                  <span>{date.getDate()}</span>
                  {badge > 0 && (
                    <b className={key === today ? "today-badge" : ""}>
                      {badge}
                    </b>
                  )}
                </button>
              );
            })}
          </div>
          {recorder.recording && (
            <div className="recording-status">
              <button
                className="icon-btn danger"
                aria-label={t("web_stopRecording")}
                onClick={recorder.stop}
              >
                <Square size={20} fill="currentColor" />
              </button>
              <i />
              {t("calendar_recordingStatus", {
                duration: duration(recorder.seconds),
              })}
            </div>
          )}
          <div className="calendar-legend">
            <i />
            {t("web_today")}
            <span />
            {t("web_filesOnDay")}
          </div>
        </div>
        <div className="capture-panel panel3d">
          {[
            {
              icon: Camera,
              key: "web_camera",
              action: () => {
                if (ensureDate()) setCameraChoice(true);
              },
            },
            {
              icon: recorder.recording ? Square : Mic,
              key: recorder.recording ? "web_stopRecording" : "web_voice",
              action: () => {
                if (recorder.recording) {
                  recorder.stop();
                  return;
                }
                const day = ensureDate();
                if (day) {
                  setPendingDate(day);
                  void recorder.start();
                }
              },
            },
            {
              icon: Images,
              key: "web_gallery",
              action: () => pickFile("image/*"),
            },
            {
              icon: FileText,
              key: "web_document",
              action: () => pickFile("*/*"),
            },
          ].map(({ icon: Icon, key, action }) => (
            <button
              key={key}
              className="capture-action"
              disabled={
                recorder.processing ||
                (recorder.recording && key !== "web_stopRecording")
              }
              onClick={action}
            >
              <span className="capture-icon panel3d">
                <Icon size={26} />
              </span>
              <span>{t(key)}</span>
            </button>
          ))}
        </div>
        <p className="calendar-help">
          <CloudUpload size={16} />
          {t("web_dropHint")}
        </p>
      </aside>
      <section
        className={`notes-column ${dragging ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          drop(e.dataTransfer.files);
        }}
      >
        <div className="notes-heading">
          <div>
            <p className="eyebrow">{t("web_yourCalendar")}</p>
            <h1>
              {selected
                ? new Intl.DateTimeFormat(getLocale(), {
                    day: "numeric",
                    month: "long",
                  }).format(parseDate(selected))
                : t("web_myNotes")}
            </h1>
            {selected && (
              <p>
                {new Intl.DateTimeFormat(getLocale(), {
                  weekday: "long",
                  year: "numeric",
                }).format(parseDate(selected))}
                <span className="note-count">
                  {notesQuery.data?.length || 0}
                </span>
              </p>
            )}
          </div>
          {selected && (
            <button
              className="add-button"
              aria-label={t("web_addNote")}
              onClick={() => pickFile("*/*")}
            >
              <Plus size={20} />
              <span>{t("web_addNote")}</span>
            </button>
          )}
        </div>
        {selected && notesQuery.isPending ? (
          <div className="notes-loading">
            <span className="spinner" />
            {t("web_loading")}
          </div>
        ) : selected && notesQuery.isError ? (
          <div className="empty-state">
            <RefreshCw size={44} />
            <p>{t("web_loadError")}</p>
            <button
              className="btn btn-outlined"
              onClick={() => void notesQuery.refetch()}
            >
              {t("web_retry")}
            </button>
          </div>
        ) : notesQuery.data?.length && selected ? (
          <div className="notes-list">
            {notesQuery.data.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                notify={notify}
                onEdit={() =>
                  setEditor({ date: note.note_date || selected, note })
                }
                onDelete={() => setDeleting(note)}
                onShare={() => void startShare(note)}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-illustration">
              <CalendarDays size={62} strokeWidth={1.2} />
              <span>
                <Plus size={20} />
              </span>
              <i />
              <b />
            </div>
            <h2>{t(selected ? "web_noNotes" : "calendar_selectDayFirst")}</h2>
            <p>
              {t(
                selected
                  ? "web_noNotesDescription"
                  : "web_selectDayDescription",
              )}
            </p>
            {selected && (
              <button
                className="btn btn-outlined"
                onClick={() => pickFile("*/*")}
              >
                <Plus size={18} />
                {t("web_addFirstNote")}
              </button>
            )}
            <div className="drop-hint">
              <CloudUpload size={18} />
              {t("web_dropFile")}
            </div>
          </div>
        )}
        <AdBanner />
        <div className="sync-note">
          <Check size={14} />
          {t("web_syncHint")}
        </div>
      </section>
      {editor && (
        <NoteEditor
          {...editor}
          notify={notify}
          onClose={() => setEditor(undefined)}
          onSaved={refreshed}
        />
      )}{" "}
      {cameraChoice && (
        <Modal
          title={t("calendar_cameraSheetTitle")}
          onClose={() => setCameraChoice(false)}
        >
          <div className="camera-choices">
            <button onClick={() => openCamera("photo")}>
              <Camera size={30} />
              {t("calendar_cameraPhoto")}
            </button>
            <button onClick={() => openCamera("video")}>
              <VideoIcon />
              {t("calendar_cameraVideo")}
            </button>
          </div>
        </Modal>
      )}
      {camera && (
        <CameraCapture
          videoMode={camera === "video"}
          notify={notify}
          onClose={() => setCamera(undefined)}
          onDone={(file) => {
            setCamera(undefined);
            setEditor({ date: pendingDate || selected || today, file });
          }}
          onFallback={() => {
            const mode = camera;
            setCamera(undefined);
            pickFile(
              mode === "photo" ? "image/*" : "video/*",
              false,
              pendingDate,
            );
          }}
        />
      )}
      {deleting && (
        <Modal
          title={t("web_deleteConfirmTitle")}
          onClose={() => setDeleting(undefined)}
          busy={busy}
        >
          <p className="dialog-description">{t("web_deleteConfirmBody")}</p>
          <div className="modal-actions">
            <button
              className="btn btn-outlined"
              disabled={busy}
              onClick={() => setDeleting(undefined)}
            >
              {t("common_cancel")}
            </button>
            <button
              className="btn btn-save"
              disabled={busy}
              onClick={() => void deleteNote()}
            >
              {busy ? (
                <span className="spinner" />
              ) : (
                t("calendar_action_delete")
              )}
            </button>
          </div>
        </Modal>
      )}
      {share && (
        <Modal title={t("share_title")} onClose={() => setShare(undefined)}>
          <div className="share-options">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${share.title} — ${share.url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="whatsapp">
                <MessageCircle size={25} />
              </i>
              WhatsApp
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(share.url)}&text=${encodeURIComponent(share.title)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="telegram">
                <Send size={25} />
              </i>
              Telegram
            </a>
            <button
              onClick={() =>
                void navigator.clipboard
                  .writeText(share.url)
                  .then(() => notify(t("web_linkCopied")))
                  .catch((e) => notify(errorMessage(e)))
              }
            >
              <i>
                <Link size={25} />
              </i>
              {t("web_copyLink")}
            </button>
            {!!navigator.share && (
              <button
                onClick={() =>
                  void navigator
                    .share({ title: share.title, url: share.url })
                    .catch(() => {})
                }
              >
                <i>
                  <Share2 size={25} />
                </i>
                {t("web_more")}
              </button>
            )}
          </div>
          <input
            className="share-url"
            readOnly
            value={share.url}
            aria-label={t("web_copyLink")}
          />
        </Modal>
      )}
    </main>
  );
}
function VideoIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <rect x="2" y="5" width="14" height="14" rx="3" />
      <path d="m16 9 6-3v12l-6-3" />
    </svg>
  );
}
