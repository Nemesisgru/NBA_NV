import React, { useState } from 'react';
import { Calculator, Save, CheckCircle2, AlertTriangle, Check, FileCheck } from 'lucide-react';

const currentCalendarYear = new Date().getFullYear();

export default function PrimaryCheckTab({
  primaryCheck = {},
  config = {},
  departmentId,
  onSavePrimaryCheck,
  onUpdateConfig,
}) {
  const years = primaryCheck.years || ['2023-2024', '2022-2023', '2021-2022'];
  const assessmentYears = Array.from({ length: 5 }, (_, offset) => {
    const startYear = currentCalendarYear - offset;
    return `${startYear}-${startYear + 1}`;
  });
  const defaultAssessmentYear = assessmentYears.includes(config.current_assessment_year)
    ? config.current_assessment_year
    : assessmentYears[0];
  const defaultApprovalYears = departmentId
    ? (primaryCheck.approval_years_text || '')
    : (config.approval_years_text || '2023-2024, 2022-2023, 2021-2022, 2020-2021, 2019-2020, 2018-2019');

  // Primary questions state
  const [approval, setApproval] = useState(
    departmentId
      ? (primaryCheck.approval_five_years || 'No')
      : (config.approval_five_years || 'No')
  );
  const [approvalYears, setApprovalYears] = useState(
    defaultApprovalYears
  );
  const [twoBatches, setTwoBatches] = useState(
    departmentId
      ? (primaryCheck.two_batches_passed_out || 'Yes')
      : (config.two_batches_passed_out || 'Yes')
  );
  const [hasAllied, setHasAllied] = useState(
    departmentId
      ? (primaryCheck.have_allied_department || 'No')
      : (config.have_allied_department || 'No')
  );
  const [assessmentYear, setAssessmentYear] = useState(
    departmentId
      ? (primaryCheck.current_assessment_year || defaultAssessmentYear)
      : defaultAssessmentYear
  );

  // SFR metrics
  const [ug1B, setUg1B] = useState(primaryCheck.ug1_b || {});
  const [ug1C, setUg1C] = useState(primaryCheck.ug1_c || {});
  const [ug1D, setUg1D] = useState(primaryCheck.ug1_d || {});
  const [ug1Total, setUg1Total] = useState(primaryCheck.ug1_total || {});
  const [pgTotal, setPgTotal] = useState(primaryCheck.pg_total || {});
  const [dsStudents, setDsStudents] = useState(primaryCheck.ds_students || {});
  const [asStudents, setAsStudents] = useState(primaryCheck.as_students || {});
  const [sTotal] = useState(primaryCheck.s_total || {});
  const [dfFaculty, setDfFaculty] = useState(primaryCheck.df_faculty || {});
  const [afFaculty, setAfFaculty] = useState(primaryCheck.af_faculty || {});
  const [fTotal] = useState(primaryCheck.f_total || {});
  const [ffFirstYear, setFfFirstYear] = useState(primaryCheck.ff_first_year || {});

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Compute live SFR for each year
  const computedSfr = {};
  const validSfrs = [];
  years.forEach((yr) => {
    const ds = parseFloat(dsStudents[yr] || 0);
    const as = parseFloat(asStudents[yr] || 0);
    const s = sTotal[yr] !== undefined && sTotal[yr] !== '' ? parseFloat(sTotal[yr] || 0) : ds + as;

    const df = parseFloat(dfFaculty[yr] || 0);
    const af = parseFloat(afFaculty[yr] || 0);
    const f = fTotal[yr] !== undefined && fTotal[yr] !== '' ? parseFloat(fTotal[yr] || 0) : df + af;

    const ff = parseFloat(ffFirstYear[yr] || 0);
    const denom = f - ff;
    if (denom > 0) {
      const val = parseFloat((s / denom).toFixed(2));
      computedSfr[yr] = val;
      validSfrs.push(val);
    } else {
      computedSfr[yr] = '#DIV/0!';
    }
  });

  const avgSfr = validSfrs.length > 0 ? (validSfrs.reduce((a, b) => a + b, 0) / validSfrs.length).toFixed(2) : '#DIV/0!';
  const sfrComplied = avgSfr !== '#DIV/0!' && parseFloat(avgSfr) <= 25.0;

  const handleMetricChange = (setter, yr, val) => {
    setter((prev) => ({ ...prev, [yr]: val }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      if (!departmentId && onUpdateConfig) {
        await onUpdateConfig({
          approval_five_years: approval,
          approval_years_text: approvalYears,
          two_batches_passed_out: twoBatches,
          have_allied_department: hasAllied,
          current_assessment_year: assessmentYear,
        });
      }

      if (onSavePrimaryCheck) {
        await onSavePrimaryCheck({
          department_id: departmentId,
          approval_five_years: approval,
          approval_years_text: approvalYears,
          two_batches_passed_out: twoBatches,
          have_allied_department: hasAllied,
          current_assessment_year: assessmentYear,
          years,
          ug1_b: ug1B,
          ug1_c: ug1C,
          ug1_d: ug1D,
          ug1_total: ug1Total,
          pg_total: pgTotal,
          ds_students: dsStudents,
          as_students: asStudents,
          s_total: sTotal,
          df_faculty: dfFaculty,
          af_faculty: afFaculty,
          f_total: fTotal,
          ff_first_year: ffFirstYear,
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('Error saving Primary Check metrics');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    color: 'var(--text-primary)',
    padding: '7px 10px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    width: '100%',
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Primary Pre-Visit Check Questions */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={20} color="var(--primary)" />
              3.A. Primary Pre-Visit Parameters
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Essential baseline parameters required by the NBA pre-visit qualifier guidelines.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {saveSuccess ? <Check size={15} /> : <Save size={15} />}
            {saving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Parameters'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Approval Question */}
          <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
              1. Approval of Competent Authority (AICTE / UGC / BoG) for past 5 years?
            </label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
              {['Yes', 'No'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setApproval(opt)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: approval === opt ? 'var(--primary)' : 'var(--border-subtle)',
                    background: approval === opt ? 'var(--primary-light)' : 'transparent',
                    color: approval === opt ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: approval === opt ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={approvalYears}
              onChange={(e) => setApprovalYears(e.target.value)}
              placeholder="List of approved academic years"
              style={inputStyle}
            />
          </div>

          {/* Two Batches Passed Out */}
          <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
              2. Have two batches passed out of the Programme?
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['Yes', 'No'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTwoBatches(opt)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: twoBatches === opt ? 'var(--primary)' : 'var(--border-subtle)',
                    background: twoBatches === opt ? 'var(--primary-light)' : 'transparent',
                    color: twoBatches === opt ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: twoBatches === opt ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Allied Department */}
          <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
              3. Does the Programme have allied Departments?
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['Yes', 'No'].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setHasAllied(opt)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: hasAllied === opt ? 'var(--primary)' : 'var(--border-subtle)',
                    background: hasAllied === opt ? 'var(--primary-light)' : 'transparent',
                    color: hasAllied === opt ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: hasAllied === opt ? 700 : 500,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Assessment Year */}
          <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
              4. Current Assessment Year (CAY)
            </label>
            <select
              value={assessmentYear}
              onChange={(e) => setAssessmentYear(e.target.value)}
              style={inputStyle}
            >
              {assessmentYears.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Table: Student Faculty Ratio (SFR) Breakdown */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={18} color="var(--primary)" />
              3.B. Student Faculty Ratio (SFR) Calculation Matrix
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Formula: SFR = S / (F - FF), averaged across CAY, CAYm1, and CAYm2. Target: ≤ 25:1.
            </p>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              fontWeight: 700,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: sfrComplied ? 'var(--grade-y-bg)' : 'var(--grade-d-bg)',
              color: sfrComplied ? 'var(--grade-y)' : 'var(--grade-d)',
              border: `1px solid ${sfrComplied ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
            }}
          >
            {sfrComplied ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            3-Yr Average SFR: {avgSfr} {sfrComplied ? '(Complied)' : '(Not Complied)'}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-header)', borderBottom: '2px solid var(--border-subtle)' }}>
                <th style={{ padding: '12px 14px', minWidth: '320px' }}>Description</th>
                {years.map((yr) => (
                  <th key={yr} style={{ padding: '12px 14px', width: '180px', textAlign: 'center' }}>
                    {yr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* UG1, B */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>UG1, B (Sanctioned Intake)</td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={ug1B[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setUg1B, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>
                ))}
              </tr>

              {/* UG1, C */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>UG1, C (Lateral Entry)</td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={ug1C[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setUg1C, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>
                ))}
              </tr>

              {/* UG1, D */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>UG1, D (Separate Division)</td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={ug1D[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setUg1D, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>
                ))}
              </tr>

              {/* Total UG1 */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(255, 255, 255, 0.02)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>UG1 Total</td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={ug1Total[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setUg1Total, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center', fontWeight: 700 }}
                    />
                  </td>
                ))}
              </tr>

              {/* PG */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>PG (1.. n) Total</td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={pgTotal[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setPgTotal, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>
                ))}
              </tr>

              {/* DS */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(59, 130, 246, 0.03)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  DS = Total no. of students in all UG & PG programs in the Department
                </td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={dsStudents[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setDsStudents, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center', fontWeight: 700 }}
                    />
                  </td>
                ))}
              </tr>

              {/* AS */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                  AS = Total no. of students of all UG & PG programs in allied departments
                </td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={asStudents[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setAsStudents, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>
                ))}
              </tr>

              {/* S = DS + AS */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(245, 73, 39, 0.05)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary)' }}>
                  S = Total students in Department (DS) + Allied Departments (AS)
                </td>
                {years.map((yr) => {
                  const ds = parseFloat(dsStudents[yr] || 0);
                  const as = parseFloat(asStudents[yr] || 0);
                  const calcTotal = ds + as;
                  return (
                    <td key={yr} style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                      {calcTotal}
                    </td>
                  );
                })}
              </tr>

              {/* DF */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                  DF = Total no. of faculty members in the Department
                </td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={dfFaculty[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setDfFaculty, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>
                ))}
              </tr>

              {/* AF */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                  AF = Total no. of faculty members in allied Departments
                </td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={afFaculty[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setAfFaculty, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>
                ))}
              </tr>

              {/* F = DF + AF */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'rgba(245, 73, 39, 0.05)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--primary)' }}>
                  F = Total faculty in Department (DF) + Allied Departments (AF)
                </td>
                {years.map((yr) => {
                  const df = parseFloat(dfFaculty[yr] || 0);
                  const af = parseFloat(afFaculty[yr] || 0);
                  const calcTotal = df + af;
                  return (
                    <td key={yr} style={{ padding: '8px 14px', textAlign: 'center', fontWeight: 800, fontSize: '0.9rem' }}>
                      {calcTotal}
                    </td>
                  );
                })}
              </tr>

              {/* FF */}
              <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                  FF = Faculty members with 100% teaching load in 1st year courses
                </td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '8px 14px' }}>
                    <input
                      type="number"
                      value={ffFirstYear[yr] ?? 0}
                      onChange={(e) => handleMetricChange(setFfFirstYear, yr, e.target.value)}
                      style={{ ...inputStyle, textAlign: 'center' }}
                    />
                  </td>
                ))}
              </tr>

              {/* Yearly SFR */}
              <tr style={{ borderBottom: '2px solid var(--border-subtle)', background: 'var(--bg-card)' }}>
                <td style={{ padding: '12px 14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Student Faculty Ratio (SFR) = S / (F - FF)
                </td>
                {years.map((yr) => (
                  <td key={yr} style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, fontSize: '0.95rem' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-input)',
                        color: computedSfr[yr] !== '#DIV/0!' && computedSfr[yr] <= 25 ? 'var(--grade-y)' : 'var(--grade-d)',
                      }}
                    >
                      {computedSfr[yr] !== '#DIV/0!' ? `${computedSfr[yr]}:1` : '#DIV/0!'}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
