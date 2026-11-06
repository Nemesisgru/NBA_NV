# TODO: before and after deploying the KRGI Academic Audit System

Settings referred to below are in `backend/deploy.env.example`. Status checked on 06-Nov-2026.

## A. Required before the site goes liveṁ

- [x] **New passwords for everyone.** Done with `python manage.py rotate_passwords --yes`: all 36 HODs and
  48 auditors have new random passwords, listed in `login.md` (git-ignored, confidential: share each line
  only with that person). Everyone, the Admin included, must choose their own password at the next login.
  The previous `login.md` is kept in `backend/backups/login-before-rotation-20261106.md`.
- [x] **Secret files removed from git.** `login.md` and `backend/db.sqlite3` are untracked and ignored.
- [ ] **Push the cleaned GitHub history (you must run this; it rewrites history).** A cleaned copy is ready
  in `backend/backups/NBA_NV-cleaned.git`: every commit without `login.md`, the database, `.pyc` files and
  the old `admin123` text. The full original history is saved in
  `backend/backups/repo-history-before-purge-20261106.bundle`.
  1. If the repository is public, make it private first (GitHub → Settings → General → Danger zone).
  2. Push the cleaned history:
     ```powershell
     cd E:\NBA_NV\backend\backups\NBA_NV-cleaned.git
     git push --force https://github.com/Nemesisgru/NBA_NV.git main role-based-login
     ```
  3. Move your working copy onto it (your files stay as they are; only the history changes):
     ```powershell
     cd E:\NBA_NV
     git fetch origin
     git reset --mixed origin/main
     git branch -f role-based-login origin/role-based-login
     git add -A
     git commit -m "Show-once passwords and TODO update"
     git push origin main
     git reflog expire --expire=now --all
     git gc --prune=now
     ```
  4. Anyone else with a copy of the repository must clone it again. GitHub may keep old commits
     reachable by their exact address for a while; GitHub Support can purge them on request.
- [x] **Django upgraded** to 5.2.19 (LTS). All tests pass.
- [ ] **Set the production environment on the server** from `backend/deploy.env.example`: a new
  `AUDIT_SECRET_KEY`, `AUDIT_ALLOWED_HOSTS`, `AUDIT_CSRF_TRUSTED_ORIGINS`, `AUDIT_HTTPS=true`,
  `AUDIT_BEHIND_PROXY=true`. Needs the website's domain name. Then run `python manage.py check --deploy`.
- [x] **Django Admin:** kept off (default). To use it, set `AUDIT_ADMIN_ENABLED=true`, an unusual
  `AUDIT_ADMIN_PATH` and `AUDIT_ADMIN_ALLOWED_IPS`.
- [x] **KRCE – AI&ML assignment** with two ECE auditors has been reset.

## B. Hosting

- [x] Production server: `python manage.py serve_production` (Waitress, 127.0.0.1:8000; on Linux, gunicorn).
  Tested: pages, assets, admin files, API and headers are served correctly.
- [ ] On the server: put nginx (or IIS) with an HTTPS certificate (e.g. Let's Encrypt) in front of it.
- [x] Built frontend and admin files are served by WhiteNoise (`npm run build`, then
  `python manage.py collectstatic --noinput` on every release).
- [ ] Raise `AUDIT_HSTS_SECONDS` from 3600 to 31536000 after a week of trouble-free HTTPS.
- [x] Content-Security-Policy on every page (scripts only from the site; the printable report uses a nonce).
- [x] Time zone set to `Asia/Kolkata` (ATR overdue dates and report times use local time).

## C. Data and database

- [x] Backup command: `python manage.py backup_data --verify` (consistent database copy and evidence zip,
  keeps the newest 14). Restore tested: the site runs from the copy with all data.
- [ ] On the server: schedule it daily, e.g.
  `schtasks /Create /SC DAILY /ST 02:00 /TN "KRGI audit backup" /TR "python E:\NBA_NV\backend\manage.py backup_data"`,
  and copy `backend/backups` to another machine or drive.
- [ ] PostgreSQL only if many people will edit at the same time (supported; see README).
- [ ] Do not copy `backend/backups/` to the web server; delete old copies there once no longer needed
  (they contain logins and audit data).

## D. Accounts and security

- [x] Initial passwords are shown to the Admin **once** (Auditor Pool and, for HODs, under each department in
  the assignments table: *Show once* / *Reset*) and are no longer kept in readable form.
- [ ] "Forgot password" by email: needs an SMTP account for the college domain (host, user, password).
- [ ] Two-factor login for the Admin: needs a decision (authenticator app) before it is added.
- [x] Session length reviewed: 8 hours, and logins end when the browser is closed (`AUDIT_SESSION_HOURS`).
- [x] Dependencies checked: pypdf upgraded to 6.21.4 (103 known issues in 5.1.0); `pip-audit` and
  `npm audit` now report no known vulnerabilities. Repeat on every release.

## E. AI assistant

- [x] Ollama is configured to listen on 127.0.0.1 only (`OLLAMA_HOST=127.0.0.1:11434`). Keep port 11434 closed
  on the server's firewall.
- [ ] On the server, choose the model in the AI Assistant (`llama3.2:3b` is faster on a CPU) or set
  `AUDIT_AI_ENABLED=false`.

## F. Monitoring

- [x] Server log written to `backend/logs/audit.log` (rotating, git-ignored): unexpected errors, failed logins
  (username and address, never the password) and AI operations.
- [ ] An uptime monitor for the website address (external service).

## G. Repository clean-up

- [x] `tools/nodejs/` and `.pyc` files are no longer tracked (kept on disk, ignored).
