import { useEffect, useState, type FormEvent } from "react";
import { auth, errorMessage } from "./api";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;
interface Props {
  path: string;
  navigate: (path: string) => void;
  notify: (message: string) => void;
  t: Translate;
}
interface Flow {
  phone: string;
  requestId: string;
  verificationToken?: string;
  resendAt: number;
}
export function finishLogin(navigate: Props["navigate"]) {
  const pending = sessionStorage.getItem("tl_pending_share");
  const returnTo = sessionStorage.getItem("tl_return_to");
  sessionStorage.removeItem("tl_pending_share");
  sessionStorage.removeItem("tl_return_to");
  let calendarTarget = returnTo === "/about#email-reminders" ? returnTo : "/";
  const match = /^\/\?date=(\d{4})-(\d{2})-(\d{2})$/.exec(returnTo || "");
  if (match) {
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day)
    )
      calendarTarget = returnTo!;
  }
  navigate(pending ? `/share/${encodeURIComponent(pending)}` : calendarTarget);
}
function readFlow(key: string): Flow | null {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function Eye({ visible }: { visible: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <path d="m3 3 18 18" />}
    </svg>
  );
}
function PasswordField({
  value,
  onChange,
  label,
  placeholder,
  disabled,
  id,
  autoComplete,
  showLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  disabled: boolean;
  id: string;
  autoComplete: string;
  showLabel: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder || "••••••••"}
          disabled={disabled}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          className="auth-eye"
          onClick={() => setVisible(!visible)}
          aria-label={showLabel}
          aria-pressed={visible}
          disabled={disabled}
        >
          <Eye visible={visible} />
        </button>
      </div>
    </div>
  );
}

