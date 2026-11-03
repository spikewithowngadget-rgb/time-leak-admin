# time-leak-admin

TimeLeak user web client and administration server.

The user client is built from `client/` into `web/app/`. The Go server serves
its known browser routes and `/app-assets/*`, alongside the administration UI.
Build the user client before deployment; the Go binary does not contain its assets.

- `/` — user calendar; `/login`, `/register/*`, `/forgot-password/*` — user authentication
- `/share/{token}` — public note, with server-rendered Open Graph metadata
- `/admin` — administrator login
- `/admin/dashboard` — administrator dashboard
- `/dashboard`, `/admin/login`, `/login.html` — retained administration aliases
- `/privacy`, `/health`, `/config.js` — existing public endpoints

User and administrator sessions use separate localStorage keys. Administrator
logout and expired sessions return to `/admin`.

- Back-end: Go (`net/http`)
- User front-end: React + TypeScript + Vite (build required)
- Admin front-end: HTML + CSS + JavaScript modules (no build step)
- User languages: `en / ru / zh / hi / fr / de / es / it / pt / ar` (Arabic RTL)
- Admin languages: `KZ / RU / EN`
- Server port: `8080` (әдепкі)

## Run

```bash
cd client
npm ci
npm run build
cd ..
go run ./cmd
```

For frontend development: `cd client && npm run dev`.
Production builds use `/app-assets/`; the dev server serves `/`.
Run `npm test` in `client/` and `go test ./...` in the repository root.
See `DEPLOYMENT_WEB.md` for the frontend-only release/rollback procedure.
The API, its port 8081, database and Flutter contract are unchanged.

## User web client

Phone/password sign-in, WhatsApp OTP registration/password reset, local-date
calendar, recurring notes, upload/edit/delete/download/share, public imports,
image/video/PDF/text/audio previews, camera and microphone recording, drag/drop,
10 languages and an install manifest. UI notes caches and file blobs are cleared
when the account changes. Refresh requests are serialized per page and, where
Web Locks is available, across tabs. Temporary network failures retain sessions.

`VITE_API_URL` defaults to `https://api.timeleak.kz`; never include service secrets
in client environment variables. `VITE_MAX_FILE_MB` defaults to 100 as a browser
upload guard; it does not impose a new server limit.

The existing email OTP verification does not issue user-session tokens, so email
sign-in is not offered. The API is left untouched per the deployment constraint.
Audio-title processing depends on the existing server capabilities.
Original Flutter assets/ARB were not supplied locally; temporary SVG illustrations
and translated strings are documented in `client/public/assets/README.md`.

## Email reminders

In **About → Email reminders**, users verify their mailbox through the existing
Resend OTP service, explicitly enable reminders, and select the email language.
The contact is separate from the phone account identity. The scheduler covers
notes created in either Flutter or the web app.

Administrators use **Settings → Email reminders** to set the global horizon
(1–30 days, default 3), sending hour (default 09:00) and IANA timezone
(default Asia/Almaty), or pause delivery. A horizon of 3 means daily messages
3, 2 and 1 day before each occurrence. There is no manual bulk-send action.

Backend setup and API documentation: `time-leak-back-end/docs/EMAIL_REMINDERS_RU.md`
in the companion repository. This feature is an additive backend change; existing
mobile sign-in and note contracts remain compatible.

## Server addresses

Server starts at:

- `http://localhost:8080/admin`
- `http://localhost:8080/admin/dashboard`
- `http://localhost:8080/health`
- `http://localhost:8080/config.js`
- `http://localhost:8080/privacy`

## Environment Variables

- `PORT` (default: `8080`)
- `API_BASE_URL` (default: `https://api.timeleak.kz`)
- `STATIC_DIR` (default: `web`)
- `SHUTDOWN_TIMEOUT_SECONDS` (default: `10`)

Example:

```bash
PORT=8080 API_BASE_URL=https://api.timeleak.kz go run ./cmd
```

## Login Flow

