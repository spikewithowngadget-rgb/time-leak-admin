# Первый этап TimeLeak: развёртывание веба (историческая инструкция)

4 ноября 2026 года пользователь позднее отдельно разрешил доработку backend
для универсальных email-напоминаний. Описанное ниже ограничение «только
фронтенд» относится к предыдущему этапу и не является текущим запретом на
разрешённый релиз напоминаний. Текущие API, миграция и требования сборки описаны
в [EMAIL_REMINDERS_RU.md](../time-leak-back-end/docs/EMAIL_REMINDERS_RU.md).
Конкретный порядок и результат нового развёртывания фиксируются отдельно.

## Scope of the earlier frontend stage

Deploy only the user web client and existing admin web server on port **8080**,
plus the main-domain Caddy routing needed to open the web client at
`https://timeleak.kz`.

At that earlier stage, the user's instruction prohibited backend changes. Do not change API
source, configuration, environment, systemd unit, port, database, uploads or
installed dependencies. Do not restart `server.service` or the process on
8081. Do not run migrations, seed users, deactivate accounts, install FFmpeg
or publish any experimental backend patches. Security findings remain audit
findings in the unchanged backend; this frontend release does not fix them.

The web client uses the existing `https://api.timeleak.kz` contract. It does
not add server-side email authentication, email linking, media transcoding,
attachment authorization or upload-limit behavior. A feature unsupported by
the current API must be hidden or clearly unavailable in the client.

## Confirmed production layout

Read-only SSH inventory on 4 November 2026 established:

| Item | Actual value |
| --- | --- |
| Host | `154.59.225.203`, Linux amd64 |
| SSH session | `/tmp/timeleak-ssh.sock` |
| Web/admin unit | `admin.service` |
| Web/admin working directory | `/home/time-leak-admin` |
| Existing web command | `/usr/local/go/bin/go run /home/time-leak-admin/cmd/main.go` |
| Web/admin port | `8080` |
| API unit, unchanged | `server.service` |
| API working directory, unchanged | `/home/time-leak-back-end` |
| API port, unchanged | `8081` |
| Go executable | `/usr/local/go/bin/go`, version 1.26.2 |
| Caddy configuration | `/etc/caddy/Caddyfile` |

Neither application unit had systemd drop-ins during inventory. The admin
checkout was clean at `1a5ea44f71565758dae4f3cbc9002bf436333860`.
The backend checkout contained live database/upload changes; leave it alone.
No remote preparation, backup, package installation, source/configuration
change or service restart was performed during that inventory.

## 1. Build and verify locally

From the reviewed `time-leak-admin` checkout:

```sh
cd /Users/yerek/time-leak/time-leak-admin/client
npm ci
npm test
npm run build
cd /Users/yerek/time-leak/time-leak-admin
go test ./...
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -o /tmp/timeleak-web-linux-amd64 ./cmd
```

Vite builds the user SPA into `web/app/` with base `/app-assets/`. Include
that directory and the existing `web/assets`, `web/login.html`,
`web/index.html` and `web/privacy.html` in the release. Keep existing public
legal assets if used by the frontend. The Go binary does not embed these
files. `VITE_API_URL` defaults to the existing API origin; never put private
keys into Vite configuration. `/config.js` continues serving the existing
public admin runtime configuration.

The Go web server uses the standard library and can be cross-built with
`CGO_ENABLED=0`. Alternatively, build this admin project with the installed
Go executable in a separate release directory on the server. Do not build,
test, modify or restart the backend as part of this deployment. A server-side
Node installation is unnecessary when using the locally built SPA artifact.

Before packaging, verify the built app locally through the Go server at
320, 390, 768, 1024 and 1440px. Check phone login, supported existing API
features, calendar dates, uploads, media, public sharing and admin redirects.
Use mock or explicitly authorized test data for mutations and OTP sends.

## 2. Stage only the frontend release

Use a new release directory, for example:

```text
/srv/timeleak-web-releases/20261104-web/
  timeleak-web
  web/
    app/
    assets/
    index.html
    login.html
    privacy.html
  backups/
  evidence/
```

Copy only the reviewed admin binary and required frontend assets. Set the
release/backup/evidence directories to root-only permissions as appropriate;
allow the actual web service user to read static files. Retain the existing
`/home/time-leak-admin` checkout so rollback can use its previous command.
Do not copy anything into `/home/time-leak-back-end`.

Before activation, back up only the existing admin source/static files,
`/etc/systemd/system/admin.service`, any admin drop-ins and
`/etc/caddy/Caddyfile`. Keep archives private. Do not back up or rewrite the
API environment/database/uploads for this frontend-only release.

Capture a read-only API continuity snapshot outside the backend directory:

```sh
systemctl show server.service -p MainPID -p ExecMainStartTimestamp -p ActiveEnterTimestamp -p NRestarts > <RELEASE>/evidence/api-before.txt
ss -lntp '( sport = :8081 )' > <RELEASE>/evidence/api-listener-before.txt
```

Optionally hash the API unit and environment file without printing their
contents. These reads create evidence only in the frontend release. The API
PID and start timestamps must remain unchanged throughout deployment.

## 3. Preview the candidate without changing public routing

Start the candidate on a separate temporary web port, with its static path
pointing at the staged frontend files:

```sh
PORT=18080 STATIC_DIR=<RELEASE>/web <RELEASE>/timeleak-web
```