export default function AuthPages({ path, navigate, notify, t }: Props) {
  const tx = (
    key: string,
    fallback: string,
    params?: Record<string, string | number>,
  ) => {
    const value = t(key, params);
    return !value || value === key
      ? fallback.replace(/\{(\w+)\}/g, (_, name: string) =>
          String(params?.[name] ?? ""),
        )
      : value;
  };
  const isReset =
    path.startsWith("/forgot-password") || path.startsWith("/reset-password");
  const isRegister = path.startsWith("/register");
  const isVerify = path.endsWith("/verify");
  const isPassword = path.endsWith("/password") || path.endsWith("/new");
  const isLogin = !isRegister && !isReset;
  const flowKey = isReset ? "tl_reset_flow" : "tl_register_flow";
  const [flow, setFlow] = useState<Flow | null>(() => readFlow(flowKey));
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (path.startsWith("/login/")) {
      navigate("/login");
      return;
    }
    const current = readFlow(flowKey);
    setFlow(current);
    setPassword("");
    setConfirmation("");
    setCode("");
    if (
      (isVerify && !current?.requestId) ||
      (isPassword && !current?.verificationToken)
    )
      navigate(isReset ? "/forgot-password" : "/register");
  }, [path, flowKey]);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  const remember = (next: Flow) => {
    sessionStorage.setItem(flowKey, JSON.stringify(next));
    setFlow(next);
  };
  const seconds = Math.max(0, Math.ceil(((flow?.resendAt || 0) - now) / 1000));
  const countdown = `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
  const progress = isVerify ? 2 : isPassword ? 3 : 1;
  const back = () => {
    if (isVerify) navigate(isReset ? "/login" : "/register");
    else if (isPassword)
      navigate(isReset ? "/forgot-password/verify" : "/register/verify");
    else navigate("/login");
  };
  const resend = async () => {
    if (seconds > 0 || busy || !flow) return;
    setBusy(true);
    try {
      const result = await (isReset
        ? auth.requestReset(flow.phone)
        : auth.requestOtp(flow.phone));
      remember({
        phone: flow.phone,
        requestId: result.request_id,
        resendAt: Date.now() + result.expires_in_seconds * 1000,
      });
      setCode("");
      notify(tx("auth_codeSent", "Код отправлен в WhatsApp"));
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (isLogin && (!phone.trim() || !password.trim())) {
      notify(tx("register_errorFillAllFields", "Заполните все поля"));
      return;
    }
    if (!isLogin && !isVerify && !isPassword && !phone.trim()) {
      notify(tx("register_errorEnterPhone", "Введите номер телефона"));
      return;
    }
    if (isVerify && code.length !== 4) {
      notify(tx("register_errorEnterFullCode", "Введите код из 4 цифр"));
      return;
    }
    if (isPassword) {
      if (!password.trim() || !confirmation.trim()) {
        notify(tx("register_errorFillAllFields", "Заполните все поля"));
        return;
      }
      if (password.trim() !== confirmation.trim()) {
        notify(tx("register_errorPasswordsMismatch", "Пароли не совпадают"));
        return;
      }
      if (password.trim().length < 8) {
        notify(
          tx(
            "register_errorPasswordTooShort",
            "Пароль должен содержать не менее 8 символов",
          ),
        );
        return;
      }
    }
    setBusy(true);
    try {
      if (isLogin) {
        await auth.login(phone, password);
        localStorage.setItem("tl_onboarding_done", "true");
        finishLogin(navigate);
      } else if (isVerify && flow) {
        const verified = await (isReset
          ? auth.verifyReset(flow.requestId, code)
          : auth.verifyOtp(flow.requestId, code));
        remember({
          ...flow,
          phone: verified.phone || flow.phone,
          verificationToken: verified.verification_token,
        });
        navigate(isReset ? "/forgot-password/new" : "/register/password");
      } else if (isPassword && flow?.verificationToken) {
        if (isReset) {
          await auth.confirmReset(
            flow.phone,
            password.trim(),
            flow.verificationToken,
          );
          sessionStorage.removeItem(flowKey);
          notify(tx("reset_success", "Пароль обновлён. Войдите в аккаунт"));
          navigate("/login");
        } else {
          await auth.register(
            flow.phone,
            password.trim(),
            flow.verificationToken,
          );
          await auth.login(flow.phone, password.trim());
          sessionStorage.removeItem(flowKey);
          localStorage.setItem("tl_onboarding_done", "true");
          notify(tx("register_success", "Регистрация завершена"));
          finishLogin(navigate);
        }
      } else {
        const result = await (isReset
          ? auth.requestReset(phone)
          : auth.requestOtp(phone));
        remember({
          phone: phone.trim(),
          requestId: result.request_id,
          resendAt: Date.now() + result.expires_in_seconds * 1000,
        });
        navigate(isReset ? "/forgot-password/verify" : "/register/verify");
      }
    } catch (error) {
      notify(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const title = isLogin
    ? tx("login_welcomeBack", "С возвращением!")
    : isReset
      ? isVerify
        ? tx("reset_verifyTitle", "Проверьте WhatsApp")
        : isPassword
          ? tx("reset_newPasswordTitle", "Новый пароль")
          : tx("reset_title", "Забыли пароль?")
      : isVerify
        ? tx("register_verifyTitle", "Подтвердите номер")
        : isPassword
          ? tx("register_passwordTitle", "Придумайте пароль")
          : tx("register_title", "Создать аккаунт");
  const subtitle = isLogin
    ? tx("login_subtitle", "Войдите, чтобы важное всегда было под рукой.")
    : isReset
      ? isVerify
        ? tx(
            "reset_verifySubtitle",
            "Отправили код в WhatsApp на номер {phone}",
            { phone: flow?.phone || "" },
          )
        : isPassword
          ? tx(
              "reset_newPasswordSubtitle",
              "Придумайте новый пароль для своего аккаунта.",
            )
          : tx(
              "reset_subtitle",
              "Введите номер телефона. Мы отправим код для восстановления в WhatsApp.",
            )
      : isVerify
        ? tx(
            "register_verifySubtitle",
            "Отправили код в WhatsApp на номер {phone}",
            { phone: flow?.phone || "" },
          )
        : isPassword
          ? tx(
              "register_passwordSubtitle",
              "Остался последний шаг — защитите свои заметки.",
            )
          : tx(
              "register_phoneSubtitle",
              "Все ваши заметки — в одном календаре. Начнём с номера телефона.",
            );
  const action = isLogin
    ? tx("login_signIn", "Войти")
    : isReset
      ? isVerify
        ? tx("reset_continue", "Продолжить")
        : isPassword
          ? tx("reset_updatePassword", "Обновить пароль")
          : tx("reset_sendCode", "Отправить код")
      : isVerify
        ? tx("register_confirm", "Подтвердить")
        : isPassword
          ? tx("register_complete", "Создать аккаунт")
          : tx("register_getCode", "Получить код в WhatsApp");
  const requirements = [
    {
      done: password.length >= 8,
      text: tx("reset_requirementLength", "Не менее 8 символов"),
    },
    {
      done: /[A-ZА-ЯЁ]/.test(password),
      text: tx("reset_requirementUppercase", "Заглавная буква"),
    },
    { done: /\d/.test(password), text: tx("reset_requirementDigit", "Цифра") },
    {
      done: /[^\p{L}\p{N}\s]/u.test(password),
      text: tx("reset_requirementSpecial", "Специальный символ"),
    },
  ];
  return (
    <main className={`auth-page ${isReset ? "auth-reset" : ""}`}>
      <div className="auth-brand-row">
        <button
          className="brand"
          type="button"
          onClick={() => navigate("/onboarding")}
          aria-label="TimeLeak"
        >
          TimeLeak<span className="brand-dot">.</span>
        </button>
        <span className="auth-brand-caption">
          {tx("auth_webVersion", "Веб-версия")}
        </span>
      </div>
      <section className="auth-card">
        {!isLogin && (
          <div className="auth-step-row">
            <button
              className="auth-back icon-btn"
              type="button"
              onClick={back}
              aria-label={tx("common_back", "Назад")}
            >
              {isReset && isVerify ? "×" : "←"}
            </button>
            <span className="auth-step-label">
              {tx("auth_step", "Шаг {step} из 3", { step: progress })}
            </span>
            <div className="auth-steps" aria-hidden="true">
              {[1, 2, 3].map((step) => (
                <i className={progress >= step ? "active" : ""} key={step} />
              ))}
            </div>
          </div>
        )}
        <div className="auth-heading">
          <div className="auth-eyebrow">
            {isLogin
              ? tx("auth_yourCalendar", "ВАШ ЛИЧНЫЙ КАЛЕНДАРЬ")
              : isReset
                ? tx("auth_accountRecovery", "ВОССТАНОВЛЕНИЕ ДОСТУПА")
                : tx("auth_start", "НАЧНЁМ С ВАЖНОГО")}
          </div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <form onSubmit={submit} noValidate>
          {!isVerify && !isPassword && (
            <div className="auth-field field">
              <label htmlFor="auth-phone">
                {tx("login_phoneLabel", "Номер телефона")}
              </label>
              <input
                id="auth-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="+7 701 555 66 77"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={busy}
                required
              />
            </div>
          )}
          {isVerify && (
            <>
              <div className="auth-field field">
                <label htmlFor="auth-code">
                  {tx("register_smsCodeLabel", "Код подтверждения")}
                </label>
                <input
                  className="auth-code"
                  id="auth-code"
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="0000"
                  maxLength={4}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  disabled={busy}
                />
              </div>
              <div className="auth-resend">
                <button
                  type="button"
                  className="text-link"
                  disabled={seconds > 0 || busy}
                  onClick={resend}
                >
                  {isReset
                    ? tx("reset_resendCode", "Отправить код повторно")
                    : tx("register_resendCode", "Отправить код повторно")}
                </button>
                {seconds > 0 && <span>{countdown}</span>}
              </div>
            </>
          )}
          {(isLogin || isPassword) && (
            <PasswordField
              id="auth-password"
              value={password}
              onChange={setPassword}
              label={tx("login_passwordLabel", "Пароль")}
              disabled={busy}
              autoComplete={isLogin ? "current-password" : "new-password"}
              showLabel={tx("auth_showPassword", "Показать или скрыть пароль")}
            />
          )}
          {isReset && isPassword && (
            <ul className="auth-requirements">
              {requirements.map((requirement) => (
                <li
                  className={requirement.done ? "fulfilled" : ""}
                  key={requirement.text}
                >
                  <span aria-hidden="true">{requirement.done ? "✓" : ""}</span>
                  {requirement.text}
                </li>
              ))}
            </ul>
          )}
          {isPassword && (
            <PasswordField
              id="auth-confirm"
              value={confirmation}
              onChange={setConfirmation}
              label={tx("register_confirmPasswordLabel", "Повторите пароль")}
              disabled={busy}
              autoComplete="new-password"
              showLabel={tx("auth_showPassword", "Показать или скрыть пароль")}
            />
          )}
          {isLogin && (
            <div className="auth-forgot">
              <button
                type="button"
                className="text-link"
                onClick={() => navigate("/forgot-password")}
              >
                {tx("login_forgotPassword", "Забыли пароль?")}
              </button>
            </div>
          )}
          <button
            className="btn btn-primary auth-submit"
            type="submit"
            disabled={busy || (isReset && isVerify && code.length !== 4)}
          >
            {busy ? (
              <span
                className="spinner"
                role="status"
                aria-label={tx("common_loading", "Загрузка")}
              />
            ) : (
              <>
                {action}
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </form>
        {isLogin && (
          <p className="auth-register-link">
            {tx("login_noAccount", "Ещё нет аккаунта?")}{" "}
            <button
              type="button"
              className="text-link"
              onClick={() => navigate("/register")}
            >
              {tx("login_registerLink", "Зарегистрироваться")}
            </button>
          </p>
        )}
        {!isLogin && !isReset && !isVerify && !isPassword && (
          <p className="auth-legal">
            {tx("auth_registrationPrivacy", "Продолжая, вы принимаете")}{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              {tx("auth_privacyPolicy", "политику конфиденциальности")}
            </a>
          </p>
        )}
      </section>
      <p className="auth-footer">
        {tx("auth_footer", "Важное не теряется. Оно ждёт своего дня.")}
      </p>
    </main>
  );
}
