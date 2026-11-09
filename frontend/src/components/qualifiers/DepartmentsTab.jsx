import React, { useState, useEffect } from 'react';
import { Building2, Save, Plus, Trash2, Check, Layers } from 'lucide-react';

const createDefaultDepartments = () => [1, 2].map((sno) => ({
  sno,
  department_name: '',
  program_classification: 'UG',
  program_name: '',
  inception_year: '',
  intake_inception: '',
  current_intake: '',
  times_accredited: '',
  last_accreditation_period: '',
}));

export default function DepartmentsTab({
  departments = [],
  mappings = [],
  config = {},
  onSaveDepartments,
}) {
  // Ensure default rows is 2 on opening if empty
  const getInitialDepts = () => {
    if (departments && departments.length > 0) return departments;
    return createDefaultDepartments();
  };

  const getInitialMappings = () => {
    if (mappings && mappings.length > 0) return mappings;
    return getInitialDepts().map((department) => ({
      sno: department.sno,
      department_name: department.department_name,
      program_classification: department.program_classification || 'UG',
      master_program_name: '',
      has_allied_department: 'No',
      allied_program_count: 0,
      allied_program_1: '',
      allied_program_2: '',
      allied_program_3: '',
      allied_program_4: '',
      allied_program_5: '',
      allied_program_6: '',
    }));
  };

  const [deptList, setDeptList] = useState(getInitialDepts);
  const [mappingList, setMappingList] = useState(getInitialMappings);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setDeptList(departments?.length ? departments : createDefaultDepartments());
  }, [departments]);

  useEffect(() => {
    const mappingsBySno = new Map(mappings.map((mapping) => [mapping.sno, mapping]));
    const activeDepartments = departments?.length ? departments : createDefaultDepartments();
    const departmentRows = activeDepartments.map((department) => {
      const existing = mappingsBySno.get(department.sno);
      mappingsBySno.delete(department.sno);
      return {
        sno: department.sno,
        department_name: department.department_name || existing?.department_name || '',
        program_classification: department.program_classification || existing?.program_classification || 'UG',
        master_program_name: existing?.master_program_name || department.department_name || '',
        has_allied_department: existing?.has_allied_department || 'No',
        allied_program_count: Number(existing?.allied_program_count) || 0,
        ...Object.fromEntries(
          [1, 2, 3, 4, 5, 6].map((n) => [`allied_program_${n}`, existing?.[`allied_program_${n}`] || ''])
        ),
      };
    });
    setMappingList([...departmentRows, ...mappingsBySno.values()]);
  }, [departments, mappings]);

  const handleDeptChange = (index, field, value) => {
    const updated = [...deptList];
    updated[index] = { ...updated[index], [field]: value };
    setDeptList(updated);
    if (field === 'department_name' || field === 'program_classification') {
      const department = updated[index];
      const previousDepartmentName = deptList[index]?.department_name || '';
      setMappingList((current) => {
        const mappingIndex = current.findIndex((mapping) => mapping.sno === department.sno);
        if (mappingIndex === -1) {
          return [...current, {
            sno: department.sno,
            department_name: department.department_name || '',
            program_classification: department.program_classification || 'UG',
            master_program_name: department.department_name || '',
            has_allied_department: 'No',
            allied_program_count: 0,
            allied_program_1: '',
            allied_program_2: '',
            allied_program_3: '',
            allied_program_4: '',
            allied_program_5: '',
            allied_program_6: '',
          }];
        }
        return current.map((mapping, i) => i === mappingIndex
          ? {
            ...mapping,
            department_name: department.department_name || '',
            program_classification: department.program_classification || 'UG',
            master_program_name: !mapping.master_program_name || mapping.master_program_name === previousDepartmentName
              ? department.department_name || ''
              : mapping.master_program_name,
          }
          : mapping);
      });
    }
  };

  const handleAddDept = () => {
    const nextSno = Math.max(
      0,
      ...deptList.map((department) => Number(department.sno) || 0),
      ...mappingList.map((mapping) => Number(mapping.sno) || 0)
    ) + 1;
    setDeptList([
      ...deptList,
      {
        sno: nextSno,
        department_name: '',
        program_classification: 'UG',
        program_name: '',
        inception_year: '',
        intake_inception: '',
        current_intake: '',
        times_accredited: '',
        last_accreditation_period: '',
      },
    ]);
    setMappingList([
      ...mappingList,
      {
        sno: nextSno,
        department_name: '',
        program_classification: 'UG',
        master_program_name: '',
        has_allied_department: 'No',
        allied_program_count: 0,
        allied_program_1: '',
        allied_program_2: '',
        allied_program_3: '',
        allied_program_4: '',
        allied_program_5: '',
        allied_program_6: '',
      },
    ]);
  };

  const handleRemoveDept = (index) => {
    if (deptList.length <= 1) return;
    const removedSno = deptList[index]?.sno;
    const updated = deptList.filter((_, i) => i !== index);
    setDeptList(updated);
    setMappingList((current) => current.filter((mapping) => mapping.sno !== removedSno));
  };

  const handleMappingChange = (index, field, value) => {
    const updated = [...mappingList];
    const mapping = { ...updated[index], [field]: value };
    if (field === 'has_allied_department' && value === 'No') {
      mapping.allied_program_count = 0;
      for (let alliedIndex = 1; alliedIndex <= 6; alliedIndex += 1) {
        mapping[`allied_program_${alliedIndex}`] = '';
      }
    } else if (field === 'has_allied_department' && value === 'Yes' && !mapping.allied_program_count) {
      mapping.allied_program_count = '';
    } else if (field === 'allied_program_count') {
      const count = Number(value) || 0;
      mapping.allied_program_count = count;
      for (let alliedIndex = count + 1; alliedIndex <= 6; alliedIndex += 1) {
        mapping[`allied_program_${alliedIndex}`] = '';
      }
    }
    updated[index] = mapping;
    setMappingList(updated);
  };

  const handleSaveAll = async () => {
    if (mappingList.some((mapping) => mapping.has_allied_department === 'Yes' && !mapping.allied_program_count)) {
      alert('Select the number of allied courses for each department marked Yes.');
      return;
    }
    setSaving(true);
    setSaveSuccess(false);
    try {
      if (onSaveDepartments) {
        await onSaveDepartments({
          departments: deptList,
          program_mappings: mappingList,
        });
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert(`Error saving departments: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    background: 'var(--bg-input)',
    border: '1px solid var(--border-input)',
    color: 'var(--text-primary)',
    padding: '6px 8px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    width: '100%',
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* College identity and tier are fixed when the workspace is registered. */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-card)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: 1, minWidth: '280px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Building2 size={20} color="var(--primary)" />
          <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            College / Institution
          </label>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {config.institution_name || 'College'}
            </div>
          </div>
        </div>

        <div>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
            Accreditation Tier (locked)
          </label>
          <div style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.82rem' }}>
            {config.tier_type || 'Tier 1'}
          </div>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saving}
          className="btn btn-primary"
          style={{ padding: '9px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {saveSuccess ? <Check size={16} /> : <Save size={16} />}
          {saving ? 'Saving...' : saveSuccess ? 'Saved & Synced!' : 'Save Departments & Programs'}
        </button>
      </div>

      {/* Table 1: Departments List (2.A) */}
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
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              2.A. Departments and Programs Profile ({deptList.length} Rows)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Defaults to 2 rows on opening. Click &quot;+ Add Department&quot; to append more department rows as needed.
            </p>
          </div>
          <button
            onClick={handleAddDept}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Add Department Row
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-header)', borderBottom: '2px solid var(--border-subtle)' }}>
                <th style={{ padding: '10px 8px', width: '45px' }}>S.No</th>
                <th style={{ padding: '10px 8px', minWidth: '180px' }}>Name of Department</th>
                <th style={{ padding: '10px 8px', width: '90px' }}>Classification</th>
                <th style={{ padding: '10px 8px', minWidth: '160px' }}>Program Name</th>
                <th style={{ padding: '10px 8px', width: '90px' }}>Inception</th>
                <th style={{ padding: '10px 8px', width: '90px' }}>Inception Intake</th>
                <th style={{ padding: '10px 8px', width: '90px' }}>Current Intake</th>
                <th style={{ padding: '10px 8px', width: '90px' }}>Accredited</th>
                <th style={{ padding: '10px 8px', minWidth: '120px' }}>Last Period</th>
                <th style={{ padding: '10px 8px', width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {deptList.map((d, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '8px', color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="text"
                      value={d.department_name}
                      onChange={(e) => handleDeptChange(idx, 'department_name', e.target.value)}
                      placeholder="e.g. Mechanical Engg"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <select
                      value={d.program_classification || 'UG'}
                      onChange={(e) => handleDeptChange(idx, 'program_classification', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="UG">UG</option>
                      <option value="PG">PG</option>
                    </select>
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="text"
                      value={d.program_name}
                      onChange={(e) => handleDeptChange(idx, 'program_name', e.target.value)}
                      placeholder="Program name"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="text"
                      value={d.inception_year}
                      onChange={(e) => handleDeptChange(idx, 'inception_year', e.target.value)}
                      placeholder="e.g. 2008"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="text"
                      value={d.intake_inception}
                      onChange={(e) => handleDeptChange(idx, 'intake_inception', e.target.value)}
                      placeholder="60"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="text"
                      value={d.current_intake}
                      onChange={(e) => handleDeptChange(idx, 'current_intake', e.target.value)}
                      placeholder="120"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="text"
                      value={d.times_accredited}
                      onChange={(e) => handleDeptChange(idx, 'times_accredited', e.target.value)}
                      placeholder="2"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <input
                      type="text"
                      value={d.last_accreditation_period}
                      onChange={(e) => handleDeptChange(idx, 'last_accreditation_period', e.target.value)}
                      placeholder="2021-2024"
                      style={inputStyle}
                    />
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleRemoveDept(idx)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--grade-d)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Remove department"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table 2: Programs Applied for Accreditations (2.B) */}
      <div
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary)" />
            2.B. Programs Applied for Accreditations Mapping
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Each department gets its own allied-program fields. Program tabs are created only for names entered here.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {mappingList.map((mapping, index) => {
            const department = deptList.find((item) => item.sno === mapping.sno);
            const alliedCount = Number(mapping.allied_program_count) || 0;
            return (
              <section key={mapping.sno} style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: '10px', background: 'var(--bg-card)' }}>
                <h4 style={{ margin: '0 0 14px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  Department {mapping.sno}: {department?.department_name || mapping.department_name || 'Name department in 2.A'}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Master Program
                    </label>
                    <input
                      type="text"
                      value={mapping.master_program_name || ''}
                      onChange={(e) => handleMappingChange(index, 'master_program_name', e.target.value)}
                      placeholder="Enter master program"
                      style={{ ...inputStyle, fontWeight: 700 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      3. Does the Programme have allied Departments?
                    </label>
                    <select
                      value={mapping.has_allied_department || 'No'}
                      onChange={(e) => handleMappingChange(index, 'has_allied_department', e.target.value)}
                      style={inputStyle}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Number of allied courses
                    </label>
                    <select
                      value={mapping.has_allied_department === 'Yes' && !mapping.allied_program_count
                        ? ''
                        : (mapping.allied_program_count ?? 0)}
                      disabled={mapping.has_allied_department !== 'Yes'}
                      onChange={(e) => handleMappingChange(index, 'allied_program_count', e.target.value)}
                      style={inputStyle}
                    >
                      <option value={mapping.has_allied_department === 'Yes' ? '' : 0} disabled={mapping.has_allied_department === 'Yes'}>
                        {mapping.has_allied_department === 'Yes' ? 'Select count' : '0'}
                      </option>
                      {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </div>
                </div>
                {mapping.has_allied_department === 'Yes' && alliedCount > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '14px' }}>
                    {Array.from({ length: alliedCount }, (_, alliedIndex) => {
                      const field = `allied_program_${alliedIndex + 1}`;
                      return (
                        <div key={field}>
                          <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Allied Course {alliedIndex + 1}
                          </label>
                          <input
                            type="text"
                            value={mapping[field] || ''}
                            onChange={(e) => handleMappingChange(index, field, e.target.value)}
                            placeholder={`Enter allied course ${alliedIndex + 1}`}
                            style={inputStyle}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
