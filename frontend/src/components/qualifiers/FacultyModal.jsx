import React, { useState } from 'react';
import { X, Save, UserCheck, GraduationCap, Briefcase } from 'lucide-react';

const toDateInputValue = (value = '') => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (usDate) {
    return `${usDate[3]}-${usDate[1].padStart(2, '0')}-${usDate[2].padStart(2, '0')}`;
  }
  return '';
};

const calculateExperience = (form) => {
  const startValue = toDateInputValue(form.date_of_joining);
  if (!startValue) return '';
  const today = new Date();
  const localToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const endValue = form.currently_associated === 'No' && form.date_of_leaving
    ? toDateInputValue(form.date_of_leaving)
    : localToday;
  if (!endValue) return '';
  const years = (new Date(`${endValue}T00:00:00`) - new Date(`${startValue}T00:00:00`))
    / (365.2425 * 24 * 60 * 60 * 1000);
  return years >= 0 ? years.toFixed(1) : '';
};

export default function FacultyModal({ isOpen, onClose, onSave, faculty, programKey }) {
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({
    id: faculty?.id || null,
    program_key: programKey,
    sno: faculty?.sno || 1,
    faculty_name: faculty?.faculty_name || '',
    pan_no: faculty?.pan_no || '',
    apaar_id: faculty?.apaar_id || '',
    highest_degree: faculty?.highest_degree || 'Ph. D',
    university: faculty?.university || '',
    area_of_specialization: faculty?.area_of_specialization || '',
    date_of_joining: toDateInputValue(faculty?.date_of_joining),
    designation_at_joining: faculty?.designation_at_joining || 'Assistant Professor',
    present_designation: faculty?.present_designation || 'Assistant Professor',
    date_designated_prof: toDateInputValue(faculty?.date_designated_prof),
    nature_of_association: faculty?.nature_of_association || 'Regular',
    contractual_details: faculty?.contractual_details || '',
    currently_associated: faculty?.currently_associated || 'Yes',
    date_of_leaving: toDateInputValue(faculty?.date_of_leaving),
    experience_years: faculty?.experience_years || '',
    date_receiving_highest_degree: toDateInputValue(faculty?.date_receiving_highest_degree),
    yearly_association: faculty?.yearly_association || {
      '2023-2024': 'Yes',
      '2022-2023': 'Yes',
      '2021-2022': 'Yes',
      '2020-2021': 'Yes',
    },
    yearly_designation: faculty?.yearly_designation || {
      '2023-2024': faculty?.present_designation || 'Assistant Professor',
      '2022-2023': faculty?.present_designation || 'Assistant Professor',
      '2021-2022': faculty?.present_designation || 'Assistant Professor',
      '2020-2021': faculty?.present_designation || 'Assistant Professor',
    },
    yearly_qualification: faculty?.yearly_qualification || {
      '2023-2024': faculty?.highest_degree?.includes('Ph') ? 'Ph. D' : 'No',
      '2022-2023': faculty?.highest_degree?.includes('Ph') ? 'Ph. D' : 'No',
      '2021-2022': faculty?.highest_degree?.includes('Ph') ? 'Ph. D' : 'No',
      '2020-2021': faculty?.highest_degree?.includes('Ph') ? 'Ph. D' : 'No',
    },
  });

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }));
  };

  const handleYearChange = (mapName, yr, val) => {
    setForm((prev) => ({
      ...prev,
      [mapName]: {
        ...prev[mapName],
        [yr]: val,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError('');
    try {
      await onSave({ ...form, experience_years: calculateExperience(form) });
    } catch (error) {
      setSaveError(error.message || 'Could not save faculty details.');
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

  const labelStyle = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    display: 'block',
    marginBottom: '4px',
  };

  const years = ['2023-2024', '2022-2023', '2021-2022', '2020-2021'];
  const experienceYears = calculateExperience(form);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          background: 'var(--bg-modal)',
          border: '1px solid var(--border-modal)',
          borderRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserCheck size={20} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {faculty?.id ? 'Edit Faculty Details' : 'Add New Faculty Member'}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Basic Details */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Briefcase size={16} /> Basic Information
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Faculty Name *</label>
                <input
                  type="text"
                  required
                  value={form.faculty_name}
                  onChange={(e) => handleChange('faculty_name', e.target.value)}
                  placeholder="e.g. Dr. K. R. Sharma"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>PAN No.</label>
                <input
                  type="text"
                  value={form.pan_no}
                  onChange={(e) => handleChange('pan_no', e.target.value)}
                  placeholder="e.g. ABCDE1234F"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>APAAR Faculty ID *</label>
                <input
                  type="text"
                  required
                  value={form.apaar_id}
                  onChange={(e) => handleChange('apaar_id', e.target.value)}
                  placeholder="Required: faculty without an APAAR ID are not evaluated"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Present Designation *</label>
                <select
                  value={form.present_designation}
                  onChange={(e) => handleChange('present_designation', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Professor & HOD">Professor & HOD</option>
                  <option value="Professor">Professor</option>
                  <option value="Associate Professor">Associate Professor</option>
                  <option value="Assistant Professor">Assistant Professor</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Designation at Joining</label>
                <input
                  type="text"
                  value={form.designation_at_joining}
                  onChange={(e) => handleChange('designation_at_joining', e.target.value)}
                  placeholder="e.g. Assistant Professor"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Date of Joining</label>
                <input
                  type="date"
                  value={form.date_of_joining}
                  onChange={(e) => handleChange('date_of_joining', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Date Designated as Professor / Associate Professor</label>
                <input
                  type="date"
                  value={form.date_designated_prof}
                  onChange={(e) => handleChange('date_designated_prof', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Nature of Association</label>
                <select
                  value={form.nature_of_association}
                  onChange={(e) => handleChange('nature_of_association', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Regular">Regular</option>
                  <option value="Contract">Contract</option>
                  <option value="Ad hoc">Ad hoc</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Currently Associated?</label>
                <select
                  value={form.currently_associated}
                  onChange={(e) => handleChange('currently_associated', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              {form.currently_associated === 'No' && (
                <div>
                  <label style={labelStyle}>Date of Leaving</label>
                  <input
                    type="date"
                    value={form.date_of_leaving}
                    onChange={(e) => handleChange('date_of_leaving', e.target.value)}
                    style={inputStyle}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Experience in Years in Current Institute (calculated)</label>
                <input
                  type="text"
                  value={experienceYears}
                  readOnly
                  style={inputStyle}
                />
              </div>

              {form.nature_of_association === 'Contract' && (
                <div>
                  <label style={labelStyle}>Contract Type</label>
                  <select
                    value={form.contractual_details}
                    onChange={(e) => handleChange('contractual_details', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="">Select type</option>
                    <option value="Full Time">Full Time</option>
                    <option value="Part Time">Part Time</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Academic & Degree Details */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GraduationCap size={16} /> Qualifications & Education
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Highest Degree</label>
                <select
                  value={form.highest_degree}
                  onChange={(e) => handleChange('highest_degree', e.target.value)}
                  style={inputStyle}
                >
                  <option value="Ph. D">Ph. D</option>
                  <option value="M.E. and Ph. D">M.E. and Ph. D</option>
                  <option value="M.Tech. and Ph. D">M.Tech. and Ph. D</option>
                  <option value="M.E.">M.E.</option>
                  <option value="M.Tech.">M.Tech.</option>
                  <option value="M.S.">M.S.</option>
                  <option value="B.E. / B.Tech.">B.E. / B.Tech.</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>University</label>
                <input
                  type="text"
                  value={form.university}
                  onChange={(e) => handleChange('university', e.target.value)}
                  placeholder="e.g. Anna University"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Area of Specialization</label>
                <input
                  type="text"
                  value={form.area_of_specialization}
                  onChange={(e) => handleChange('area_of_specialization', e.target.value)}
                  placeholder="e.g. AI / Deep Learning"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Date of Receiving Highest Degree</label>
                <input
                  type="date"
                  value={form.date_receiving_highest_degree}
                  onChange={(e) => handleChange('date_receiving_highest_degree', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Assessment Years Breakdown */}
          <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Assessment Years History (CAY to CAYm3)
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-secondary)' }}>Academic Year</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>Associated?</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--text-secondary)' }}>Designation</th>
                    <th style={{ padding: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>Ph. D Holder?</th>
                  </tr>
                </thead>
                <tbody>
                  {years.map((yr) => (
                    <tr key={yr} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>{yr}</td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <select
                          value={form.yearly_association[yr] || 'Yes'}
                          onChange={(e) => handleYearChange('yearly_association', yr, e.target.value)}
                          style={{ ...inputStyle, width: 'auto' }}
                        >
                          <option value="Yes">Yes</option>
                          <option value="No">No</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <select
                          value={form.yearly_designation[yr] || 'Assistant Professor'}
                          onChange={(e) => handleYearChange('yearly_designation', yr, e.target.value)}
                          style={inputStyle}
                        >
                          <option value="Professor">Professor</option>
                          <option value="Associate Professor">Associate Professor</option>
                          <option value="Assistant Professor">Assistant Professor</option>
                        </select>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <select
                          value={form.yearly_qualification[yr] || 'No'}
                          onChange={(e) => handleYearChange('yearly_qualification', yr, e.target.value)}
                          style={{ ...inputStyle, width: 'auto' }}
                        >
                          <option value="Ph. D">Ph. D</option>
                          <option value="No">No</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer Actions */}
          {saveError && (
            <div role="alert" style={{ color: 'var(--grade-d)', fontSize: '0.82rem' }}>
              {saveError}
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Save size={16} /> Save Faculty
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
