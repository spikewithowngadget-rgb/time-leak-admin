import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, ShieldCheck, RefreshCw } from "lucide-react";
import {
  auth,
  errorMessage,
  getSessionIdentity,
  reminderEmailApi,
} from "./api";
import { getLocale, locales, translate as t } from "./i18n";
import Modal from "./Modal";

const emailLanguages = [{ code: "kk", nativeName: "Қазақша" }, ...locales];

export default function ReminderEmail({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const client = useQueryClient();
  const key = ["email-reminder-contact", getSessionIdentity()];
  const query = useQuery({ queryKey: key, queryFn: reminderEmailApi.get });
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [requestId, setRequestId] = useState("");
  const [consent, setConsent] = useState(false);
  const [language, setLanguage] = useState<string>(getLocale());
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open]);
  const seconds = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const edit = () => {
    setEmail(query.data?.email || "");
    setCode("");
    setRequestId("");
    setConsent(query.data?.enabled || false);
    setLanguage(query.data?.language || getLocale());
    setOpen(true);
  };
  const sendCode = async () => {
    const result = await auth.requestEmail(email);
    setEmail(result.email);
    setRequestId(result.request_id);
    setCode("");
    setResendAt(Date.now() + result.resend_after_seconds * 1000);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!requestId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      notify(t("auth_invalidEmail"));
      return;
    }
    if (requestId && code.length !== 4) {
      notify(t("register_errorEnterFullCode"));
      return;
    }
    setBusy(true);
    try {
      if (!requestId) await sendCode();
      else {
        const contact = await reminderEmailApi.verify(
          requestId,
          code,
          consent,
          language,
        );
        client.setQueryData(key, contact);
        setOpen(false);
        notify(
          t(
            contact.enabled
              ? "reminder_email_saved"
              : "reminder_email_verifiedOnly",
          ),
        );
      }
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const update = async (enabled: boolean, nextLanguage?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const contact = await reminderEmailApi.update(enabled, nextLanguage);
      client.setQueryData(key, contact);
      notify(
        t(
          contact.enabled
            ? "reminder_email_enabled"
            : "reminder_email_disabled",
        ),
      );
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const resend = async () => {
    if (busy || seconds) return;
    setBusy(true);
    try {
      await sendCode();
      notify(t("web_emailLinkSent", { email }));
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const languageOptions = emailLanguages.map((value) => (
    <option value={value.code} key={value.code}>
      {value.nativeName}
    </option>
  ));
  return (
    <section id="email-reminders" className="account-email reminder-email">
      <div className="account-email-heading">
        <Mail size={22} />
        <div>
          <h2>{t("reminder_email_title")}</h2>
          <p>{t("reminder_email_description")}</p>
        </div>
      </div>
      {query.isPending ? (
        <span className="spinner" role="status" aria-label={t("web_loading")} />
      ) : query.isError ? (
        <button
          className="btn btn-outlined"
          onClick={() => void query.refetch()}
        >
          <RefreshCw size={16} />
          {t("web_retry")}
        </button>
      ) : (
        <>
          {query.data?.verified_at && (
            <>
              <p className="linked-email">
                <ShieldCheck size={18} />
                {query.data.email}
              </p>
              <label className="reminder-consent">
                <input
                  type="checkbox"
                  role="switch"
                  checked={query.data.enabled}
                  disabled={busy}
                  onChange={(event) => void update(event.target.checked)}
                />
                <span>{t("reminder_email_consent")}</span>
              </label>
              <label className="reminder-language">
                {t("reminder_email_language")}
                <select
                  value={query.data.language || getLocale()}
                  disabled={busy}
                  onChange={(event) =>
                    void update(query.data!.enabled, event.target.value)
                  }
                >
                  {languageOptions}
                </select>
              </label>
            </>
          )}
          <button className="btn btn-outlined" onClick={edit} disabled={busy}>
            {t(
              query.data?.verified_at
                ? "web_emailLinkChange"
                : "web_emailLinkAdd",
            )}
          </button>
        </>
      )}
      {open && (
        <Modal
          title={t("reminder_email_title")}
          onClose={() => setOpen(false)}
          busy={busy}
        >
          <form className="email-link-form" onSubmit={submit} noValidate>
            {requestId ? (
              <>
                <p className="dialog-description">
                  {t("web_emailLinkSent", { email })}
                </p>
                <div className="field">
                  <label htmlFor="reminder-email-code">
                    {t("web_emailLinkCode")}
                  </label>
                  <input
                    id="reminder-email-code"
                    value={code}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={4}
                    placeholder="0000"
                    autoFocus
                    disabled={busy}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                  />
                </div>
                <div className="auth-resend">
                  <button
                    className="text-link"
                    type="button"
                    disabled={busy || seconds > 0}
                    onClick={() => void resend()}
                  >
                    {t("register_resendCode")}
                  </button>
                  {seconds > 0 && (
                    <span>{`${Math.floor(seconds / 60)
                      .toString()
                      .padStart(
                        2,
                        "0",
                      )}:${(seconds % 60).toString().padStart(2, "0")}`}</span>
                  )}
                </div>
              </>
            ) : (
              <div className="field">
                <label htmlFor="reminder-email">Email</label>
                <input
                  id="reminder-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  disabled={busy}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            )}
            <label className="reminder-language">
              {t("reminder_email_language")}
              <select
                value={language}
                disabled={busy}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {languageOptions}
              </select>
            </label>
            <label className="reminder-consent">
              <input
                type="checkbox"
                checked={consent}
                disabled={busy}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>{t("reminder_email_consent")}</span>
            </label>
            <p className="reminder-privacy">
              {t("reminder_email_description")}
            </p>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || (!!requestId && code.length !== 4)}
            >
              {busy ? (
                <span className="spinner" />
              ) : (
                t(requestId ? "web_emailLinkVerify" : "auth_getEmailCode")
              )}
            </button>
            {requestId && (
              <button
                type="button"
                className="text-link"
                disabled={busy}
                onClick={() => {
                  setRequestId("");
                  setCode("");
                }}
              >
                {t("web_emailLinkBack")}
              </button>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
