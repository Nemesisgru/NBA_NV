"""Draft audit reports (Word, Excel, PDF) rendered from one validated analytics snapshot.

* Reports are owned by the requesting user and stored outside every served folder; they are only
  downloadable through the authorised download view.
* The background job re-checks the owner's access when it runs.
* Every format is marked "DRAFT - requires auditor review" and carries empty approval fields.
* Spreadsheet text cells that could be read as formulas are escaped.
"""
import logging
import os
import uuid
from datetime import timedelta
from xml.sax.saxutils import escape

from django.conf import settings
from django.utils import timezone

from ..models import AIReport
from ..permissions import user_role
from . import analytics, narration, ollama
from ..models import AuditCycle
from ..question_scope import hidden_output_keys, redact
from .scope import ScopeError, resolve_scope

log = logging.getLogger('audit_core.ai')

FORMATS = {
    'docx': ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'),
    'xlsx': ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx'),
    'pdf': ('application/pdf', 'pdf'),
}
DRAFT_LABEL = 'DRAFT - requires auditor review. Not an approved audit report.'


def report_dir():
    path = settings.AUDIT_AI['REPORT_DIR']
    os.makedirs(path, exist_ok=True)
    return path


def report_path(file_name):
    """Absolute path of a stored report file; refuses names that would leave the report folder"""
    base = os.path.realpath(report_dir())
    full = os.path.realpath(os.path.join(base, os.path.basename(file_name)))
    if not full.startswith(base + os.sep):
        raise ValueError('Invalid report file')
    return full


# ---------------------------------------------------------------- job
class _JobRequest:
    """Minimal request-like object so the job can re-run the normal scope checks for the owner"""
    def __init__(self, user):
        self.user = user
        self.role = user_role(user)


def start_report(report):
    from . import jobs
    jobs.kick()


def run_report(report_id):
    """Runs a report job already claimed by jobs.claim() (status 'running')"""
    report = AIReport.objects.select_related('owner', 'department', 'cycle', 'compare_cycle').get(id=report_id)
    try:
        req = _JobRequest(report.owner)
        if not req.role or not report.owner.is_active:
            raise ScopeError('The report owner no longer has access')
        scope = resolve_scope(req, department_id=report.department_id, cycle_id=report.cycle_id)
        snapshot = analytics.build_report_snapshot(scope, report.compare_cycle, report.filters.get('criterion'))
        # Columns the Admin hid for the audit are withheld from HOD / Auditor reports as well
        compared = (snapshot.get('comparison') or {}).get('compare_cycle') or {}
        other = report.compare_cycle or (AuditCycle.objects.filter(id=compared.get('id')).first() if compared.get('id') else None)
        keys = hidden_output_keys([scope.cycle, other], scope.role)
        if keys:
            snapshot = redact(snapshot, keys)
            snapshot.setdefault('notes', []).append('Some figures are not shown because the Admin hid those columns for this audit.')
        story = None
        if report.include_narration:
            try:
                story = narration.narrate(snapshot['summary'], 'Write an executive summary of this audit.', scope.cache_key())
            except ollama.AIUnavailable as e:
                story = {'unavailable': str(e)}
        stamp = timezone.now().strftime('%Y%m%d-%H%M%S')
        base_name = f"{uuid.uuid4().hex}_{report.department.institute.code}_{report.department.code}_{stamp}".replace(' ', '').replace('&', 'and')
        base_name = ''.join(ch for ch in base_name if ch.isalnum() or ch in '_-()')
        files = {}
        for fmt, writer in (('docx', write_docx), ('xlsx', write_xlsx), ('pdf', write_pdf)):
            name = f'{base_name}.{FORMATS[fmt][1]}'
            writer(report_path(name), snapshot, story, report)
            files[fmt] = name
        report.files = files
        report.rubric_snapshot = snapshot['rubric']
        report.data_as_of = snapshot['data_as_of']
        report.status = 'done'
        log.info('ai report done id=%s', report.id)
    except ScopeError as e:
        report.status, report.error = 'failed', str(e)[:300]
        log.warning('ai report denied id=%s', report.id)
    except Exception:  # noqa: BLE001 - recorded on the report without leaking details
        report.status, report.error = 'failed', 'The report could not be generated.'
        log.exception('ai report failed id=%s', report.id)
    report.finished_at = timezone.now()
    report.save(update_fields=['status', 'error', 'files', 'rubric_snapshot', 'data_as_of', 'finished_at'])
    cleanup_old_reports()


