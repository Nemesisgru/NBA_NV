# KRGI Academic Audit System: Login Credentials

> **Confidential.** Temporary passwords. Share each HOD's line with that HOD only, and ask them to change it after first login.
> This file is git-ignored; do not commit or email it as a whole.

App: http://127.0.0.1:8001/ → **Login**. HODs may sign in with **either** the email or the username.

## Super Admin (IQAC)

| Role | Username | Email (also accepted) | Password | Access |
|---|---|---|---|---|
| Super Admin | `admin` | `iqac@krct.ac.in` | `admin123` | Web app (all tabs) and Django admin at `/admin/` |

> ⚠️ `admin123` is the original default and is also printed in README.md. Change it before the system is used outside this machine: `cd backend && python manage.py changepassword admin`.

## Heads of Department

HOD logins open directly on their own department (ATR tab) and can view the criteria scores, summary and auditor remarks for that department only.

### KRCT: K. Ramakrishnan College of Technology

| Department | HOD Email (login) | Username | Temporary Password |
|---|---|---|---|
| CSE: Computer Science and Engineering | `hod.cs@krct.ac.in` | `hod.krct.cse` | `Hod#NQ5NAt9o` |
| CSBS: Computer Science and Business Systems | `hod.csbs@krct.ac.in` | `hod.krct.csbs` | `Hod#VYAVI6Vy` |
| AI&DS: Artificial Intelligence and Data Science | `hod.aids@krct.ac.in` | `hod.krct.aids` | `Hod#FlMRw1ZA` |
| AI&ML: Artificial Intelligence and Machine Learning | `hod.aiml@krct.ac.in` | `hod.krct.aiml` | `Hod#cTrN5fda` |
| ECE: Electronics and Communication Engineering | `hod.ec@krct.ac.in` | `hod.krct.ece` | `Hod#D3jXnnSc` |
| EEE: Electrical and Electronics Engineering | `hod.ee@krct.ac.in` | `hod.krct.eee` | `Hod#QM9bskva` |
| MECH: Mechanical Engineering | `hod.me@krct.ac.in` | `hod.krct.mech` | `Hod#jKf3A5rm` |
| CIVIL: Civil Engineering | `hod.ce@krct.ac.in` | `hod.krct.civil` | `Hod#pdZFYi12` |
| CSE (CS): Computer Science and Engineering (Cyber Security) | `hod.cy@krct.ac.in` | `hod.krct.csecs` | `Hod#aeV6wbkj` |
| ECE (VLSI): Electronics and Communication (VLSI Design) | `hod.vlsi@krct.ac.in` | `hod.krct.ecevlsi` | `Hod#N6uzch1S` |

### KRCE: K. Ramakrishnan College of Engineering

| Department | HOD Email (login) | Username | Temporary Password |
|---|---|---|---|
| CSE: Computer Science and Engineering | `hod.cs@krce.ac.in` | `hod.krce.cse` | `Hod#4d86MjyC` |
| CSBS: Computer Science and Business Systems | `hod.csbs@krce.ac.in` | `hod.krce.csbs` | `Hod#ImL9sNWA` |
| AI&DS: Artificial Intelligence and Data Science | `hod.aids@krce.ac.in` | `hod.krce.aids` | `Hod#TYf1gPoD` |
| AI&ML: Artificial Intelligence and Machine Learning | `hod.aiml@krce.ac.in` | `hod.krce.aiml` | `Hod#GnqH8cTA` |
| ECE: Electronics and Communication Engineering | `hod.ec@krce.ac.in` | `hod.krce.ece` | `Hod#LDjYw98W` |
| EEE: Electrical and Electronics Engineering | `hod.ee@krce.ac.in` | `hod.krce.eee` | `Hod#a29hzQXT` |
| MECH: Mechanical Engineering | `hod.me@krce.ac.in` | `hod.krce.mech` | `Hod#0nxyb6sX` |
| CIVIL: Civil Engineering | `hod.ce@krce.ac.in` | `hod.krce.civil` | `Hod#PuGWf3im` |
| CSE (CS): Computer Science and Engineering (Cyber Security) | `hod.cy@krce.ac.in` | `hod.krce.csecs` | `Hod#T130aSso` |
| ECE (VLSI): Electronics and Communication (VLSI Design) | `hod.vlsi@krce.ac.in` | `hod.krce.ecevlsi` | `Hod#85F0IjbF` |

### MKCE: M. Kumarasamy College of Engineering

| Department | HOD Email (login) | Username | Temporary Password |
|---|---|---|---|
| CSE: Computer Science and Engineering | `hod.cs@mkce.ac.in` | `hod.mkce.cse` | `Hod#8gwJIFeU` |
| CSBS: Computer Science and Business Systems | `hod.csbs@mkce.ac.in` | `hod.mkce.csbs` | `Hod#n2cVLb7k` |
| AI&DS: Artificial Intelligence and Data Science | `hod.aids@mkce.ac.in` | `hod.mkce.aids` | `Hod#edjFJh44` |
| AI&ML: Artificial Intelligence and Machine Learning | `hod.aiml@mkce.ac.in` | `hod.mkce.aiml` | `Hod#b22dAA8K` |
| ECE: Electronics and Communication Engineering | `hod.ec@mkce.ac.in` | `hod.mkce.ece` | `Hod#pF12v7so` |
| EEE: Electrical and Electronics Engineering | `hod.ee@mkce.ac.in` | `hod.mkce.eee` | `Hod#JcJ81UaA` |
| MECH: Mechanical Engineering | `hod.me@mkce.ac.in` | `hod.mkce.mech` | `Hod#thUbb5JC` |
| CIVIL: Civil Engineering | `hod.ce@mkce.ac.in` | `hod.mkce.civil` | `Hod#D5IsrKZQ` |
| CSE (CS): Computer Science and Engineering (Cyber Security) | `hod.cy@mkce.ac.in` | `hod.mkce.csecs` | `Hod#VLvn7kTf` |
| ECE (VLSI): Electronics and Communication (VLSI Design) | `hod.vlsi@mkce.ac.in` | `hod.mkce.ecevlsi` | `Hod#JJaHYB3Y` |

## Not changed

IT and S&H HOD accounts in all three colleges were not part of this update; they keep their existing logins (`hod.<college>.it`, `hod.<college>.sh`).
Auditor logins are unchanged (see README.md, or the Auditor Allocation tab as Admin).
