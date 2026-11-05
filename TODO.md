# TODO: before and after deploying the KRGI Academic Audit System

Settings referred to below are in `backend/deploy.env.example`. Tick items off as they are done.

## A. Required before the site goes live (needs your decision or access)

- [ ] **Issue new passwords to everyone.** In `backend/`: `python manage.py rotate_passwords --yes`.
  It gives every HOD and auditor a new random password, writes the list to `login.md` (git-ignored,
  confidential: share each line only with that person) and requires the Admin to change their password at
  the next login. Every user must choose their own password at first login.
- [ ] **Commit the removal of the secret files from git.** `login.md` and `backend/db.sqlite3` are now
  untracked (still on disk) and ignored. Commit that change.
- [ ] **Remove them from the GitHub history too.** They are in earlier commits on `origin/main`, and so is
  the old Admin password in earlier README versions. Rotating the passwords makes the old ones useless,
  but names, emails and audit data remain in those commits.
  1. If the repository is public, make it private first (GitHub → Settings → General → Danger zone).
  2. `pip install git-filter-repo`, then in a fresh clone:
     `git filter-repo --invert-paths --path login.md --path backend/db.sqlite3`
  3. `git push --force --all` (this rewrites history; everyone else must clone again).
- [ ] **Upgrade Django.** The project uses Django 4.2, whose security support ended in April 2026.
  Move to the current LTS (5.2), run `python manage.py test audit_core`, and pin it in `requirements.txt`.
- [ ] **Set the production environment** from `backend/deploy.env.example`: a new `AUDIT_SECRET_KEY`,
  `AUDIT_ALLOWED_HOSTS`, `AUDIT_CSRF_TRUSTED_ORIGINS`, `AUDIT_HTTPS=true`, `AUDIT_BEHIND_PROXY=true`.
  Then run `python manage.py check --deploy` on the server.
- [ ] **Decide on Django Admin.** It is off by default. If you need it on the website, set
  `AUDIT_ADMIN_ENABLED=true`, an unusual `AUDIT_ADMIN_PATH` and `AUDIT_ADMIN_ALLOWED_IPS` (office address).
- [ ] **Fix the KRCE – AI&ML assignment** (2026-2027 Odd): both auditors are from ECE. Use Reset on that
  row in Auditor Allocation and choose a second auditor from another department.

## B. Hosting

- [ ] Run Django with a production server (gunicorn on Linux, waitress on Windows) behind nginx with an
  HTTPS certificate (e.g. Let's Encrypt). Do not use `manage.py runserver` on the website.
- [ ] Serve the built frontend (`frontend/dist`) through nginx or WhiteNoise instead of Django's
  development file server. Run `npm run build` on every release.
- [ ] Raise `AUDIT_HSTS_SECONDS` from 3600 to 31536000 after a week of trouble-free HTTPS.
- [ ] Add a Content-Security-Policy header in nginx (e.g. `default-src 'self'`) and test every page.
- [ ] Set `TIME_ZONE = 'Asia/Kolkata'` in `settings.py` so ATR target and overdue dates use local time.

## C. Data and database

- [ ] Automatic daily backups of the database (and `backend/evidence_files/`), kept off the server too.
  Test a restore once.
- [ ] Move to PostgreSQL if many people will edit at the same time (settings already supported; see README
  "Using PostgreSQL").
- [ ] Keep `backend/backups/` off the web server or delete old copies once no longer needed: they contain
  logins and audit data.

## D. Accounts and security

- [ ] Show each initial password to the Admin only once (or send it by email) instead of keeping it in the
  database until the user's first login.
- [ ] "Forgot password" by email (needs an SMTP account for the college domain).
- [ ] Two-factor login for the Admin account.
- [ ] Review the login session length (`AUDIT_SESSION_HOURS`, now 8 hours, and logins end when the
  browser is closed).
- [ ] Check dependencies for known vulnerabilities on each release: `pip install pip-audit && pip-audit`,
  and `npm audit` in `frontend/`.

## E. AI assistant

- [ ] Keep Ollama on `127.0.0.1` (or the private network) only; never open port 11434 on the firewall.
- [ ] On a server without a GPU, explanations are slow: choose `llama3.2:3b` in the AI Assistant, or set
  `AUDIT_AI_ENABLED=false`. Verified figures and reports work without the model.

## F. Monitoring

- [ ] Write the Django log to a file and review it: unexpected API errors are logged, and failed logins
  are logged as `audit_core.security` (username and address, never the password).
- [ ] An uptime monitor for the website address.

## G. Repository clean-up

- [ ] Remove items that do not belong in git: `tools/nodejs/` and tracked `__pycache__/*.pyc` files
  (`git rm -r --cached tools/nodejs`, then add `tools/` to `.gitignore`).