def cleanup_old_reports():
    """Delete reports (rows and files) older than the retention period"""
    cutoff = timezone.now() - timedelta(days=settings.AUDIT_AI['REPORT_RETENTION_DAYS'])
    removed = 0
    for r in AIReport.objects.filter(created_at__lt=cutoff):
        delete_report_files(r)
        r.delete()
        removed += 1
    return removed


def delete_report_files(report):
    for name in (report.files or {}).values():
        try:
            os.remove(report_path(name))
        except (OSError, ValueError):
            pass


# ---------------------------------------------------------------- shared content
def _fmt(v):
    if v is None or v == '':
        return '-'
    if isinstance(v, bool):
        return 'Yes' if v else 'No'
    if isinstance(v, dict) and 'numerator' in v:
        pct = f" ({v['percent']}%)" if v['percent'] is not None else ''
        return f"{v['numerator']} / {v['denominator']}{pct}"
    if isinstance(v, float):
        return f'{v:g}'
    return str(v)


def build_blocks(snapshot, story, report):
    """Report content as neutral blocks shared by the Word and PDF writers"""
    s, scope = snapshot['summary'], snapshot['scope']
    t = s['totals']
    blocks = [
        ('title', 'Academic Audit Report'),
        ('draft', DRAFT_LABEL),
        ('h1', '1. Report scope'),
        ('table', ['Item', 'Value'], [
            ['College', scope['college']], ['Department(s)', ', '.join(scope['departments'])],
            ['Audit cycle', scope['cycle']], ['Criterion filter', report.filters.get('criterion') or 'All criteria'],
            ['Compared with', (snapshot['comparison'].get('compare_cycle') or {}).get('name', 'No compatible earlier cycle')],
        ]),
        ('h1', '2. Generation details'),
        ('table', ['Item', 'Value'], [
            ['Generated at', snapshot['generated_at']], ['Source data last changed', snapshot['data_as_of'] or 'No data recorded'],
            ['Generated by', report.owner.get_username()],
            ['AI narration', 'Included (unverified, see section 3)' if story and not story.get('unavailable')
             else ('Requested but unavailable: ' + story['unavailable']) if story else 'Not requested'],
        ]),
        ('h1', '3. Executive summary'),
        ('p', f"Verified result: the audit scored {_fmt(t['marks_obtained'])} of {_fmt(t['max_marks'])} marks "
              f"({_fmt(t['percentage'])}%), grade {_fmt(t['grade'])}, status: {t['compliance']}. "
              f"Submissions completed: {_fmt(t['submission_completed'])}. Findings: {t['findings']}. "
              f"Corrective actions open / in progress / closed: {t['atr_open']} / {t['atr_in_progress']} / {t['atr_closed']}; "
              f"findings approved (auditor sign-off): {t['findings_approved']}. "
              f"Overdue corrective actions: {snapshot['corrective_actions']['totals']['overdue']}."),
    ]
    if story and not story.get('unavailable'):
        blocks.append(('h2', 'AI-drafted narrative (unverified - check every statement against the tables)'))
        if story.get('summary'):
            blocks.append(('p', story['summary']))
        for o in story.get('observations', []):
            blocks.append(('bullet', o['text'] + (f" [{', '.join(o['refs'])}]" if o['refs'] else '')))
        for w in story.get('warnings', []):
            blocks.append(('note', w))

    me = snapshot['missing_evidence']
    blocks += [
        ('h1', '4. Data coverage and missing information'),
        ('table', ['Measure', 'Value'], [
            ['Questions in this audit', t['questions_in_audit']],
            ['Submissions completed', _fmt(t['submission_completed'])],
            ['Not assessed (no evaluation yet)', t['not_assessed']],
            ['Evidence recorded Complete', _fmt(t['evidence_complete'])],
            ['Evidence recorded Partial', t['evidence_partial']],
            ['Evidence recorded Not Uploaded', t['evidence_not_uploaded']],
            ['Evidence verified (physical check matches claim)', _fmt(t['evidence_verified'])],
            ['Questions with an evidence file uploaded', _fmt(t['evidence_uploaded'])],
            ['Evidence files needing manual verification', t['evidence_files_manual_check']],
        ]),
        ('h2', 'Questions with missing, partial or unassessed evidence'),
        ('table', ['Criterion', 'Question', 'Key aspect', 'Evidence', 'Physical check', 'Grade'],
         [[r['criterion'], r['question'], r['key_aspect'], r['evidence_status'], _fmt(r['physical_check']), _fmt(r['grade'])]
          for r in me['rows'][:150]] or [['-', '-', 'None', '-', '-', '-']]),
    ]
    if me.get('truncated') or len(me['rows']) > 150:
        blocks.append(('note', 'Only the first 150 rows are listed; see the Excel workbook for the full list.'))

    blocks += [
        ('h1', '5. Criterion-wise observations'),
        ('table', ['Criterion', 'Scored', 'Marks', '%', 'Grade', 'Status', 'Evidence verified', 'Findings', 'ATR open/prog./closed'],
         [[f"{c['criterion']} {c['title']}", _fmt(c['submission_completed']), f"{_fmt(c['marks_obtained'])} / {_fmt(c['max_marks'])}",
           _fmt(c['percentage']), _fmt(c['grade']), c['compliance'], _fmt(c['evidence_verified']), c['findings'],
           f"{c['atr_open']}/{c['atr_in_progress']}/{c['atr_closed']}"] for c in s['criteria']]),
        ('h2', 'Findings (graded W or D, or flagged for ATR)'),
        ('table', ['Criterion', 'Question', 'Key aspect', 'Grade', '%', 'Auditor remarks', 'ATR', 'Approved'],
         [[r['criterion'], r['question'], r['key_aspect'], _fmt(r['grade']), _fmt(r['percentage']), r['auditor_remarks'],
           f"{r['atr_id'] or '-'} {r['atr_status']}", _fmt(r['finding_approved'])] for r in snapshot['findings']['rows'][:150]]
         or [['-', '-', 'No findings', '-', '-', '-', '-', '-']]),
        ('h1', '6. Evidence references'),
        ('h2', 'Uploaded evidence files'),
        ('p', 'Files uploaded for the questions of this audit. Uploading a file does not verify it or make a question compliant.'),
        ('table', ['Evidence', 'Criterion', 'Question', 'File', 'Text extraction', 'Pages'],
         [[r['evidence_id'], r['criterion'], r['question'], r['file'], r['extraction'], _fmt(r['pages'])]
          for r in snapshot['evidence_files']['rows'][:150]] or [['-', '-', '-', 'No files uploaded', '-', '-']]),
        ('h2', 'References recorded on Action Taken Reports'),
        ('p', 'Listed as text; links were not opened or verified by this system.'),
        ('table', ['ATR', 'Criterion', 'Question', 'Evidence reference', 'Status', 'Signed off'],
         [[r['atr_id'], r['criterion'], r['question'], r['evidence_ref'], r['status'], _fmt(r['auditor_signoff'])]
          for r in snapshot['evidence_refs']['rows'][:150]] or [['-', '-', '-', 'No evidence references recorded', '-', '-']]),
        ('h1', '7. Scores and calculation methodology'),
        ('bullet', snapshot['rubric']['marks_rule']),
        ('bullet', 'Grades: ' + snapshot['rubric']['grade_rule']),
        ('bullet', 'Criterion status uses the existing grade meanings (Y Compliant, C Concern, W Weakness, D Deficiency) '
                   'and is only given when every question of the criterion is scored.'),
        ('bullet', 'Questions fixed for this cycle by the Admin: ' + ('yes' if snapshot['rubric']['questions_fixed_for_cycle'] else 'no (all questions)')),
        ('bullet', 'Rubric version of this cycle: ' + snapshot['rubric']['version'] +
                   f" (current: v{snapshot['rubric']['current_version']})" +
                   ('; thresholds changed since this cycle was scored, grades use the current thresholds.'
                    if snapshot['rubric']['thresholds_changed_since_cycle'] else '.')),
    ]

    cmp_ = snapshot['comparison']
    blocks.append(('h1', '8. Historical comparison'))
    if cmp_.get('compare_cycle') and cmp_.get('departments'):
        d = cmp_['departments'][0]
        blocks.append(('p', f"Compared with {cmp_['compare_cycle']['name']}. "
                            + ('Question sets are identical.' if cmp_['compatible'] else 'Question sets differ; only identical criteria are compared and no overall change is given.')))
        if d['overall']:
            blocks.append(('p', f"Overall: {d['overall']['current_percent']}% now vs {d['overall']['previous_percent']}% before (change {d['overall']['change']:+g} points)."))
        blocks.append(('table', ['Criterion', 'Current %', 'Previous %', 'Change', 'Note'],
                       [[c['criterion'], _fmt(c['current_percent']), _fmt(c['previous_percent']),
                         _fmt(c['change']), c['coverage_note'] or '-'] for c in d['criteria']] or [['-', '-', '-', '-', 'No compatible criteria']]))
        for c in cmp_['criteria']:
            if not c['compatible']:
                blocks.append(('note', f"{c['criterion']} not compared: {c['reason']}."))
    for n in cmp_.get('notes', []):
        blocks.append(('note', n))

    ca = snapshot['corrective_actions']
    blocks += [
        ('h1', '9. Corrective actions'),
        ('h2', 'Existing corrective actions not yet closed (from Action Taken Reports)'),
        ('table', ['ATR', 'Criterion', 'Question', 'Status', 'Target date', 'Days overdue', 'Action plan'],
         [[r['atr_id'], r['criterion'], r['question'], r['status'], _fmt(r['target_date']), r['days_overdue'] or '-',
           r['action_plan'] or 'Not yet entered by the HOD'] for r in ca['rows'][:150]] or [['-', '-', '-', 'None pending', '-', '-', '-']]),
        ('h2', 'Suggested actions (AI-drafted suggestions, not audit findings)'),
    ]
    sugg = (story or {}).get('suggested_actions') or []
    if sugg:
        blocks += [('bullet', a['text'] + (f" [{', '.join(a['refs'])}]" if a['refs'] else '')) for a in sugg]
    else:
        blocks.append(('p', 'No suggested actions were generated.'))

    blocks += [('h1', '10. Limitations and items requiring manual verification')]
    limitations = [
        'This is a draft generated from the audit database. It does not certify compliance or approve the audit.',
        analytics.DEFINITIONS['evidence_status'],
        analytics.DEFINITIONS['evidence_uploaded'],
        analytics.DEFINITIONS['mandatory_evidence'],
        analytics.DEFINITIONS['corrective_action_owner'],
        analytics.DEFINITIONS['rubric_version'],
        'Uploaded evidence files marked "manual verification required" (scanned or unreadable) must be checked by hand; '
        'they are not treated as missing or non-compliant.',
    ]
    if story and not story.get('unavailable'):
        limitations.append('AI-drafted text may be inaccurate; the verified tables are authoritative.')
    limitations += s.get('notes', [])
    blocks += [('bullet', x) for x in limitations]

    blocks += [
        ('h1', '11. Auditor review and approval'),
        ('p', 'Review status: DRAFT - NOT APPROVED'),
        ('table', ['Role', 'Name', 'Signature', 'Date'],
         [['Lead Auditor', '', '', ''], ['Second Auditor', '', '', ''], ['Head of Department', '', '', ''], ['IQAC Coordinator', '', '', '']]),
    ]
    return blocks


