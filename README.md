# KRGI Academic Audit System (NBA Tier-I Aligned)

A full-stack Academic Audit web application built for **K. Ramakrishnan Group of Institutions (KRGI)** — covering **KRCT**, **KRCE**, and **MKCE**. Aligned with the National Board of Accreditation (NBA) Tier-I Self Assessment Report (SAR) framework across Criteria 1 through 9.

Developed with:
- **Frontend**: React (Vite) + Lucide Icons + Custom Modern CSS Design System
- **Backend**: Django 4.2 + SQLite + Django Admin Control Center + Custom REST APIs
- **Excel Reference**: Directly modeled from `KRGI_Academic_Audit_Format.xlsx`

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+ with the backend requirements installed (use a virtual environment for this project):
  ```powershell
  cd E:\NBA_NV\backend
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  pip install -r requirements.txt
  ```
- Node.js (A portable Node.js v20.18.0 environment is pre-configured in `tools/nodejs/`)

### 2. Start Backend Server
```powershell
cd E:\NBA_NV\backend
python manage.py runserver 127.0.0.1:8000
```
- **Web Application**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/) (opens the login page; serves the compiled React application and REST API)
- **Django Admin Portal**: [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)

### 3. (Optional) Run React Frontend in Dev Mode
If you want hot-module replacement during frontend development:
```powershell
cd E:\NBA_NV\frontend
$env:PATH = "E:\NBA_NV\tools\nodejs;" + $env:PATH
npm run dev
```
Access the dev server at: [http://localhost:3000/](http://localhost:3000/) (proxies API requests to port 8000).

After changing frontend code, run `npm run build` so Django serves the new version from `frontend/dist`.

---

## 🔐 User Roles & System-Generated Logins

Everyone signs in on the **login page** that opens at `/`. The login is kept in a Django session cookie, so refreshing the page keeps you signed in. What each role can see and change is enforced by the backend API, not only hidden in the UI:

| | Admin | Auditor | HOD |
|---|---|---|---|
| Departments visible | All 3 institutes | Only departments allocated to them | Only their own (pickers locked) |
| Criteria Evaluation (C1–C9) | View & edit all | Edit **only their allocated criteria** in the allocated cycle; others view-only | **View-only**, shown as the *Auditor's Report* |
| Criterion Summary, Excel / PDF export | All departments | Allocated departments | Own department |
| Action Taken Report | All fields, all departments | Auditor sign-off & feedback only | Root cause, action plan, target / completed date, evidence, status, HOD remarks |
| KRGI Dashboard, Result Comparison | ✓ | – | – |
| Auditor Allocation & Admin, Django Admin | ✓ | – | – |
| Other users' login credentials | ✓ | – | – |

Role checks live in `backend/audit_core/permissions.py`. Anonymous API calls get `401`; calls outside the user's role or departments get `403`.

### 1. Administrator / IQAC Director
- **Username**: `admin`
- **Password**: `admin123`
- **Permissions**: Full control over department additions, auditor pool registry, individual auditor criteria allocations, and global threshold settings.
- Sign in on the login page, or at `/admin/` for Django Admin.
- **Change this password before real use.**

### 2. Head of Department (HOD) Logins
Separate user accounts and passwords are automatically generated for every department across all 3 institutes (**36 departments**).
- **Login**: department email `hod.<dept>@<college>.ac.in` (e.g. `hod.cs@krct.ac.in`, `hod.ce@mkce.ac.in`) or username `hod.<institute_code>.<dept_code>`
- **Passwords**: random temporary passwords, issued separately in `login.md` (git-ignored, not committed)

*When an HOD logs in, the portal locks to their department. They read the auditor's report (scores and remarks, view-only) and, for every indicator scored below 60%, enter the Root Cause Analysis and Action Plan in the ATR tab. They can also download their department report.*

### 3. Academic Auditor Logins
Separate user accounts and passwords are automatically generated for all **44 pooled auditors** from the Excel sheet.
- **Username Format**: `auditor.<name_slug>`
- **Password Format**: `Audit@<Name>#` (predictable; reset these before real use)
- An auditor only sees the departments, criteria and audit cycle the Admin allocated to them.
- **Examples**:
  | Auditor Name | Institute & Dept | Auto Username | Auto Password |
  |--------------|------------------|---------------|---------------|
  | Dr. A. Oorkalan | KRCT - CIVIL | `auditor.oorkalan` | `Audit@Oorkalan#` |
  | Dr. S. Dinesh | KRCT - MECH | `auditor.dinesh` | `Audit@Dinesh#` |
  | Dr. Syed Akbar | KRCT - ECE | `auditor.syedakbar` | `Audit@Syedakbar#` |
  | Mr. R. Rajavarman | KRCT - CSE | `auditor.rajavarman` | `Audit@Rajavarman#` |
  | Dr. A. T. Sankara Subramaiyan | KRCT - EEE | `auditor.sankarasubramaiyan` | `Audit@Sankarasubramaiyan#` |

*All auditor credentials can be reviewed and copied by the Admin in the **Auditor Pool & Auto-Logins** tab in the web app or in Django Admin at `/admin/audit_core/auditor/`.*

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

### 3. Rows & Columns Checkboxes
*Admin only.* The evaluation toolbar (search, grade filter, "Flagged for ATR only", Columns Checkbox, refresh) and the row selection checkboxes are an administrative tool and are hidden for HODs and Auditors. Which roles get it is set by `TOOLBAR_ROLES` in `frontend/src/components/CriterionEvaluation.jsx`.

- **Column Visibility Checkboxes**: Use the **"Columns Checkbox"** menu on the evaluation screen to toggle display of:
  - Sampling Guidelines
  - Rubrics Text (Y/C/W/D criteria)
  - Auditor Inputs (Items Checked / Valid Items)
  - Calculated Marks & Percentages
  - Auditor Remarks
  - Evidence & Physical Check Status
  - ATR Flag Checkbox
- **Row Selection Checkboxes**: Select rows individually or click **Select All** to perform bulk actions (e.g. bulk flagging for ATR or exporting).

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
- Select up to 5 departments simultaneously using interactive multi-select pills.
- Side-by-side KPI cards showing total score %, grade, and Y/C/W/D distribution.
- Comparative SVG bar chart comparing percentage scores across Criteria 1 through 9.
- Detailed criterion variance breakdown table.

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
| `/api/assignments/` | `GET` | Admin | Auditor assignments with individual criteria allocations |
| `/api/assignments/save/` | `POST` | Admin | Saves Lead/Second auditors and criteria per auditor |
| `/api/departments/add/` | `POST` | Admin | Adds a department and provisions the HOD login |
| `/api/auditors/add/` | `POST` | Admin | Registers an auditor and generates username & password |
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
│       ├── urls.py                   # App URL routes
│       └── management/commands/
│           ├── seed_audit_data.py    # Database seeder from Excel JSON
│           └── provision_logins.py   # Bulk user account and password generator
└── frontend/                         # React Frontend (Vite)
    ├── package.json
    ├── vite.config.js                # Port 3000 config & proxy to Django
    ├── index.html                    # SEO & Google Fonts (Plus Jakarta Sans)
    └── src/
        ├── index.css                 # Custom design system with HSL dark mode & glassmorphism
        ├── App.jsx                   # Session restore, role-based tabs & main application state
        └── components/
            ├── LoginPage.jsx         # Full-screen sign-in page shown before the app
            ├── Navbar.jsx            # Header, context pickers, role-filtered tabs, logout & export buttons
            ├── CriterionEvaluation.jsx # C1-C9 rubrics, live formulas, column & row checkboxes
            ├── CriterionSummary.jsx  # 1000-marks summary table & Excel/PDF downloads
            ├── KRGIDashboard.jsx     # KRGI cross-institutional matrix & heatmap
            ├── ATRWorkspace.jsx      # Action Taken Report workspace with <60% rule
            ├── AdminAllocation.jsx   # Individual criteria assignment & bulk upload modal
            └── ComparisonPage.jsx    # Side-by-side department analytics & bar charts
```
