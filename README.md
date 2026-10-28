# KRGI Academic Audit System (NBA Tier-I Aligned)

A full-stack Academic Audit web application built for **K. Ramakrishnan Group of Institutions (KRGI)** — covering **KRCT**, **KRCE**, and **MKCE**. Aligned with the National Board of Accreditation (NBA) Tier-I Self Assessment Report (SAR) framework across Criteria 1 through 9.

Developed with:
- **Frontend**: React (Vite) + Lucide Icons + Custom Modern CSS Design System
- **Backend**: Django 6.0 + SQLite + Django Admin Control Center + Custom REST APIs
- **Excel Reference**: Directly modeled from `KRGI_Academic_Audit_Format.xlsx`

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+ (Django is installed in the system environment)
- Node.js (A portable Node.js v20.18.0 environment is pre-configured in `tools/nodejs/`)

### 2. Start Backend Server
From the project root:
```powershell
cd "d:\NBA project\backend"
python manage.py runserver 127.0.0.1:8000
```
- **Web Application**: [http://127.0.0.1:8000/](http://127.0.0.1:8000/) (serves compiled React application and live REST API)
- **Django Admin Portal**: [http://127.0.0.1:8000/admin/](http://127.0.0.1:8000/admin/)

### 3. (Optional) Run React Frontend in Dev Mode
If you want hot-module replacement during frontend development:
```powershell
cd "d:\NBA project\frontend"
$env:PATH = "d:\NBA project\tools\nodejs;" + $env:PATH
npm run dev
```
Access the dev server at: [http://localhost:3000/](http://localhost:3000/) (proxies API requests to port 8000).

---

## 🔐 User Roles & System-Generated Logins

The application includes a role-based authentication and context management system:

### 1. Administrator / IQAC Director
- **Username**: `admin`
- **Password**: `admin123`
- **Permissions**: Full control over department additions, auditor pool registry, individual auditor criteria allocations, and global threshold settings.
- Access via the **Login** button on the web app or at `/admin/`.

### 2. Head of Department (HOD) Logins
Separate user accounts and passwords are automatically generated for every department across all 3 institutes (**36 departments**).
- **Login**: department email `hod.<dept>@<college>.ac.in` (e.g. `hod.cs@krct.ac.in`, `hod.ce@mkce.ac.in`) or username `hod.<institute_code>.<dept_code>`
- **Passwords**: random temporary passwords, issued separately in `login.md` (git-ignored, not committed)

*When an HOD logs in, the portal automatically locks to their department, allowing them to review auditor remarks, inspect all indicators scored below 60%, enter Root Cause Analysis and Action Plans, and download their department report.*

### 3. Academic Auditor Logins
Separate user accounts and passwords are automatically generated for all **44 pooled auditors** from the Excel sheet.
- **Username Format**: `auditor.<name_slug>`
- **Password Format**: `Audit@<Name>#`
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
- **C1**: Outcome-Based Curriculum (35 Marks)
- **C2**: Outcome-Based Teaching Learning (100 Marks)
- **C3**: Outcome-Based Assessment (125 Marks)
- **C4**: Students' Performance (100 Marks)
- **C5**: Faculty Information (100 Marks)
- **C6**: Faculty Contributions (100 Marks)
- **C7**: Facilities and Technical Support (80 Marks)
- **C8**: Continuous Improvement (75 Marks)
- **C9**: Student Support and Governance (120 Marks)

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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login/` | `POST` | Authenticates Admin, Auditor, or HOD; returns profile and assigned scope |
| `/api/bootstrap/` | `GET` | Returns institutes, departments, cycles, criteria, auditors, and credentials |
| `/api/criteria/<code\>/` | `GET` | Returns all indicators and department evaluation marks for criterion `code` |
| `/api/evaluations/save/` | `POST` | Saves evaluation; auto-calculates marks; flags and adds to ATR if `< 60%` |
| `/api/criterion-summary/` | `GET` | Returns 1000-marks executive summary for selected department |
| `/api/dashboard/` | `GET` | Returns cross-department and cross-institute performance matrix |
| `/api/comparison/` | `GET` | Compares multi-department criterion scores and bar chart metrics |
| `/api/atr/` | `GET` | Lists Action Taken Reports filtered by department, status, or grade |
| `/api/atr/update/` | `POST` | Updates ATR root cause, action plan, target date, and auditor sign-off |
| `/api/assignments/` | `GET` | Lists auditor assignments with individual criteria allocations |
| `/api/assignments/save/` | `POST` | Saves Lead/Second auditors and individual criteria assignment per auditor |
| `/api/departments/add/` | `POST` | Adds new department and auto-provisions HOD login credentials |
| `/api/auditors/add/` | `POST` | Registers auditor and auto-generates username & password |
| `/api/auditors/template/`| `GET` | Downloads CSV template for bulk auditor import |
| `/api/auditors/bulk-upload/`| `POST` | Imports CSV auditors in bulk and auto-generates login credentials |
| `/api/export/department-excel/` | `GET` | Downloads full department audit sheet and ATR in Excel-compatible CSV |
| `/api/export/department-pdf/` | `GET` | Opens printable/PDF-exportable formal academic audit report |

---

## 📂 Project Structure

```
d:\NBA project/
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
        ├── App.jsx                   # Main application state & role-based routing
        └── components/
            ├── Navbar.jsx            # Header, role switcher, login modal, & export buttons
            ├── CriterionEvaluation.jsx # C1-C9 rubrics, live formulas, column & row checkboxes
            ├── CriterionSummary.jsx  # 1000-marks summary table & Excel/PDF downloads
            ├── KRGIDashboard.jsx     # KRGI cross-institutional matrix & heatmap
            ├── ATRWorkspace.jsx      # Action Taken Report workspace with <60% rule
            ├── AdminAllocation.jsx   # Individual criteria assignment & bulk upload modal
            └── ComparisonPage.jsx    # Side-by-side department analytics & bar charts
```