# ---------------------------------------------------------------- Word
def write_docx(path, snapshot, story, report):
    from docx import Document
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.shared import Pt, RGBColor

    doc = Document()
    section = doc.sections[0]
    section.header.paragraphs[0].text = DRAFT_LABEL
    for kind, *data in build_blocks(snapshot, story, report):
        if kind == 'title':
            doc.add_heading(data[0], 0)
        elif kind == 'draft':
            p = doc.add_paragraph()
            run = p.add_run(data[0])
            run.bold = True
            run.font.color.rgb = RGBColor(0xC0, 0x1E, 0x1E)
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif kind == 'h1':
            doc.add_heading(data[0], 1)
        elif kind == 'h2':
            doc.add_heading(data[0], 2)
        elif kind == 'p':
            doc.add_paragraph(data[0])
        elif kind == 'bullet':
            doc.add_paragraph(data[0], style='List Bullet')
        elif kind == 'note':
            p = doc.add_paragraph()
            r = p.add_run('Note: ' + data[0])
            r.italic = True
            r.font.size = Pt(9)
        elif kind == 'table':
            columns, rows = data
            table = doc.add_table(rows=1, cols=len(columns))
            table.style = 'Table Grid'
            for i, c in enumerate(columns):
                table.rows[0].cells[i].text = str(c)
                for run in table.rows[0].cells[i].paragraphs[0].runs:
                    run.bold = True
            for row in rows:
                cells = table.add_row().cells
                for i, v in enumerate(row):
                    cells[i].text = _fmt(v)
            for row in table.rows:
                for cell in row.cells:
                    for par in cell.paragraphs:
                        for run in par.runs:
                            run.font.size = Pt(8)
    doc.save(path)


