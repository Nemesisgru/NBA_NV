# KRGI Academic Audit System (NBA Tier-I Aligned)

A full-stack Academic Audit web application built for **K. Ramakrishnan Group of Institutions (KRGI)** — covering **KRCT**, **KRCE**, and **MKCE**. Aligned with the National Board of Accreditation (NBA) Tier-I Self Assessment Report (SAR) framework across Criteria 1 through 9.

Developed with:
- **Frontend**: React (Vite) + Lucide Icons + Custom Modern CSS Design System
- **Backend**: Django 4.2 + SQLite + Django Admin Control Center + Custom REST APIs
- **Excel Reference**: Directly modeled from `KRGI_Academic_Audit_Format.xlsx`

---

## 🚀 Running the Project (every time you open it)

The app has two parts:

| Part | Folder | Runs on | Needed |
|---|---|---|---|
| **Backend** (Django: API, database, login, and the built website) | `backend/` | http://127.0.0.1:8000 | **Always** |
| **Frontend dev server** (Vite: live reload while editing React code) | `frontend/` | http://localhost:3000 | Only when you change frontend code |

The backend alone is enough to use the website: it serves the compiled React app from `frontend/dist`.

### First time only (one-time setup)
Skip this if the project already runs on this computer.

1. Install **Python 3.10+** (3.11 is used here) and **Node.js 20+**. Check in a terminal:
   ```powershell
   python --version
   node --version
   ```
   If `node` is not found, install Node.js from https://nodejs.org. On the original development computer a
   portable copy also exists (not in git): `$env:PATH = "E:\NBA_NV\tools\nodejs;" + $env:PATH`
2. Install the backend packages and update the database:
   ```powershell
   cd E:\NBA_NV\backend
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py createcachetable
   ```
   For a new, empty database, load the bundled audit data and create the initial Admin account:
   ```powershell
   python manage.py seed_audit_data
   python manage.py changepassword admin
   ```
   `seed_audit_data` creates `admin` without a usable password; choose its password with `changepassword`.
   Do not run the seed command on a database that already contains audit data.
3. Install the frontend packages and build the website:
   ```powershell
   cd E:\NBA_NV\frontend
   npm install
   npm run build
   ```

