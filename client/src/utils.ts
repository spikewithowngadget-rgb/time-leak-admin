import type { NoteMeta, NoteType } from "./types";
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function parseDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return dateKey(date) === value ? date : new Date();
}
export function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  return Array.from(
    { length: Math.ceil((offset + length) / 7) * 7 },
    (_, i) => new Date(month.getFullYear(), month.getMonth(), 1 - offset + i),
  );
}
export function noteDates(note: NoteMeta) {
  return [
    ...new Set([
      note.note_date || dateKey(new Date(note.createdAt)),
      ...(note.occurrences || []),
    ]),
  ];
}
export function badgeCount(notes: NoteMeta[], day: string, today: string) {
  if (!notes.length) return 0;
  const active = notes.filter(
    (n) => !(n.is_completed && n.lifecycle !== "recurring"),
  );
  if (
    day < today &&
    (!notes.some((n) => n.lifecycle === "recurring") || !active.length)
  )
    return 0;
  return active.length || notes.length;
}
export function fileType(file: File): NoteType {
  return file.type.startsWith("image/")
    ? "image"
    : file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("audio/")
        ? "audio"
        : "document";
}
export function fileName(url: string) {
  try {
    return decodeURIComponent(
      new URL(url, location.origin).pathname.split("/").pop() || "file",
    );
  } catch {
    return "file";
  }
}
export function formatSize(bytes: number) {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1048576
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1048576).toFixed(1)} MB`;
}
export function safeUrl(value: string) {
  try {
    const url = new URL(value, location.origin);
    return ["http:", "https:"].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}
export function duration(seconds: number) {
  if (!Number.isFinite(seconds)) return "--:--";
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}
