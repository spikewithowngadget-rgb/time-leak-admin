export type NoteType = "image" | "video" | "audio" | "document";
export type Lifecycle = "one_time" | "recurring";
export interface TokenPair {
  access_token: string;
  refresh_token: string;
}
export interface OtpRequest {
  request_id: string;
  expires_in_seconds: number;
}
export interface EmailOtpRequest extends OtpRequest {
  email: string;
  resend_after_seconds: number;
}
export interface OtpVerification {
  verification_token: string;
  phone: string;
  purpose?: string;
}
export interface UserProfile {
  userId: string;
  email: string;
  phone: string;
  userLanguage: string;
  createdAt: string;
}
export interface EmailReminderContact {
  email: string;
  verified_at: string | null;
  enabled: boolean;
  language: string;
}
export interface NoteMeta {
  id: string;
  note_type: NoteType;
  note_date?: string;
  note_date_source?: string;
  file_count: number;
  file_type: NoteType | "";
  createdAt: string;
  title?: string;
  lifecycle: Lifecycle;
  is_completed: boolean;
  occurrences: string[];
  recurrence_rule?: string | null;
}
export interface Note extends NoteMeta {
  userId: string;
  note_files: string[];
  title_audio_url?: string | null;
}
export interface NotesMetaResponse {
  data: NoteMeta[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}
export interface NotesByDateResponse {
  data: Note[];
  total: number;
}
export interface SharedNote {
  id: string;
  title?: string;
  note_type: NoteType;
  note_date?: string;
  note_files: string[];
  file_sizes: number[];
  title_audio_url?: string | null;
  lifecycle: Lifecycle;
  recurrence_rule?: string | null;
  is_completed: boolean;
  shared_by: string;
  expires_at: string;
}
export interface NoteShare {
  share_url: string;
  share_token: string;
  expires_at: string;
}
export interface Ad {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