### Every time: Option A – just use the website (one terminal)
1. Open the project in VS Code and open a terminal: **Terminal → New Terminal** (or `` Ctrl+` ``).
2. Start the backend:
   ```powershell
   cd E:\NBA_NV\backend
   python manage.py runserver 127.0.0.1:8000
   ```
   Optional, same terminal, before `runserver`: `$env:AUDIT_DEBUG = "true"` shows detailed error pages while developing, and `$env:AUDIT_ADMIN_ENABLED = "true"` turns on Django Admin. Both are off by default because they must stay off on the website.
3. Wait until the terminal shows `Starting development server at http://127.0.0.1:8000/`.
4. Open your browser (Chrome, Edge, Firefox) and go to **http://127.0.0.1:8000/**. The login page opens.
   - Django Admin (only when `AUDIT_ADMIN_ENABLED=true`): http://127.0.0.1:8000/admin/
5. **Keep this terminal open** while you use the website. Closing it (or pressing `Ctrl+C`) stops the server, and the website then shows *"Cannot reach the server. Make sure the Django backend is running."*

### Every time: Option B – while editing frontend code (two terminals)
1. **Terminal 1, backend:** same as Option A, steps 1–3:
   ```powershell
   cd E:\NBA_NV\backend
   python manage.py runserver 127.0.0.1:8000
   ```
2. **Terminal 2, frontend:** open a second terminal with the **+** button in the terminal panel:
   ```powershell
   cd E:\NBA_NV\frontend
   npm run dev
   ```
3. Wait for `Local: http://localhost:3000/`, then open **http://localhost:3000/** in your browser.
   Changes you save in `frontend/src` appear in the browser immediately. The dev server forwards `/api` and `/admin` to the backend on port 8000, so **both terminals must stay open**.
4. When you are done editing, build the website so the backend serves the new version on port 8000:
   ```powershell
   cd E:\NBA_NV\frontend
   npm run build
   ```

### After pulling or receiving new code
Run these once before starting the servers, in case the database or packages changed:
```powershell
cd E:\NBA_NV\backend
python manage.py migrate
cd E:\NBA_NV\frontend
npm install
npm run build
```

### Stopping
Click into each terminal and press `Ctrl+C`, or close the terminal.

### Troubleshooting
| Problem | Fix |
|---|---|
| Website says *"Cannot reach the server"* | The backend is not running. Start it (Option A, step 2) and refresh the page. |
| `Error: That port is already in use` | A backend is already running (maybe in another terminal or window); use it, or close it first. To find it: `netstat -ano \| findstr :8000`, then `taskkill /PID <number> /F`. |
| Page on port 8000 shows old screens after frontend changes | Run `npm run build` in `frontend/`, then refresh with `Ctrl+F5`. |
| `python` or `npm` is not recognized | Reopen VS Code after installing Python / Node.js, or use the portable Node.js path shown in the first-time setup. |
| `You have unapplied migration(s)` warning | Stop the backend, run `python manage.py migrate` in `backend/`, start it again. |
| Login works but a tab is missing | Tabs depend on the role: Admin sees all tabs; Auditors and HODs see Criteria, Summary and ATR only. |

> Use `127.0.0.1:8000` (or `localhost:3000` in dev mode). Opening `index.html` directly from the folder does not work, because the website needs the backend for login and data.

---

## 🔐 User Roles & System-Generated Logins

Everyone signs in on the **login page** that opens at `/`. The login is kept in a Django session cookie, so refreshing the page keeps you signed in. What each role can see and change is enforced by the backend API, not only hidden in the UI:

| | Admin | Auditor | HOD | Coll Head |
|---|---|---|---|---|
| Departments visible | All 3 institutes | Only departments allocated to them | Only their own (pickers locked) | Every department of their own college (college picker locked) |
| Criteria Evaluation (C1–C9) | View & edit all | Edit **only their allocated criteria** in the allocated cycle; others view-only | **View-only**, shown as the *Auditor's Report* | **View-only**, shown as the *Auditor's Report* |
| Criterion Summary, Excel / PDF export | All departments | Allocated departments | Own department | Departments of their college |
| Action Taken Report | All fields, all departments | Auditor sign-off & feedback only | Root cause, action plan, target / completed date, evidence, status, HOD remarks | View-only, one or all departments of their college |
| KRGI Dashboard, Result Comparison | ✓ | – | – | ✓ (their college only) |
| AI Assistant | ✓ | Allocated departments | Own department | Departments of their college |
| Auditor Allocation & Admin, Audit Questions, Django Admin (when enabled) | ✓ | – | – | – |
| Other users' login credentials | ✓ | – | – | – |

**Coll Head logins** (one per college, username `head.<college>`, e.g. `head.krct`): the Admin sets the name and email in **Auditor Allocation → Auditor Pool & Auto-Logins → College Head logins**, then uses *Show once* (or *Reset*) to get the first password. Columns hidden in *Audit Questions* are hidden for Coll Heads too.

Role checks live in `backend/audit_core/permissions.py`. Anonymous API calls get `401`; calls outside the user's role or departments get `403`.

### 1. Administrator / IQAC Director
- **Username**: `admin` (the password is never written in this repository)
- **Permissions**: Full control over department additions, auditor pool registry, individual auditor criteria allocations, and global threshold settings.
- Sign in on the login page. Django Admin is available only when enabled (see *Deploying*).

### 2. Head of Department (HOD) Logins
Separate user accounts are generated for every department across all 3 institutes (**36 departments**).
- **Login**: department email `hod.<dept>@<college>.ac.in` (e.g. `hod.cs@krct.ac.in`) or username `hod.<institute_code>.<dept_code>`

*When an HOD logs in, the portal locks to their department. They read the auditor's report (scores and remarks, view-only) and, for every indicator scored below 60%, enter the Root Cause Analysis and Action Plan in the ATR tab. They can also download their department report.*

### 3. Academic Auditor Logins
Separate user accounts are generated for every pooled auditor.
- **Username format**: `auditor.<name_slug>`
- An auditor only sees the departments, criteria and audit cycle the Admin allocated to them.

### Passwords
- Every new HOD / auditor login gets a **random 14-character password**. The Admin sees it once in **Auditor Pool & Auto-Logins** to hand it over.
- At first login the user **must choose their own password** (at least 10 characters, not common, not only numbers). Until then nothing else can be used, and the initial password is deleted from the database once changed. Anyone can change their password later with the **Password** button next to *Log out*.
- To issue new passwords to everyone (required once before going live): `python manage.py rotate_passwords --yes`. It writes the list to `login.md` (git-ignored, confidential; share each line only with that person) and also requires the Admin to change their password at the next login.
- After 5 failed logins for a username (or 25 from one network address) within 15 minutes, logins are refused for 15 minutes.

---

## 📊 Core Features & Workflow

### 1. Criteria Evaluation Process (`C1` to `C9`)
Individual criteria are organized into dedicated tabs matching the NBA SAR:
- **C1**: Outcome-Based Curriculum (120 Marks)
- **C2**: Outcome-Based Teaching Learning (120 Marks)
- **C3**: Outcome-Based Assessment (120 Marks)
- **C4**: Students' Performance (120 Marks)
- **C5**: Faculty Information (100 Marks)
- **C6**: Faculty Contributions (120 Marks)
- **C7**: Facilities and Technical Support (100 Marks)
- **C8**: Continuous Improvement (80 Marks)
- **C9**: Student Support and Governance (120 Marks)

Total: 1000 marks. The "CRITERION N TOTAL" rows of the Excel sheet are sub-totals and are stored as non-scorable header rows.

#### Calculation Rules (Derived from Excel Formulas)
$$\text{Validated Value} = \begin{cases} \left(\frac{\text{Valid Items}}{\text{Items Checked}}\right) \times 100 & \text{if Unit is } \% \\ \text{Valid Items} & \text{if Count} \end{cases}$$

$$\text{Marks Obtained} = \operatorname{ROUND}\left(\text{Max Marks} \times \min\left(\frac{\text{Validated Value}}{\text{Benchmark}}, 1\right), 2\right)$$

$$\text{Percentage} = \operatorname{ROUND}\left(\frac{\text{Marks Obtained}}{\text{Max Marks}} \times 100, 2\right)$$

#### Grade Thresholds
- **Y (Compliant)**: Score $> 75\%$
- **C (Concern)**: Score $60\% - 75\%$
- **W (Weakness)**: Score $40\% - 60\%$
- **D (Deficiency)**: Score $< 40\%$

---

### 2. Automatic Action Taken Report (ATR) Below 60%
Whenever an auditor enters evaluation items and the calculated score is **below 60%** (or falls into grade **W** or **D**):
1. The indicator is **automatically flagged** with `is_flagged_for_atr = True`.
2. An **Action Taken Report (ATR)** record is automatically generated in the database.
3. The HOD can log in, view the flagged indicator, and enter:
   - **Root Cause Analysis**
   - **Corrective Action Plan**
   - **Target Completion Date**
   - **Evidence URL / Document Reference**
   - **Resolution Status** (*Open*, *In Progress*, *Closed*)
4. The auditor reviews the department's action plan and provides the **Auditor Sign-off**.

---

### 3. Audit Questions & Evaluation Columns (per audit)
*Admin only.* The **Audit Questions** tab fixes, for the audit cycle selected at the top, which questions of each criterion are part of the audit and which columns the evaluation table shows. Both apply to every auditor in that cycle; other cycles keep their own settings.

- **Questions**: tick questions individually or a whole criterion. Auditors only see and score the selected questions, and max marks, percentages, grades, the dashboard, comparison, exports and ATR count only those questions. Scores already entered for a removed question are kept and come back if it is selected again. A cycle with nothing saved uses all questions; **Reset to all** returns to that.
- **Columns**: the **Columns** button chooses, column by column, what the evaluation table shows during the audit: Unit / Sample, Verification Rule, Y / C / W / D Rubric, Max Marks, Items Checked, Valid Items, Benchmark, Validated Value, Marks Obt., %, Grade, Auditor Remarks, Evidence Status, Physical Check and Flag ATR. Code and Key Aspect & Indicator are always shown. Hiding *Items Checked* or *Valid Items* stops auditors from entering scores (the page warns about this).
- Click **Save changes** to apply both.

On the evaluation screen the Admin also gets a toolbar (search, grade filter, *Flagged for ATR only*, **Columns**, refresh); HODs and Auditors do not. The Admin's **Columns** button there only changes the Admin's own view; the questions and the columns shown to auditors are fixed only in the **Audit Questions** tab. Which roles get the toolbar is set by `TOOLBAR_ROLES` in `frontend/src/components/CriterionEvaluation.jsx`; the column list lives in `frontend/src/auditColumns.js` (kept in sync with `DEFAULT_COLUMNS` in `backend/audit_core/question_scope.py`).

---

### 4. Auditor Allocation & Individual Criteria Assignment
Inside **Auditor Allocation & Department Administration**:
- Each department can be assigned:
  - **Lead Auditor (Auditor 1)**
  - **Second Auditor (Auditor 2)**
- **Criteria are assigned individually to each auditor**:
  - Auditor 1 can be assigned specific criteria (e.g., `C1, C2, C3`).
  - Auditor 2 can be assigned other criteria (e.g., `C4, C5, C6`).
  - Or click `All (9)` to assign the full criteria scope.
- **Cross-Deployment Rule Check**: Automatically checks that auditors are not assigned to audit their own parent department (e.g., a CSE faculty cannot audit CSE).
- Auditors cannot be assigned to their own college and may be assigned to one department in each of the other two colleges per cycle.
- **Auto allot** prepares a rule-checked preview for departments without complete auditor pairs. It prioritizes auditors not yet used in the cycle, prefers pairs from different home colleges where possible, and reuses an auditor only after no unique pair remains. Review the proposed auditors, unfilled departments, and any faculty assigned twice across colleges before confirming.
- Repeated auditors are highlighted on the allocation table. Use **Edit** beside a department row to change saved auditors; saving changed selections requires the current Admin password and preserves scores and ATRs.
- Individual and full resets remain available with the current Admin password.
- **Full reset** removes all auditor assignments and criteria for the selected cycle while keeping scores and ATRs. The Auditor Pool also offers an Excel directory download without login credentials.

---

### 5. Bulk Auditor Upload & Template
To add auditors in bulk:
1. Navigate to **Auditor Allocation & Admin** → click **"Download Template"** (or call `/api/auditors/template/`).
2. Populate the CSV with:
   ```csv
   Name,Institute,Department,Designation,Experience,Email
   Dr. K. Senthilkumar,KRCT,CSE,Professor,10 and above,senthil.k@krct.ac.in
   Mrs. R. Preethi,KRCE,ECE,Associate Professor,5 - 10 years,preethi.r@krce.ac.in
   ```
3. Click **"Bulk Add Auditors"**, upload the CSV or paste the text, and click **Import**.
4. The system automatically creates the auditor records in the pool **AND provisions a separate login username and password** for each imported member, displaying the credentials immediately.

---

### 6. Provisions to Add Departments
Admins can dynamically add new departments to any institute (**KRCT**, **KRCE**, or **MKCE**):
- Provide: *Institute Code, Department Code, Full Name, HOD Name, HOD Email*.
- The system automatically creates the department **AND auto-provisions the HOD user login account and password**.

---

### 7. Download Department Details in Excel and PDF
Both HODs and Auditors can download complete department audit records for future reference:
1. **Excel / CSV Download**:
   - Click the green **"Excel"** button on the Navbar, Criterion Summary, or ATR Workspace.
   - Generates `<INST>_<DEPT>_Academic_Audit_Report.csv` with:
     - Header info (Institute, Department, Cycle, Date)
     - Section 1: Executive 1000-Marks Summary Table
     - Section 2: Detailed Metric Evaluations & Benchmarks
     - Section 3: Action Taken Report (ATR) for indicators scored below 60%.
2. **Official PDF Report**:
   - Click the blue **"PDF"** / **"Print Audit Sheet"** button.
   - Generates a styled, print-ready formal document featuring the official header, summary scorecards, ATR matrix, and signature blocks for the **Head of Department**, **Lead Auditor**, and **IQAC Coordinator**.

---

### 8. Results Comparison Page
Compare audit results across departments:
- Select up to 10 departments simultaneously using interactive multi-select pills.
- Side-by-side KPI cards showing total score %, grade, and Y/C/W/D distribution.
- Comparative SVG bar chart comparing percentage scores across Criteria 1 through 9.
- Detailed criterion variance breakdown table.

---

### 9. Audit AI Assistant (local model, no paid services)
Tab **AI Assistant** (Admin, Auditor, HOD). Answers questions about the audit data the user is allowed to see, lists missing evidence, pending / overdue corrective actions and findings, compares audit cycles and generates draft reports.

**How it works**
`logged-in user → Django access check (same rules as the rest of the app) → validated request → one of the registered analytics functions → verified figures → optional explanation by a local model (Ollama) → draft report`.
- All figures are calculated by the application with the existing rules (marks formula, Y/C/W/D thresholds in *AuditSettings*, questions fixed per cycle). The model only explains them; it never reads the database, decides access, changes data, or approves anything.
- Without Ollama (stopped, model missing, timeout) the assistant still shows all verified tables and still generates reports, with a note that the AI explanation is unavailable.
- Scope (college / department / cycle) is taken from the selectors and checked on the server; IDs outside the user's access are rejected (403), never replaced.
- Questions are matched to an operation by keyword rules first; only if none match does the model propose one, which is checked against an allowlist. The model cannot choose the college, department or cycle.
- Explanations are plain text. References the model gives that are not in the verified data are removed, and numbers it states that are not in the data are flagged.
- Chats and reports belong to the user who created them; nobody else (including other admins) can open them.

**Definitions used** (shown under *How these figures are defined*): *submission completed* = the question has a grade; *evidence uploaded* = at least one file is attached to the question; *evidence status* = what the auditor recorded (Complete / Partial / Not Uploaded); *evidence verified* = physical check "Matches claim"; *criterion compliant* = every question scored and criterion grade Y; *finding approved* = auditor sign-off on its ATR. An uploaded file never counts as verified or compliant.

**Configured by the Admin / HOD** (shown as "not configured" until set):
- *Mandatory evidence*: in **Audit Questions**, mark questions with **Mandatory?** (per audit cycle). Missing-evidence results then list mandatory questions without an uploaded file.
- *Corrective-action owner*: the HOD enters **Action Owner** in the ATR form; if blank, the HOD is shown as owner. The assistant can filter by owner.
- *Rubric version*: changing a Y/C/W/D threshold (Django Admin → Audit settings) raises the rubric version. Each cycle records the version in force when its first score was saved (cycles scored before this feature record the thresholds at upgrade time). Cycles with different thresholds are not compared; grades are always shown with the current thresholds, as elsewhere in the app.

**Evidence documents**: on **Criteria Evaluation**, each question has an **Evidence (n)** button. The HOD of the department or the Admin uploads PDF / DOCX files (max 10 MB, checked by extension and file signature); everyone who may see the department can download them through an access-checked link; the uploader or the Admin can delete them. Text is extracted in a separate, isolated Python process with a 60-second limit, keeping real PDF page numbers and DOCX headings / paragraph / table numbers (DOCX has no pages, none are invented). No macros, embedded objects or links are executed or fetched. Scanned PDFs without text, password-protected and over-long files are marked **manual verification required** and are never treated as missing or non-compliant. Ask the assistant e.g. *"Search the evidence for industry MoU"*: it searches only the authorised department's extracted text (keyword search, no separate vector database) and quotes excerpts with their EV id and location; document text is treated as data, never as instructions. Files are stored in `backend/evidence_files/` (git-ignored, not web-served).

**Draft reports** (Word `.docx`, Excel `.xlsx`, PDF): one department and cycle, built from a single verified snapshot. Sections: scope, generation time and data timestamp, executive summary, data coverage and missing information, criterion-wise observations, evidence references (as text, never opened), methodology, historical comparison (only identical question sets are compared), existing corrective actions and separately labelled AI suggestions, limitations, and empty review / signature fields. Every page says **DRAFT - requires auditor review**. Files are stored in `backend/generated_reports/` (git-ignored, not web-served), downloadable only by their owner, and deleted after 30 days (`python manage.py cleanup_ai_reports`). Spreadsheet cells that start with `= + - @` are escaped.

**Hardware and model (measured on this laptop)**: Intel i5-1235U, 16 GB RAM, no discrete GPU, so Ollama runs on the CPU. With the installed `qwen3.5:9b` (Apache-2.0, ~6.6 GB) an explanation took about **4–5 minutes** and interpreting a free-form question about 1 minute; verified figures appear instantly because the explanation is requested separately. The model needs about 7 GB of free RAM while loaded. For faster answers use a smaller model, e.g. `ollama pull qwen3:4b` (check its licence with `ollama show qwen3:4b --license`; not benchmarked here), then set `AUDIT_AI_MODEL` or pick it in the app. Running the model costs electricity and machine time but no subscription.

**Setup**
```powershell
# 1. Backend packages, database tables and the cache table
#    (adds python-docx and pypdf; openpyxl and reportlab are used for Excel/PDF)
cd E:\NBA_NV\backend
pip install -r requirements.txt
python manage.py migrate
python manage.py createcachetable

# 2. Ollama (free, local): install from https://ollama.com/download, then
ollama --version
ollama pull qwen3.5:9b            # or a smaller model, see above
ollama show qwen3.5:9b --license  # confirm the licence fits your use
ollama list

# 3. Optional settings (defaults in backend/ai_assistant.env.example), in the same terminal:
$env:AUDIT_AI_MODEL = "qwen3.5:9b"

# 4. Start as usual
python manage.py runserver 127.0.0.1:8000
```
Keep Ollama on `127.0.0.1` (its default). The server refuses Ollama URLs that are not local or private.

**Verify**
```powershell
cd E:\NBA_NV\backend
python manage.py test audit_core     # 54 tests, model mocked, synthetic data
```
Then log in, open **AI Assistant**, choose an audit cycle and click a starter question. To check the model alone: `ollama run qwen3.5:9b "Say OK"`.

**Comparing several departments or colleges**: the *College(s)* and *Department(s)* boxes on **AI Assistant** accept several choices (leave empty for all you may see). **Use Results Comparison selection** copies the departments picked on the Comparison page. Then ask e.g. *"Compare the selected departments in C4"* or *"Which college is best in C2?"*: the result ranks the departments, shows each criterion side by side with the highest, lowest and gap, and, when more than one college is selected, totals per college (selected departments only). HODs and Auditors can only pick departments they already have access to. Draft reports still cover exactly one department.

**Choosing the model in the app (Admin)**: on **AI Assistant**, the *Local model* badge is a dropdown for the Admin listing every model installed in Ollama (`ollama list`). The choice is saved on the server and applies to every user; HODs and Auditors see the active model but cannot change it. Only installed models are accepted (nothing is downloaded). Choosing the `AUDIT_AI_MODEL` default again clears the override. Check a model's licence before selecting it.

**Background jobs, cache and limits**
- Draft reports and evidence text extraction are database-backed jobs (*pending → running → done / failed*). A job is claimed atomically, so it never runs twice. Jobs left in *running* by a restart are retried after 15 minutes (up to 3 attempts), and pending work resumes automatically the next time anyone opens the reports list or an evidence file.
- Optional dedicated worker (recommended when several people generate reports): run `python manage.py run_ai_jobs` in a second terminal (`--once` processes the queue and exits).
- The cache (rate limits, cached explanations, model status) is stored in the database table `audit_cache`, so limits survive restarts and are shared by all server processes.

**Security**
- CSRF protection is on for every API call (existing endpoints included). The React app reads the `csrftoken` cookie set by `/api/auth/me/` and sends it as `X-CSRFToken`. When using the Vite dev server, its origin (`http://localhost:3000`) is trusted via `AUDIT_CSRF_TRUSTED_ORIGINS`.

**Limitations**
- The local model on this laptop is slow (minutes per explanation); everything else works without it.
- Evidence search is keyword-based; no OCR is implemented, so scanned documents must be checked by hand.
- Hiding columns in *Audit Questions* restricts the evaluation table only; the AI Assistant, Criterion Summary, ATR and exports still show scores to HODs/Auditors.

#### Using PostgreSQL (optional)
SQLite remains the default. To run on PostgreSQL (driver `psycopg2-binary` is already installed here):
```powershell
# 1. Create a database and user (psql as the postgres superuser)
#    CREATE USER krgi_audit WITH PASSWORD '<choose one>';
#    CREATE DATABASE krgi_audit OWNER krgi_audit;
# 2. Point the app at it (same terminal as runserver; never commit the password)
$env:AUDIT_DB_ENGINE = "postgresql"; $env:AUDIT_DB_NAME = "krgi_audit"; $env:AUDIT_DB_USER = "krgi_audit"
$env:AUDIT_DB_PASSWORD = "<the password>"; $env:AUDIT_DB_HOST = "127.0.0.1"; $env:AUDIT_DB_PORT = "5432"
# 3. Create the tables, then copy the existing SQLite data across
cd E:\NBA_NV\backend
python manage.py migrate
python manage.py createcachetable
$env:AUDIT_DB_ENGINE = "sqlite"; python manage.py dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission -e sessions -o data.json
$env:AUDIT_DB_ENGINE = "postgresql"; python manage.py loaddata data.json
```

---

## 🌐 Deploying to a website

Security settings come from environment variables; the defaults are already safe (debug off, Django Admin off, only `localhost` accepted). For the website, copy the settings in `backend/deploy.env.example` into the server's environment and fill in the domain name. The steps still to do before and after going live are in **[TODO.md](TODO.md)**.

Check the configuration on the server with:
```powershell
python manage.py check --deploy
```
With `AUDIT_HTTPS=true` only two optional HSTS notes (subdomains, preload list) should remain.

---

## 🛠️ REST API Reference

All endpoints except `auth/login` require a logged-in session. "Scoped" means non-admins only get their own (HOD) or allocated (Auditor) departments.

| Endpoint | Method | Access | Description |
|----------|--------|--------|-------------|
| `/api/auth/login/` | `POST` | Public | Signs in Admin, Auditor, or HOD (username or email); starts a session and returns profile and assigned scope |
| `/api/auth/me/` | `GET` | Any role | Returns the signed-in user (used to restore the session on page load) |
| `/api/auth/logout/` | `POST` | Any role | Ends the session |
| `/api/bootstrap/` | `GET` | Any role, scoped | Institutes, departments, cycles, criteria; auditor pool and credentials for Admin only |
| `/api/criteria/<code\>/` | `GET` | Any role, scoped | Indicators and evaluation marks for criterion `code`, plus `can_edit` for the current user |
| `/api/evaluations/save/` | `POST` | Admin, allocated Auditor | Saves evaluation; auto-calculates marks; flags and adds to ATR if `< 60%` |
| `/api/criterion-summary/` | `GET` | Any role, scoped | 1000-marks executive summary for a department |
| `/api/dashboard/` | `GET` | Admin | Cross-department and cross-institute performance matrix |
| `/api/comparison/` | `GET` | Admin | Multi-department criterion score comparison |
| `/api/atr/` | `GET` | Any role, scoped | Action Taken Reports filtered by department, status, grade, institute or criterion |
| `/api/atr/update/` | `POST` | Any role, scoped | HOD: root cause, plan, dates, evidence, status, remarks. Auditor: sign-off and feedback. Admin: all |
| `/api/cycle-questions/` | `GET` | Admin | All questions of a cycle grouped by criterion, with the fixed selection and evaluation columns |
| `/api/cycle-questions/save/` | `POST` | Admin | Saves a cycle's questions (`metric_ids` or `reset`) and/or `visible_columns` |
| `/api/evidence/?department_id=&cycle_id=[&metric_id=]` | `GET` | Any role, scoped | Evidence files of a department's audit |
| `/api/evidence/upload/` | `POST` (multipart) | Admin, HOD of the department | Upload a PDF / DOCX for one question (text extracted in the background) |
| `/api/evidence/<id>/`, `/api/evidence/<id>/download/` | `GET`, `DELETE` | Scoped; delete: uploader or Admin | File details / protected download |
| `/api/ai/status/` | `GET` | Any role, scoped | Local model availability and the user's selectable colleges, departments, cycles |
| `/api/ai/analytics/` | `POST` | Any role, scoped | Runs one allowlisted analytics operation (no AI) |
| `/api/ai/chat/` | `POST` | Any role, scoped | Question → validated operation → verified result (explanation requested separately) |
| `/api/ai/messages/<id>/narrate/` | `POST` | Owner | Local-model explanation of a stored verified result |
| `/api/ai/conversations/`, `/api/ai/conversations/<id>/` | `GET`, `DELETE` | Owner | Own conversations; delete = reset |
| `/api/ai/reports/` | `GET`, `POST` | Owner, scoped | List own draft reports / start one (one department + cycle) |
| `/api/ai/reports/<id>/`, `/api/ai/reports/<id>/download/<docx\|xlsx\|pdf>/` | `GET`, `DELETE` | Owner, scope re-checked | Report status / protected download |
| `/api/assignments/` | `GET` | Admin | Auditor assignments with individual criteria allocations |
| `/api/assignments/save/` | `POST` | Admin | Saves Lead/Second auditors and criteria per auditor |
| `/api/assignments/auto-allot/` | `POST` | Admin | Previews or applies valid auditor assignments for unfilled departments |
| `/api/assignments/reset/`, `/api/assignments/reset-all/` | `POST` | Admin + current password | Removes one or all assignments for a cycle; preserves scores and ATRs |
| `/api/departments/add/` | `POST` | Admin | Adds a department and provisions the HOD login |
| `/api/auditors/add/` | `POST` | Admin | Registers an auditor and generates username & password |
| `/api/auditors/export/` | `GET` | Admin | Downloads the auditor directory as an Excel workbook (no credentials) |
| `/api/auditors/template/`| `GET` | Admin | CSV template for bulk auditor import |
| `/api/auditors/bulk-upload/`| `POST` | Admin | Imports auditors from CSV and generates logins |
| `/api/export/department-excel/` | `GET` | Any role, scoped | Department audit sheet and ATR as Excel-compatible CSV |
| `/api/export/department-pdf/` | `GET` | Any role, scoped | Printable / PDF-exportable formal audit report |

---

## 📂 Project Structure

```
E:\NBA_NV/
├── KRGI_Academic_Audit_Format.xlsx   # Master source Excel workbook
├── parsed_audit_data.json            # Parsed structure of all 9 criteria, auditors, & rubrics
├── README.md                         # Complete project documentation
├── backend/                          # Django Backend
│   ├── manage.py
│   ├── db.sqlite3                    # Relational database pre-seeded with all tables
│   ├── audit_backend/
│   │   ├── settings.py               # Django configuration & CORS setup
│   │   ├── urls.py                   # Main router (Admin, API, static assets, React dist)
│   │   └── wsgi.py
│   └── audit_core/
│       ├── models.py                 # Django models (Auditor, Department, Evaluation, ATR, etc.)
│       ├── admin.py                  # Django Admin customized with badges & credentials
│       ├── auth_utils.py             # Automatic username and password provisioning
│       ├── permissions.py            # Role detection, department scoping & API access checks
│       ├── views.py                  # REST API endpoints, Excel/PDF exports, & login
│       ├── question_scope.py         # Questions and evaluation columns fixed per audit cycle
│       ├── urls.py                   # App URL routes
│       └── management/commands/
│           ├── seed_audit_data.py    # Database seeder from Excel JSON
│           ├── seed_test_audit.py    # Cross-college test audit (allocation, scores, ATR) for all departments
│           └── provision_logins.py   # Bulk user account and password generator
└── frontend/                         # React Frontend (Vite)
    ├── package.json
    ├── vite.config.js                # Port 3000 config & proxy to Django
    ├── index.html                    # SEO & Google Fonts (Plus Jakarta Sans)
    └── src/
        ├── index.css                 # Custom design system with HSL dark mode & glassmorphism
        ├── App.jsx                   # Session restore, role-based tabs & main application state
        ├── hooks/
        │   └── useSlidingIndicator.js # Sliding active-tab indicator used by the tab bars
        └── components/
            ├── LoginPage.jsx         # Full-screen sign-in page shown before the app
            ├── Navbar.jsx            # Header, context pickers, role-filtered tabs, logout & export buttons
            ├── CriterionEvaluation.jsx # C1-C9 rubrics, live formulas, per-audit columns
            ├── CriterionSummary.jsx  # 1000-marks summary table & Excel/PDF downloads
            ├── KRGIDashboard.jsx     # KRGI cross-institutional matrix & heatmap
            ├── ATRWorkspace.jsx      # Action Taken Report workspace with <60% rule
            ├── AdminAllocation.jsx   # Individual criteria assignment & bulk upload modal
            ├── AuditQuestionSetup.jsx # Admin: questions & evaluation columns per audit cycle
            └── ComparisonPage.jsx    # Side-by-side department analytics & bar charts
```