# ---------------------------------------------------------------- Excel
FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')


def safe_cell(value):
    """Plain value for a spreadsheet cell; text that a spreadsheet could run as a formula is escaped"""
    if isinstance(value, dict) and 'numerator' in value:
        value = _fmt(value)
    if isinstance(value, (list, tuple)):
        value = ', '.join(map(str, value))
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES):
        return "'" + value
    return value


def write_xlsx(path, snapshot, story, report):
    from openpyxl import Workbook
    from openpyxl.styles import Font

    wb = Workbook()

    def sheet(title, columns, rows, first=False):
        ws = wb.active if first else wb.create_sheet()
        ws.title = title[:31]
        ws.append([safe_cell(DRAFT_LABEL)])
        ws['A1'].font = Font(bold=True, color='C01E1E')
        ws.append([])
        ws.append([safe_cell(c) for c in columns])
        for cell in ws[3]:
            cell.font = Font(bold=True)
        for r in rows:
            ws.append([safe_cell(v) for v in r])
        for col in ws.columns:
            ws.column_dimensions[col[0].column_letter].width = min(60, max(10, max(len(str(c.value or '')) for c in col[2:6]) + 2))
        return ws

    scope, t = snapshot['scope'], snapshot['summary']['totals']
    sheet('Scope', ['Item', 'Value'], [
        ['College', scope['college']], ['Department(s)', ', '.join(scope['departments'])], ['Audit cycle', scope['cycle']],
        ['Generated at', snapshot['generated_at']], ['Source data last changed', snapshot['data_as_of'] or 'No data'],
        ['Generated by', report.owner.get_username()], ['Review status', 'DRAFT - NOT APPROVED'],
        ['Overall %', t['percentage']], ['Grade', t['grade']], ['Status', t['compliance']],
        ['Submissions completed', _fmt(t['submission_completed'])], ['Evidence verified', _fmt(t['evidence_verified'])],
        ['Grade rule', snapshot['rubric']['grade_rule']], ['Marks rule', snapshot['rubric']['marks_rule']],
    ], first=True)
    sheet('Criteria', ['Criterion', 'Title', 'Questions', 'Scored', 'Max marks', 'Marks', '%', 'Grade', 'Status',
                       'Evidence complete', 'Evidence verified', 'Findings', 'ATR open', 'ATR in progress', 'ATR closed', 'Approved'],
          [[c['criterion'], c['title'], c['questions_in_audit'], c['submission_completed']['numerator'], c['max_marks'],
            c['marks_obtained'], c['percentage'], c['grade'], c['compliance'], c['evidence_complete']['numerator'],
            c['evidence_verified']['numerator'], c['findings'], c['atr_open'], c['atr_in_progress'], c['atr_closed'],
            c['findings_approved']] for c in snapshot['summary']['criteria']])
    sheet('Missing evidence', ['Criterion', 'Question', 'Key aspect', 'Evidence', 'Physical check', 'Grade', 'Auditor remarks'],
          [[r['criterion'], r['question'], r['key_aspect'], r['evidence_status'], r['physical_check'], r['grade'], r['auditor_remarks']]
           for r in snapshot['missing_evidence']['rows']])
    sheet('Findings', ['Criterion', 'Question', 'Key aspect', 'Grade', '%', 'Marks', 'Evidence', 'Physical check',
                       'Auditor remarks', 'ATR', 'ATR status', 'Approved'],
          [[r['criterion'], r['question'], r['key_aspect'], r['grade'], r['percentage'], r['marks'], r['evidence_status'],
            r['physical_check'], r['auditor_remarks'], r['atr_id'], r['atr_status'], _fmt(r['finding_approved'])]
           for r in snapshot['findings']['rows']])
    sheet('Corrective actions', ['ATR', 'Criterion', 'Question', 'Status', 'Target date', 'Days overdue', 'Owner',
                                 'Action plan entered', 'Action plan', 'Auditor sign-off'],
          [[r['atr_id'], r['criterion'], r['question'], r['status'], r['target_date'], r['days_overdue'], r['owner'],
            _fmt(r['action_plan_entered']), r['action_plan'], _fmt(r['auditor_signoff'])] for r in snapshot['corrective_actions']['rows']])
    sheet('Evidence files', ['Evidence', 'Criterion', 'Question', 'File', 'Text extraction', 'Pages', 'Uploaded at'],
          [[r['evidence_id'], r['criterion'], r['question'], r['file'], r['extraction'], r['pages'], r['uploaded_at']]
           for r in snapshot['evidence_files']['rows']])
    sheet('Evidence references', ['ATR', 'Criterion', 'Question', 'Evidence reference (not verified)', 'Status', 'Signed off'],
          [[r['atr_id'], r['criterion'], r['question'], r['evidence_ref'], r['status'], _fmt(r['auditor_signoff'])]
           for r in snapshot['evidence_refs']['rows']])
    cmp_ = snapshot['comparison']
    rows = []
    for d in cmp_.get('departments', []):
        for c in d['criteria']:
            rows.append([d['department'], c['criterion'], c['current_percent'], c['previous_percent'], c['change'], c['coverage_note']])
    sheet('Comparison', ['Department', 'Criterion', 'Current %', 'Previous %', 'Change', 'Note'],
          rows + [['', n] for n in cmp_.get('notes', [])])
    sheet('Review', ['Role', 'Name', 'Signature', 'Date'],
          [['Lead Auditor', '', '', ''], ['Second Auditor', '', '', ''], ['Head of Department', '', '', ''], ['IQAC Coordinator', '', '', '']])
    wb.save(path)