1. Open `/admin`.
2. Enter the administrator credentials configured for the deployment.
3. App sends `POST /api/v1/admin/auth/login` to `API_BASE_URL`.
4. On success:
   - saves `access_token`
   - saves `refresh_token` when the API provides one
   - calculates and stores expiry timestamp (`now + expires_in_seconds`)
   - redirects to `/admin/dashboard`
5. If the access token expires and a refresh token is available, the client refreshes the session through `POST /api/v1/auth/refresh` and retries the request.
6. If refresh fails, or the API returns final `401/403`, session is cleared and user is redirected to `/admin`.

## API Integration Notes

- Remote base API is configurable through runtime endpoint `/config.js`.
- Default remote API: `https://api.timeleak.kz`
- Important: API root `/` returns `404`; all calls are sent to `/api/v1/*`.
- Implemented client calls:
  - `POST /api/v1/admin/auth/login`
  - `POST /api/v1/auth/refresh` (used when a refresh token exists)
  - `GET /api/v1/admin/ads`
  - `POST /api/v1/admin/ads`
  - `PUT /api/v1/admin/ads/{id}`
  - `DELETE /api/v1/admin/ads/{id}`
  - `GET /api/v1/admin/testing/otp/latest?phone=...` (utility method in JS client)

## UX Features

- Login page + logout
- Ads table: title, preview, target URL, active badge, created/updated timestamps
- Filter: all / active / inactive
- Pagination: limit + offset + prev/next + apply offset
- Create form with client-side validation
- Edit modal with partial update (only changed fields)
- Quick active/inactive toggle from table
- Delete confirmation dialog
- Toast notifications for success/error/info
- Request-pending state disables relevant buttons
- Explicit UI handling for HTTP `400/401/403/404/500`
- Responsive layout for mobile/tablet/desktop

## Manual Test Checklist

1. Health check
   - `GET /health` returns `200` and `{ "status": "ok" }`
2. Privacy policy
   - `GET /privacy` returns `200`
   - browser opens a public HTML page
3. Runtime config
   - Open `/config.js` and verify `API_BASE_URL`
4. Login success
   - Use valid credentials
   - Verify redirect to `/admin/dashboard`
   - Verify token + expiry saved in `localStorage`
5. Login failure
   - Use invalid credentials
   - Verify error toast (`401 unauthorized`)
6. List ads
   - Dashboard auto-loads ads
   - Table displays required fields
7. Filter + pagination
   - Switch all/active/inactive
   - Change limit
   - Use prev/next and apply offset
8. Create ad
   - Submit valid payload
   - Verify success toast and list refresh
9. Create ad validation
   - Empty required fields -> validation error
   - Invalid URL (non-http/https) -> validation error
10. Edit ad (partial)
   - Open edit modal
   - Change one field only
   - Verify only changed data is submitted and updated
11. Quick status toggle
   - Click active/inactive badge
   - Verify status updates via PUT
12. Delete ad
   - Delete with confirmation dialog
   - Verify success toast and row removal
13. Token expiry behavior
   - Force-expire token in `localStorage`
   - If `refresh_token` exists, trigger API action and verify request is retried successfully
   - If no `refresh_token` exists, verify final `401` clears session and redirects to login
14. 401/403 handling
   - Use invalid token and trigger API request
   - Verify redirect to login only after refresh is unavailable or rejected
15. Multi-language
   - Switch KZ/RU/EN on login and dashboard
   - Verify translated labels/messages

## Project Structure

- `cmd/main.go`
- `internal/server/server.go`
- `internal/handler/handler.go`
- `internal/service/service.go`
- `internal/repository/repository.go`
- `config/config.go`
- `web/login.html`
- `web/index.html`
- `web/assets/css/styles.css`
- `web/assets/js/config.js`
- `web/assets/js/api.js`
- `web/assets/js/auth.js`
- `web/assets/js/i18n.js`
- `web/assets/js/ui.js`
- `web/assets/js/login.js`
- `web/assets/js/ads.js`
