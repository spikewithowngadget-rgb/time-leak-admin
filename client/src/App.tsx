import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Menu,
  X,
  Info,
  Languages,
  LogOut,
  ChevronLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ShieldCheck,
  Trash2,
  Download,
  ExternalLink,
} from "lucide-react";
import AuthPages from "./AuthPages";
import ReminderEmail from "./ReminderEmail";
import Calendar, { NoteCard } from "./Calendar";
import Modal from "./Modal";
import {
  AUTH_EVENT,
  accountApi,
  clearSession,
  errorMessage,
  fetchNoteFile,
  getSharedNote,
  getSessionIdentity,
  hasSession,
  notesApi,
} from "./api";
import { getLocale, setLocale, locales, translate as t } from "./i18n";
import { dateKey, parseDate } from "./utils";
import { MAX_FILE_MB, MAX_UPLOAD_BYTES } from "./config";
const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
export default function App() {
  const [path, setPath] = useState(location.pathname);
  const [authenticated, setAuthenticated] = useState(hasSession);
  const [sessionIdentity, setSessionIdentity] = useState(getSessionIdentity);
  const identityRef = useRef(sessionIdentity);
  const [locale, setCurrentLocale] = useState(getLocale);
  const [message, setMessage] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<"logout" | "delete">();
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const snackTimer = useRef<number>(0);
  const drawerRef = useRef<HTMLDialogElement>(null);
  const notify = useCallback((value: string) => {
    clearTimeout(snackTimer.current);
    setMessage(value);
    snackTimer.current = window.setTimeout(() => setMessage(""), 3500);
  }, []);
  const navigate = useCallback((next: string) => {
    history.pushState({}, "", next);
    setPath(new URL(next, location.origin).pathname);
    setMenu(false);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const pop = () => setPath(location.pathname);
    window.addEventListener("popstate", pop);
    const language = () => setCurrentLocale(getLocale());
    window.addEventListener("tl:locale", language);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("tl:locale", language);
      clearTimeout(snackTimer.current);
    };
  }, []);
  useEffect(() => {
    const update = () => {
      const next = hasSession();
      const nextIdentity = getSessionIdentity();
      if (identityRef.current !== nextIdentity) {
        queryClient.clear();
        identityRef.current = nextIdentity;
        setSessionIdentity(nextIdentity);
      }
      setAuthenticated(next);
      if (!next) {
        queryClient.clear();
        setMenu(false);
      }
    };
    window.addEventListener(AUTH_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(AUTH_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [queryClient]);
  const shared = path.startsWith("/share/");
  const guest =
    path === "/onboarding" ||
    path.startsWith("/login") ||
    path.startsWith("/register") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password");
  useEffect(() => {
    if (shared) return;
    if (!authenticated && !guest) {
      const requestedDate = new URLSearchParams(location.search).get("date");
      if (
        path === "/" &&
        requestedDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
        dateKey(parseDate(requestedDate)) === requestedDate
      ) {
        sessionStorage.setItem("tl_return_to", `/?date=${requestedDate}`);
      }
      if (path === "/about" && location.hash === "#email-reminders") {
        sessionStorage.setItem("tl_return_to", "/about#email-reminders");
      }
      const next = localStorage.getItem("tl_onboarding_done")
        ? "/login"
        : "/onboarding";
      history.replaceState({}, "", next);
      setPath(next);
    } else if (authenticated && guest) {
      const token = sessionStorage.getItem("tl_pending_share");
      sessionStorage.removeItem("tl_pending_share");
      const next = token ? `/share/${encodeURIComponent(token)}` : "/";
      history.replaceState({}, "", next);
      setPath(next);
    }
  }, [authenticated, guest, path, shared]);
  useEffect(() => {
    if (menu) drawerRef.current?.showModal();
    else drawerRef.current?.close();
  }, [menu]);
  const logout = () => {
    clearSession();
    queryClient.clear();
    setConfirm(undefined);
    navigate("/login");
  };
  const deleteAccount = async () => {
    setBusy(true);
    try {
      const profile = await accountApi.me();
      await accountApi.remove(profile.userId);
      logout();
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const languageSelect = (
    <select
      aria-label={t("drawer_language")}
      value={locale}
      onChange={(e) => setLocale(e.target.value)}
    >
      {locales.map((l) => (
        <option value={l.code} key={l.code}>
          {l.nativeName}
        </option>
      ))}
    </select>
  );
  return (
    <div className="app" lang={locale}>
      {message && (
        <button
          className="top-snackbar"
          role="status"
          onClick={() => setMessage("")}
        >
          <Check size={18} />
          <span>{message}</span>
          <X size={17} />
        </button>
      )}
      {!authenticated && !guest && !shared ? (
        <div className="notes-loading">
          <span className="spinner" />
        </div>
      ) : path === "/onboarding" ? (
        <Onboarding navigate={navigate} />
      ) : guest ? (
        <AuthPages
          key={path}
          path={path}
          navigate={navigate}
          notify={notify}
          t={t}
        />
      ) : (
        <>
          <header className="site-header">
            <a
              href="/"
              className="brand"
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
            >
              TimeLeak<span className="web-badge">web</span>
            </a>
            <div className="header-right">
              <span className="header-caption">{t("web_headerCaption")}</span>
              <button
                className="icon-btn menu-button"
                aria-label={t("web_menu")}
                aria-expanded={menu}
                onClick={() => setMenu(true)}
              >
                <Menu size={26} />
              </button>
            </div>
          </header>
          {shared ? (
            <SharedPage
              token={path.slice(7).replace(/\/$/, "")}
              authenticated={authenticated}
              navigate={navigate}
              notify={notify}
            />
          ) : path === "/about" ? (
            <main className="about-page">
              <button className="back-link" onClick={() => navigate("/")}>
                <ChevronLeft size={20} />
                {t("web_backToCalendar")}
              </button>
              <h1>{t("about_title")}</h1>
              <div className="about-brand brand">TimeLeak</div>
              <div className="version-row">
                <span>{t("about_versionLabel")}</span>
                <strong>Web 1.0.0</strong>
              </div>
              <p>{t("about_description")}</p>
              <p>{t("about_reference")}</p>
              <ReminderEmail notify={notify} />
              <div className="account-note">
                <ShieldCheck size={22} />
                {t("web_accountHint")}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setConfirm("logout")}
              >
                {t("drawer_logout")}
              </button>
              <button
                className="btn btn-outlined"
                onClick={() => setConfirm("delete")}
              >
                {t("about_deleteAccount")}
              </button>
            </main>
          ) : (
            <Calendar key={sessionIdentity || "pending"} notify={notify} />
          )}
        </>
      )}
      <dialog
        ref={drawerRef}
        className="drawer"
        onCancel={(e) => {
          e.preventDefault();
          setMenu(false);
        }}
        onClick={(e) => {
          if (e.target === drawerRef.current) setMenu(false);
        }}
      >
        <div className="drawer-body">
          <div className="drawer-header">
            <span className="brand">TimeLeak</span>
            <button
              className="icon-btn"
              aria-label={t("web_close")}
              onClick={() => setMenu(false)}
            >
              <X size={24} />
            </button>
          </div>
          <div className="drawer-content">
            <p className="eyebrow">{t("web_yourSpace")}</p>
            <button onClick={() => navigate("/")}>
              <CalendarDays size={23} />
              {t("web_calendar")}
            </button>
            <button onClick={() => navigate("/about")}>
              <Info size={23} />
              {t("drawer_about")}
            </button>
            <hr />
            <label>
              <Languages size={20} />
              {t("drawer_language")}
            </label>
            {languageSelect}
            <a
              className="privacy-link"
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("web_privacy")}
              <ExternalLink size={14} />
            </a>
            {authenticated ? (
              <button
                className="drawer-logout"
                onClick={() => {
                  setMenu(false);
                  setConfirm("logout");
                }}
              >
                <LogOut size={21} />
                {t("drawer_logout")}
              </button>
            ) : (
              <button onClick={() => navigate("/login")}>
                {t("login_signIn")}
              </button>
            )}
            <p className="drawer-footer">TimeLeak · Web 1.0.0</p>
          </div>
        </div>
      </dialog>
      {confirm && (
        <Modal
          title={t(
            confirm === "logout"
              ? "drawer_logoutConfirmTitle"
              : "about_deleteDialogTitle",
          )}
          onClose={() => setConfirm(undefined)}
          busy={busy}
        >
          <p className="dialog-description">
            {t(
              confirm === "logout"
                ? "drawer_logoutConfirmBody"
                : "about_deleteDialogBody",
            )}
          </p>
          <div className="modal-actions">
            <button
              className="btn btn-outlined"
              onClick={() => setConfirm(undefined)}
              disabled={busy}
            >
              {t("common_cancel")}
            </button>
            <button
              className="btn btn-save"
              disabled={busy}
              onClick={() =>
                confirm === "logout" ? logout() : void deleteAccount()
              }
            >
              {busy ? (
                <span className="spinner" />
              ) : confirm === "logout" ? (
                <>
                  <LogOut size={18} />
                  {t("drawer_logoutConfirmYes")}
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  {t("about_deleteDialogConfirm")}
                </>
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Onboarding({ navigate }: { navigate: (p: string) => void }) {
  const [slide, setSlide] = useState(0);
  const [locale, setCurrent] = useState(getLocale);
  const touch = useRef(0);
  const done = () => {
    localStorage.setItem("tl_onboarding_done", "true");
    navigate("/login");
  };
  return (
    <main className="onboarding">
      <header className="onboarding-header">
        <span className="brand">TimeLeak</span>
        <button className="text-link" onClick={done}>
          {t("onboarding_skip")}
        </button>
      </header>
      <div className="onboarding-layout">
        <div
          className="onboarding-art"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            const delta = e.changedTouches[0].clientX - touch.current;
            if (Math.abs(delta) > 40) setSlide(delta < 0 ? 1 : 0);
          }}
        >
          <div className="art-halo" />
          <img
            className="onboarding-image"
            src={asset(
              slide ? "onboarding-notes.svg" : "onboarding-memory.svg",
            )}
            alt=""
          />
          <div className="onboarding-art-caption">
            <ShieldCheck size={18} />
            {t("web_onboardingSync")}
          </div>
        </div>
        <section className="onboarding-content">
          <div className="logo-tile">
            <img src={asset("brand.svg")} alt="TimeLeak" />
          </div>
          <div className="onboarding-languages">
            {locales.map((l, i) => (
              <span key={l.code}>
                {i > 0 && <i>·</i>}
                <button
                  className={locale === l.code ? "active" : ""}
                  onClick={() => {
                    setLocale(l.code);
                    setCurrent(l.code);
                  }}
                >
                  {l.code.toUpperCase()}
                </button>
              </span>
            ))}
          </div>
          <p className="eyebrow">{t("web_onboardingEyebrow")}</p>
          <h1>
            {t(slide ? "web_onboardingSecondTitle" : "web_onboardingTitle")}
          </h1>
          <p className="onboarding-description">
            {t(slide ? "web_onboardingSecondBody" : "web_onboardingBody")}
          </p>
          <div className="onboarding-features">
            <span>
              <Check size={16} />
              {t("web_onboardingFeature1")}
            </span>
            <span>
              <Check size={16} />
              {t("web_onboardingFeature2")}
            </span>
          </div>
          <div className="onboarding-pagination">
            {[0, 1].map((i) => (
              <button
                key={i}
                aria-label={`${i + 1}`}
                aria-current={slide === i ? "step" : undefined}
                className={slide === i ? "active" : ""}
                onClick={() => setSlide(i)}
              />
            ))}
          </div>
          <button
            className="btn btn-primary"
            onClick={() => (slide === 0 ? setSlide(1) : done())}
          >
            {t(slide ? "web_openCalendar" : "onboarding_next")}
            <ArrowRight size={20} />
          </button>
          <p className="onboarding-bottom">{t("web_onboardingFootnote")}</p>
        </section>
      </div>
      <footer className="onboarding-footer">
        <span>© {new Date().getFullYear()} TimeLeak</span>
        <a href="/privacy" target="_blank" rel="noopener noreferrer">
          {t("web_privacy")}
        </a>
      </footer>
    </main>
  );
}
function SharedPage({
  token,
  authenticated,
  navigate,
  notify,
}: {
  token: string;
  authenticated: boolean;
  navigate: (p: string) => void;
  notify: (s: string) => void;
}) {
  const queryClient = useQueryClient();
  const {
    data: note,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["shared", token],
    queryFn: () => getSharedNote(token),
    retry: false,
    staleTime: 0,
  });
  const [importing, setImporting] = useState(false);
  const importNote = async () => {
    if (!note || importing) return;
    if (!authenticated) {
      sessionStorage.setItem("tl_pending_share", token);
      localStorage.setItem("tl_onboarding_done", "true");
      navigate("/login");
      return;
    }
    setImporting(true);
    try {
      const sizeError = t("web_fileTooLarge", { size: MAX_FILE_MB });
      if (
        note.file_sizes.reduce((sum, size) => sum + size, 0) > MAX_UPLOAD_BYTES
      ) {
        throw new Error(sizeError);
      }
      let totalBytes = 0;
      const form = new FormData();
      form.append("title", note.title || "TimeLeak");
      form.append("note_type", note.note_type);
      const date = note.note_date || dateKey(new Date());
      form.append("note_date", date);
      form.append("lifecycle", note.lifecycle);
      if (note.recurrence_rule)
        form.append("recurrence_rule", note.recurrence_rule);
      for (let i = 0; i < note.note_files.length; i++) {
        const blob = await fetchNoteFile(note.note_files[i], true);
        totalBytes += blob.size;
        if (totalBytes > MAX_UPLOAD_BYTES) throw new Error(sizeError);
        const ext = blob.type.includes("pdf")
          ? "pdf"
          : blob.type.includes("jpeg")
            ? "jpg"
            : blob.type.includes("png")
              ? "png"
              : blob.type.includes("mp4")
                ? "mp4"
                : blob.type.includes("webm")
                  ? "webm"
                  : blob.type.includes("audio")
                    ? "m4a"
                    : "bin";
        form.append(
          "files",
          new File([blob], `attachment-${i + 1}.${ext}`, { type: blob.type }),
        );
      }
      if (note.title_audio_url) {
        const blob = await fetchNoteFile(note.title_audio_url, true);
        totalBytes += blob.size;
        if (totalBytes > MAX_UPLOAD_BYTES) throw new Error(sizeError);
        form.append(
          "title_audio",
          new File([blob], "title.m4a", { type: "audio/mp4" }),
        );
      }
      await notesApi.create(form);
      await queryClient.invalidateQueries({ queryKey: ["meta"] });
      await queryClient.invalidateQueries({ queryKey: ["notes"] });
      notify(t("calendar_status_fileSaved"));
      navigate(`/?date=${date}`);
    } catch (e) {
      notify(errorMessage(e));
    } finally {
      setImporting(false);
    }
  };
  if (isPending)
    return (
      <main className="shared-page">
        <div className="notes-loading">
          <span className="spinner" />
          {t("web_loading")}
        </div>
      </main>
    );
  if (isError || !note)
    return (
      <main className="shared-page">
        <div className="empty-state">
          <Info size={52} />
          <h1>{t("share_openError")}</h1>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            {t("web_home")}
          </button>
        </div>
      </main>
    );
  return (
    <main className="shared-page">
      <p className="eyebrow">{t("web_sharedNote")}</p>
      <h1>{note.title || "TimeLeak"}</h1>
      <div className="shared-meta">
        {note.note_date && (
          <span>
            <CalendarDays size={16} />
            {new Intl.DateTimeFormat(getLocale(), { dateStyle: "long" }).format(
              parseDate(note.note_date),
            )}
          </span>
        )}
        <span>{t("web_sharedBy", { name: note.shared_by })}</span>
        <span>
          {t("web_expiresAt", {
            date: new Intl.DateTimeFormat(getLocale(), {
              dateStyle: "medium",
            }).format(new Date(note.expires_at)),
          })}
        </span>
      </div>
      <NoteCard note={note} isPublic notify={notify} />
      <div className="shared-actions">
        <a
          className="btn btn-outlined"
          href={`timeleak://share/${encodeURIComponent(token)}`}
        >
          <ExternalLink size={18} />
          {t("web_openApp")}
        </a>
        <button
          className="btn btn-primary"
          disabled={importing}
          onClick={() => void importNote()}
        >
          {importing ? <span className="spinner" /> : <Download size={18} />}{" "}
          {t(importing ? "web_importing" : "web_saveToCalendar")}
        </button>
      </div>
    </main>
  );
}
