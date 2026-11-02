// Columns of the criteria evaluation table. The Admin chooses per audit cycle which ones are
// shown (Audit Questions tab, or the Columns button on the evaluation page).
// `legacy` is the column group key used by settings saved before columns were individual.
// Keep in sync with DEFAULT_COLUMNS / LEGACY_GROUPS in backend/audit_core/question_scope.py.
export const AUDIT_COLUMNS = [
  { key: 'code', label: 'Code', group: 'Question', locked: true },
  { key: 'keyAspect', label: 'Key Aspect & Indicator', group: 'Question', locked: true },
  { key: 'unitSample', label: 'Unit / Sample', group: 'Sampling', legacy: 'sampling' },
  { key: 'verificationRule', label: 'Verification Rule', group: 'Sampling', legacy: 'sampling' },
  { key: 'rubricY', label: 'Y Rubric (>75%)', group: 'Rubrics', legacy: 'rubrics', off: true },
  { key: 'rubricC', label: 'C Rubric (60-75%)', group: 'Rubrics', legacy: 'rubrics', off: true },
  { key: 'rubricW', label: 'W Rubric (40-60%)', group: 'Rubrics', legacy: 'rubrics', off: true },
  { key: 'rubricD', label: 'D Rubric (<40%)', group: 'Rubrics', legacy: 'rubrics', off: true },
  { key: 'maxMarks', label: 'Max Marks', group: 'Auditor input' },
  { key: 'itemsChecked', label: 'Items Checked', group: 'Auditor input', legacy: 'inputs' },
  { key: 'validItems', label: 'Valid Items', group: 'Auditor input', legacy: 'inputs' },
  { key: 'benchmark', label: 'Benchmark', group: 'Auditor input', legacy: 'inputs' },
  { key: 'validatedValue', label: 'Validated Value', group: 'Auditor input', legacy: 'inputs' },
  { key: 'marksObtained', label: 'Marks Obt.', group: 'Results', legacy: 'results' },
  { key: 'percentage', label: '%', group: 'Results', legacy: 'results' },
  { key: 'grade', label: 'Grade', group: 'Results', legacy: 'results' },
  { key: 'remarks', label: 'Auditor Remarks', group: 'Remarks & evidence', legacy: 'remarks' },
  { key: 'evidenceStatus', label: 'Evidence Status', group: 'Remarks & evidence', legacy: 'evidence' },
  { key: 'physicalCheck', label: 'Physical Check', group: 'Remarks & evidence', legacy: 'evidence' },
  { key: 'atrFlag', label: 'Flag ATR', group: 'ATR', legacy: 'atrCheckbox' },
];

export const TOGGLEABLE_COLUMNS = AUDIT_COLUMNS.filter(c => !c.locked);

export const DEFAULT_COLUMNS = Object.fromEntries(TOGGLEABLE_COLUMNS.map(c => [c.key, !c.off]));

// Fill in defaults and translate settings saved with the old column group keys
export function normalizeColumns(saved) {
  const s = saved || {};
  return Object.fromEntries(TOGGLEABLE_COLUMNS.map(c => {
    if (c.key in s) return [c.key, Boolean(s[c.key])];
    if (c.legacy && c.legacy in s) return [c.key, Boolean(s[c.legacy])];
    return [c.key, !c.off];
  }));
}

export const sameColumns = (a, b) => TOGGLEABLE_COLUMNS.every(c => Boolean(a?.[c.key]) === Boolean(b?.[c.key]));

export const countShown = (cols) => TOGGLEABLE_COLUMNS.filter(c => cols?.[c.key]).length;
