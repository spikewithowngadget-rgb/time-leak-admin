import { useEffect, useState } from "react";
import {
  Mic,
  Square,
  Trash2,
  File as FileIcon,
  Repeat2,
  CalendarDays,
} from "lucide-react";
import Modal from "./Modal";
import { AudioPlayer } from "./Media";
import { useRecorder } from "./recorder";
import { notesApi, errorMessage } from "./api";
import { duration, fileType, parseDate, formatSize } from "./utils";
import type { Note, Lifecycle } from "./types";
import { translate as t, getLocale } from "./i18n";
import { MAX_FILE_MB, MAX_UPLOAD_BYTES } from "./config";
export default function NoteEditor({
  date,
  file,
  note,
  onClose,
  onSaved,
  notify,
}: {
  date: string;
  file?: File;
  note?: Note;
  onClose: () => void;
  onSaved: () => void;
  notify: (m: string) => void;
}) {
  const defaultTitle = t("calendar_defaultNoteTitle", {
    date: new Intl.DateTimeFormat(getLocale(), {
      day: "numeric",
      month: "long",
    }).format(parseDate(date)),
  });
  const [title, setTitle] = useState(note?.title || defaultTitle);
  const [lifecycle, setLifecycle] = useState<Lifecycle>(
    note?.lifecycle || "one_time",
  );
  const [rule, setRule] = useState(note?.recurrence_rule || "FREQ=YEARLY");
  const [audio, setAudio] = useState<File>();
  const [audioUrl, setAudioUrl] = useState("");
  const [removeAudio, setRemoveAudio] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!audio) {
      setAudioUrl("");
      return;
    }
    const url = URL.createObjectURL(audio);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audio]);
  const recorder = useRecorder(
    setAudio,
    (e) => notify(errorMessage(e, t("web_microphoneDenied"))),
    30,
  );
  const save = async (skip = false) => {
    if (busy || recorder.recording || recorder.processing) return;
    if ((file?.size || 0) + (skip ? 0 : audio?.size || 0) > MAX_UPLOAD_BYTES) {
      notify(t("web_fileTooLarge", { size: MAX_FILE_MB }));
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append("title", skip ? defaultTitle : title.trim() || defaultTitle);
      form.append("note_date", date);
      form.append(
        "note_type",
        note?.note_type || (file ? fileType(file) : "document"),
      );
      form.append("lifecycle", lifecycle);
      form.append("recurrence_rule", lifecycle === "recurring" ? rule : "");
      if (file) form.append("files", file);
      if (audio && !skip) form.append("title_audio", audio);
      if (note) {
        await notesApi.update(note.id, form, setProgress);
        if (removeAudio && !audio) await notesApi.deleteTitleAudio(note.id);
      } else await notesApi.create(form, setProgress);
      notify(t("calendar_status_fileSaved"));
      onSaved();
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={t(note ? "noteSheet_titleEdit" : "noteSheet_titleNew")}
      onClose={onClose}
      busy={busy || recorder.recording || recorder.processing}
    >
      <div className="note-editor">
        <div className="editor-date">
          <CalendarDays size={16} />
          {new Intl.DateTimeFormat(getLocale(), { dateStyle: "long" }).format(
            parseDate(date),
          )}
        </div>
        {file && (
          <div className="editor-file">
            <FileIcon size={24} />
            <span>{file.name}</span>
            <small>{formatSize(file.size)}</small>
          </div>
        )}
        <label className="editor-label" htmlFor="note-title">
          {t("noteSheet_titleNew")}
        </label>
        <div className="editor-title">
          <input
            id="note-title"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy || recorder.recording || recorder.processing}
          />
          <button
            className={`icon-btn ${recorder.recording ? "recording" : ""}`}
            aria-label={t("web_voice")}
            disabled={busy}
            onClick={() =>
              recorder.recording ? recorder.stop() : void recorder.start()
            }
          >
            {recorder.recording ? (
              <Square size={20} fill="currentColor" />
            ) : (
              <Mic size={22} />
            )}
          </button>
        </div>
        {recorder.recording && (
          <div className="recording-status">
            <i />
            {t("noteSheet_recording", { time: duration(recorder.seconds) })}
          </div>
        )}
        {audioUrl ? (
          <div className="editor-audio">
            <audio src={audioUrl} controls />
            <button
              className="icon-btn danger"
              aria-label={t("calendar_action_delete")}
              onClick={() => setAudio(undefined)}
            >
              <Trash2 size={19} />
            </button>
          </div>
        ) : note?.title_audio_url && !removeAudio ? (
          <div className="editor-audio">
            <AudioPlayer url={note.title_audio_url} compact />
            <button
              className="icon-btn danger"
              aria-label={t("calendar_action_delete")}
              onClick={() => setRemoveAudio(true)}
            >
              <Trash2 size={19} />
            </button>
          </div>
        ) : null}
        <label className="editor-label">{t("noteSheet_typeLabel")}</label>
        <div className="chips">
          <button
            className={`chip ${lifecycle === "one_time" ? "active" : ""}`}
            onClick={() => setLifecycle("one_time")}
            disabled={busy}
          >
            {t("noteSheet_oneTime")}
          </button>
          <button
            className={`chip ${lifecycle === "recurring" ? "active" : ""}`}
            onClick={() => setLifecycle("recurring")}
            disabled={busy}
          >
            <Repeat2 size={15} />
            {t("noteSheet_recurring")}
          </button>
        </div>
        {lifecycle === "recurring" && (
          <div className="chips recurrence-chips">
            {[
              ["FREQ=YEARLY", "noteSheet_yearly"],
              ["FREQ=MONTHLY", "noteSheet_monthly"],
              ["FREQ=WEEKLY", "noteSheet_weekly"],
            ].map(([value, key]) => (
              <button
                key={value}
                className={`chip ${rule === value ? "active" : ""}`}
                disabled={busy}
                onClick={() => setRule(value)}
              >
                {t(key)}
              </button>
            ))}
          </div>
        )}
        {busy && (
          <div
            className="upload-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <i style={{ width: `${progress}%` }} />
            <span>{progress}%</span>
          </div>
        )}
        <div className="modal-actions">
          <button
            className="btn btn-outlined"
            disabled={busy || recorder.recording || recorder.processing}
            onClick={() => (note ? onClose() : void save(true))}
          >
            {t(note ? "common_cancel" : "common_skip")}
          </button>
          <button
            className="btn btn-save"
            disabled={busy || recorder.recording || recorder.processing}
            onClick={() => void save()}
          >
            {busy ? <span className="spinner" /> : t("common_save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
