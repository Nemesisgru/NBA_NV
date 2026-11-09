import React, { useState } from 'react';
import {
  Users,
  Award,
  GraduationCap,
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Download,
  Upload,
} from 'lucide-react';
import FacultyModal from './FacultyModal';

export default function ProgramTab({
  program = {},
  onSaveFaculty,
  onDeleteFaculty,
  onSaveProgramProfile,
  onDownloadFacultyTemplate,
  onUploadFacultyRoster,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  const [modalOpen, setModalOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState(null);
  const [modalVersion, setModalVersion] = useState(0);
  const [uploadingRoster, setUploadingRoster] = useState(false);
  const [rosterUploadError, setRosterUploadError] = useState('');

  const [progName, setProgName] = useState(program.program_name || '');
  const [twoBatches] = useState(program.two_batches_passed || 'Yes');
  const [breakProg] = useState(program.break_in_program || 'No');
  const cayStartYear = Number((program.cay || '').slice(0, 4)) || 2023;
  const intakeYears = [0, 1, 2].map((offset) => {
    const year = cayStartYear - offset;
    return `${year}-${year + 1}`;
  });

  const facultyMembers = program.faculty_members || [];

  // Filter faculty
  const filteredFaculty = facultyMembers.filter((f) => {
    const term = searchTerm.toLowerCase();
    return (
      (f.faculty_name || '').toLowerCase().includes(term) ||
      (f.highest_degree || '').toLowerCase().includes(term) ||
      (f.present_designation || '').toLowerCase().includes(term) ||
      (f.pan_no || '').toLowerCase().includes(term)
    );
  });

  const totalPages = Math.ceil(filteredFaculty.length / pageSize) || 1;
  const currentFaculty = filteredFaculty.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const facultyColumns = [
    { key: 'faculty_name', label: 'Name of the Faculty' },
    { key: 'pan_no', label: 'PAN No.' },
    { key: 'apaar_id', label: 'APAAR Faculty ID (if any)' },
    { key: 'highest_degree', label: 'Highest Degree' },
    { key: 'university', label: 'University' },
    { key: 'area_of_specialization', label: 'Area of Specialization' },
    { key: 'date_of_joining', label: 'Date of Joining in this Institution (MM/DD/YYYY)' },
    { key: 'designation_at_joining', label: 'Designation at Time of Joining in this Institution' },
    { key: 'present_designation', label: 'Present Designation' },
    { key: 'date_designated_prof', label: 'Date Designated as Professor / Associate Professor (if any)' },
    { key: 'nature_of_association', label: 'Nature of Association (Regular / Contract / Adhoc)' },
    { key: 'contractual_details', label: 'If Contractual, Full Time or Part Time' },
    { key: 'currently_associated', label: 'Currently Associated (Y/N)' },
    { key: 'date_of_leaving', label: 'Date of Leaving (if Currently Associated is No)' },
    { key: 'experience_years', label: 'Experience in Years in Current Institute' },
    { key: 'date_receiving_highest_degree', label: 'Date of Receiving Highest Degree (MM/DD/YYYY)' },
  ];

  const handleOpenAdd = () => {
    setEditingFaculty(null);
    setModalVersion((version) => version + 1);
    setModalOpen(true);
  };

  const handleOpenEdit = (faculty) => {
    setEditingFaculty(faculty);
    setModalVersion((version) => version + 1);
    setModalOpen(true);
  };

  const handleSaveModal = async (data) => {
    if (onSaveFaculty) {
      await onSaveFaculty(data);
    }
    setModalOpen(false);
    setRosterUploadError('');
  };

  const handleDelete = async (facultyId) => {
    if (window.confirm('Are you sure you want to remove this faculty member?')) {
      if (onDeleteFaculty) {
        await onDeleteFaculty(facultyId);
      }
    }
  };

  const handleSaveHeader = async () => {
    if (onSaveProgramProfile) {
      await onSaveProgramProfile({
        program_key: program.program_key,
        program_name: progName,
        two_batches_passed: twoBatches,
        break_in_program: breakProg,
      });
    }
  };

  const handleRosterUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !onUploadFacultyRoster) return;
    setRosterUploadError('');
    setUploadingRoster(true);
    try {
      await onUploadFacultyRoster(program.program_key, file);
    } catch (error) {
      setRosterUploadError(error.message || 'Faculty upload failed.');
    } finally {
      setUploadingRoster(false);
      event.target.value = '';
    }
  };

  const handleTemplateDownload = async () => {
    if (!onDownloadFacultyTemplate) return;
    setRosterUploadError('');
    try {
      await onDownloadFacultyTemplate(program.program_key);
    } catch (error) {
      setRosterUploadError(error.message || 'Could not download the faculty template.');
    }
  };

  const displayFacultyValue = (column, value) => {
    if (!value) return '—';
    if (column.key.startsWith('date_') && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-');
      return `${month}/${day}/${year}`;
    }
    return value;
  };

  const isCadreComplied = program.cadre_compliance_cay === 'Yes' && program.cadre_compliance_caym1 === 'Yes';
  const isHodPhd = program.is_hod_doctorate === 'Yes';

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Program Header & KPI Cards */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {program.tab_title}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <input
                type="text"
                value={progName}
                onChange={(e) => setProgName(e.target.value)}
                onBlur={handleSaveHeader}
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: '6px',
                  padding: '2px 6px',
                  width: '100%',
                  maxWidth: '500px',
                }}
                title="Click to edit program name"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Two batches passed: </span>
              <strong style={{ color: twoBatches === 'Yes' ? 'var(--grade-y)' : 'var(--grade-d)' }}>{twoBatches}</strong>
            </div>

            <div style={{ background: 'var(--bg-card)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Assessment CAY: </span>
              <strong style={{ color: 'var(--text-primary)' }}>{program.cay || '2023-2024'}</strong>
            </div>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL FACULTY</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{facultyMembers.length}</div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isCadreComplied ? 'var(--grade-y-bg)' : 'var(--grade-d-bg)', color: isCadreComplied ? 'var(--grade-y)' : 'var(--grade-d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Award size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CADRE RATIO</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: isCadreComplied ? 'var(--grade-y)' : 'var(--grade-d)' }}>
                {isCadreComplied ? 'Complied' : 'Not Complied'}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: isHodPhd ? 'var(--grade-y-bg)' : 'rgba(239, 68, 68, 0.15)', color: isHodPhd ? 'var(--grade-y)' : 'var(--grade-d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>HOD DOCTORATE</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: isHodPhd ? 'var(--grade-y)' : 'var(--grade-d)' }}>
                {program.is_hod_doctorate || 'No'}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CAY FACULTY PH.D</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {program.phd_table?.[0]?.phd_percentage || '0%'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Faculty Roster Table Section */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Faculty Members Roster ({filteredFaculty.length} of {facultyMembers.length})
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Faculty qualifications, PAN, joining date, experience, and yearly association history.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search faculty..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-input)',
                  color: 'var(--text-primary)',
                  padding: '6px 12px 6px 32px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  width: '200px',
                }}
              />
            </div>

            <button
              type="button"
              onClick={handleTemplateDownload}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={15} /> Excel Template
            </button>

            <label
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: uploadingRoster ? 'wait' : 'pointer' }}
            >
              <Upload size={15} /> {uploadingRoster ? 'Uploading...' : 'Upload Excel'}
              <input
                type="file"
                accept=".xlsx"
                disabled={uploadingRoster}
                onChange={handleRosterUpload}
                style={{ display: 'none' }}
              />
            </label>

            <button
              onClick={handleOpenAdd}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} /> Add Faculty
            </button>
          </div>
        </div>
        {rosterUploadError && (
          <div role="alert" style={{ color: 'var(--grade-d)', fontSize: '0.82rem', marginBottom: '12px' }}>
            {rosterUploadError}
          </div>
        )}

        {/* Roster Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-header)', borderBottom: '2px solid var(--border-subtle)' }}>
                  <th style={{ padding: '10px 8px', width: '40px' }}>S.N.</th>
                  {facultyColumns.map((column) => (
                    <th key={column.key} style={{ padding: '10px 8px', minWidth: '130px', verticalAlign: 'top' }}>
                      {column.label}
                    </th>
                  ))}
                  <th style={{ padding: '10px 8px', minWidth: '70px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentFaculty.map((f, idx) => {
                return (
                  <tr key={f.id || idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>{f.sno || idx + 1}</td>
                    {facultyColumns.map((column) => (
                      <td key={column.key} style={{ padding: '8px', color: 'var(--text-secondary)', minWidth: '130px' }}>
                        {displayFacultyValue(column, f[column.key])}
                      </td>
                    ))}
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(f)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '2px' }}
                          title="Edit faculty"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(f.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--grade-d)', cursor: 'pointer', padding: '2px' }}
                          title="Delete faculty"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {currentFaculty.length === 0 && (
                <tr>
                  <td colSpan={facultyColumns.length + 2} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No faculty records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredFaculty.length)} of {filteredFaculty.length} entries
            </span>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', padding: '0 8px' }}>
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cadre Table and PhD Qualification Summary (Side by side) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px' }}>
        {/* Cadre Table */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Award size={16} color="var(--primary)" /> Cadre Summary Table
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '8px' }}>YEAR</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Professors</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Assoc Prof</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Asst Prof</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {(program.cadre_table || []).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {row.label} ({row.year})
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: row.professors > 0 ? 'var(--grade-y)' : 'var(--text-muted)' }}>
                      {row.professors}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: row.associate_professors > 0 ? 'var(--grade-y)' : 'var(--text-muted)' }}>
                      {row.associate_professors}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{row.assistant_professors}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 800 }}>{row.total_faculty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Qualification PhD Table */}
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <GraduationCap size={16} color="var(--primary)" /> Qualification Summary (% Ph.D)
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ padding: '8px' }}>YEAR</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Ph. D</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Non Ph. D</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Total</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>% of Ph. D</th>
                </tr>
              </thead>
              <tbody>
                {(program.phd_table || []).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {row.label} ({row.year})
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700, color: row.phd > 0 ? 'var(--grade-y)' : 'var(--text-muted)' }}>
                      {row.phd}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{row.non_phd}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 700 }}>{row.total_faculty}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontWeight: 800, color: 'var(--primary)' }}>
                      {row.phd_percentage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Student Intake Table (Table 5.1.A) */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
          Table No. 5.1.A: Student Intake Breakdown (UG & PG)
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '8px 12px' }}>Description</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '140px' }}>CAY ({intakeYears[0]})</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '140px' }}>CAYm1 ({intakeYears[1]})</th>
                <th style={{ padding: '8px 12px', textAlign: 'center', width: '140px' }}>CAYm2 ({intakeYears[2]})</th>
              </tr>
            </thead>
            <tbody>
              {(program.student_intake_table || []).map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: row.description?.includes('DS') ? 700 : 500 }}>
                    {row.description}
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.cay}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.cay_m1}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'center' }}>{row.cay_m2}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <FacultyModal
        key={`${program.program_key}-${modalVersion}`}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveModal}
        faculty={editingFaculty}
        programKey={program.program_key}
      />
    </div>
  );
}