# ---------------------------------------------------------------- PDF
def write_pdf(path, snapshot, story, report):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    styles = getSampleStyleSheet()
    small = styles['BodyText'].clone('small', fontSize=7, leading=8.5)
    head = styles['BodyText'].clone('head', fontSize=7, leading=8.5, fontName='Helvetica-Bold')
    draft = styles['BodyText'].clone('draft', textColor=colors.HexColor('#C01E1E'), fontName='Helvetica-Bold')
    note = styles['BodyText'].clone('note', fontSize=8, fontName='Helvetica-Oblique')

    def para(text, style):
        return Paragraph(escape(str(text)), style)  # plain text only: never interpreted as markup

    story_items = []
    for kind, *data in build_blocks(snapshot, story, report):
        if kind == 'title':
            story_items.append(para(data[0], styles['Title']))
        elif kind == 'draft':
            story_items.append(para(data[0], draft))
        elif kind == 'h1':
            story_items += [Spacer(1, 6), para(data[0], styles['Heading2'])]
        elif kind == 'h2':
            story_items.append(para(data[0], styles['Heading3']))
        elif kind == 'p':
            story_items.append(para(data[0], styles['BodyText']))
        elif kind == 'bullet':
            story_items.append(para('• ' + data[0], styles['BodyText']))
        elif kind == 'note':
            story_items.append(para('Note: ' + data[0], note))
        elif kind == 'table':
            columns, rows = data
            table = Table([[para(c, head) for c in columns]] + [[para(_fmt(v), small) for v in r] for r in rows],
                          repeatRows=1, hAlign='LEFT')
            table.setStyle(TableStyle([
                ('GRID', (0, 0), (-1, -1), 0.3, colors.grey),
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EDF4EE')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            story_items.append(table)

    def on_page(canvas, doc_):
        canvas.saveState()
        canvas.setFont('Helvetica-Bold', 8)
        canvas.setFillColor(colors.HexColor('#C01E1E'))
        canvas.drawString(12 * mm, 8 * mm, DRAFT_LABEL)
        canvas.drawRightString(doc_.pagesize[0] - 12 * mm, 8 * mm, f'Page {doc_.page}')
        canvas.restoreState()

    doc = SimpleDocTemplate(path, pagesize=landscape(A4), leftMargin=12 * mm, rightMargin=12 * mm,
                            topMargin=12 * mm, bottomMargin=14 * mm, title='Draft academic audit report')
    doc.build(story_items, onFirstPage=on_page, onLaterPages=on_page)
