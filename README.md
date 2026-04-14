# time-leak-admin

TimeLeak жарнамаларын басқаруға арналған Admin Panel.

- Back-end: Go (`net/http`)
- Front-end: Pure HTML + CSS + JavaScript modules (build step жоқ)
- Тілдер: `KZ / RU / EN`
- Server port: `8080` (әдепкі)

## Run

```bash
go run ./cmd/admin
```

Server starts at:

- `http://localhost:8080/login`
- `http://localhost:8080/dashboard`
- `http://localhost:8080/health`
- `http://localhost:8080/config.js`
- `http://localhost:8080/privacy`

## Environment Variables

- `PORT` (default: `8080`)
- `API_BASE_URL` (default: `https://api.timeleak.kz`)
- `STATIC_DIR` (default: `web`)
- `PRIVACY_PDF_PATH` (default: `offerta/time-leak-offerta.pdf`)
- `SHUTDOWN_TIMEOUT_SECONDS` (default: `10`)

Example:

```bash
PORT=8080 API_BASE_URL=https://api.timeleak.kz go run ./cmd/admin
```

Privacy policy PDF example:

```bash
PRIVACY_PDF_PATH=offerta/time-leak-offerta.pdf go run ./cmd/admin
```

## Login Flow

1. Open `/login`.
2. Enter admin credentials (example: `Admin` / `QRT123`).
3. App sends `POST /api/v1/admin/auth/login` to `API_BASE_URL`.
4. On success:
   - saves `access_token`
   - saves `refresh_token` when the API provides one
   - calculates and stores expiry timestamp (`now + expires_in_seconds`)
   - redirects to `/dashboard`
5. If the access token expires and a refresh token is available, the client refreshes the session through `POST /api/v1/auth/refresh` and retries the request.
6. If refresh fails, or the API returns final `401/403`, session is cleared and user is redirected to `/login`.

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
2. Privacy policy PDF
   - `GET /privacy` returns `200`
   - browser opens `time-leak-offerta.pdf` inline by URL
3. Runtime config
   - Open `/config.js` and verify `API_BASE_URL`
4. Login success
   - Use valid credentials
   - Verify redirect to `/dashboard`
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

- `cmd/admin/main.go`
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