Check `/`, `/login`, `/onboarding`, `/register/verify`, `/forgot-password/new`,
`/about`, `/admin`, `/admin/dashboard`, `/dashboard`, `/privacy`, `/health`,
`/config.js` and a built `/app-assets/assets/*` file. Unknown paths and missing
assets must be 404. Browser auth guards determine whether user/admin pages
are visible after loading their respective HTML shells.

For public `/share/{token}`, the web server reuses the existing API landing
metadata and injects escaped title/Open Graph/canonical tags into the SPA.
Check a valid share and 404/410 handling without changing its note.
Stop only this temporary candidate process after testing.

## 4. Activate the web service only

Preserve the existing `admin.service` working directory and environment.
A dedicated drop-in can select the staged binary/static files while retaining
the original service and checkout. Replace placeholders with the actual
absolute release path:

```ini
# /etc/systemd/system/admin.service.d/90-timeleak-web-release.conf
[Service]
ExecStart=
ExecStart=/usr/bin/env PORT=8080 STATIC_DIR=<RELEASE>/web <RELEASE>/timeleak-web
WorkingDirectory=/home/time-leak-admin
```

Save any existing file at that drop-in path before replacing it. Then:

```sh
sudo systemctl daemon-reload
sudo systemctl restart admin.service
sudo systemctl is-active admin.service
curl --fail --silent --output /dev/null http://127.0.0.1:8080/health
curl --fail --silent --output /dev/null http://127.0.0.1:8080/login
curl --fail --silent --output /dev/null http://127.0.0.1:8080/admin
```

Do not run `systemctl restart server.service`. Do not modify its unit or
set/change any backend environment variable.

## 5. Merge the main-domain Caddy route only

Prepare a candidate from the **actual current** `/etc/caddy/Caddyfile`.
Remove `import share_landing` only inside the `timeleak.kz` site block.
The existing catch-all reverse proxy then sends `/share/*` and the user app
to the web server on 8080. Preserve every other directive, including:

- `api.timeleak.kz` block, its `import share_landing` and proxy to 8081;
- the shared `share_landing` snippet and `/srv/timeleak-share` files;
- main-domain association-file, `/s/*` and `/api/v1/notes/shared/*` proxies to 8081;
- TLS, logging and other existing hosts/custom settings.

Review a diff and validate the candidate before replacing the active file:

```sh
sudo caddy validate --config <RELEASE>/Caddyfile
sudo install -m 644 <RELEASE>/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Reloading Caddy updates routing; it must not restart the API. Do not replace
the current Caddy configuration wholesale from a backend source checkout.

## 6. Verify public behavior and API continuity

1. `https://timeleak.kz/` opens the user web app; `/admin` opens admin login, `/admin/dashboard` the admin dashboard. Old `/dashboard` remains an alias.
2. Phone login works against the existing API and shows existing notes. Refresh, nested-route reloads, file rendering and date selection work within that API's current behavior.
3. Public sharing opens without login and preserves server-rendered metadata and 404/410 handling.
4. Main-domain `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json`, `/s/*` and signed shared-file URLs behave as before.
5. The API domain and its legacy sharing landing remain unchanged.
6. Existing admin functions and `/privacy` remain available.
7. The API process continuity evidence is unchanged:

```sh
systemctl show server.service -p MainPID -p ExecMainStartTimestamp -p ActiveEnterTimestamp -p NRestarts > <RELEASE>/evidence/api-after.txt
ss -lntp '( sport = :8081 )' > <RELEASE>/evidence/api-listener-after.txt
cmp <RELEASE>/evidence/api-before.txt <RELEASE>/evidence/api-after.txt
```

Inspect the listener evidence to confirm the same 8081 process. Record the
actual release path and completed checks. A local build or candidate preview
alone does not establish that the public domain was deployed.

## Rollback: frontend and main-domain proxy only

Restore the backed-up Caddy configuration, validate it and reload Caddy.
Restore the previous admin drop-in file, or remove only the dedicated new
`90-timeleak-web-release.conf` if it did not exist before. Run
`systemctl daemon-reload` and restart **admin.service only**. Its original
command and untouched `/home/time-leak-admin` checkout remain available.

Never delete unrelated drop-ins, reset production repositories, restore any
API database/uploads, change API configuration or restart 8081 during this
rollback. Recheck the API PID/start timestamps and retain the previous web
release until the frontend has been verified.

## Activated release: 4 November 2026

- Public user app: `https://timeleak.kz/`.
- Admin: `https://timeleak.kz/admin`.
- Release: `/srv/timeleak-web/releases/20261104-0126`.
- Backup: `/srv/timeleak-web/backups/20261104-0126`.
- Admin drop-in: `/etc/systemd/system/admin.service.d/90-timeleak-web.conf`.
- Archive SHA-256: `234a32aa7543c836c9c8f4837a15594ca064fdca707d912bd1ab0d32e73cd265`.
- `admin.service` activated at 01:24:41 on 4 November (Asia/Almaty).
- `server.service` remained PID `1377668`, started 2 November 09:32:15 UTC,
  before and after activation. It was not restarted or reconfigured.
- Public user/admin/manifest/assets/privacy/health/Apple association checks passed.
  Missing assets stay 404; unauthenticated notes API stays 401.
- Browser loaded the published onboarding without console warnings/errors.

Only the main-domain `import share_landing` and its frontend comment changed
in Caddy. The API domain and its 8081 upstream are unchanged. The backend
checkout's only tracked runtime difference remains its existing live DB file.
