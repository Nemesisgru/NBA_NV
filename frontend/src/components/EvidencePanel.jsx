import React, { useEffect, useRef, useState } from 'react';
import { X, Upload, Download, Trash2, Loader2, FileText, AlertTriangle } from 'lucide-react';

const STATUS = {
  pending: { label: 'Reading text...', color: 'var(--text-muted)' },
  running: { label: 'Reading text...', color: 'var(--text-muted)' },
  done: { label: 'Text extracted', color: 'var(--grade-y)' },
  manual: { label: 'Manual verification required', color: 'var(--grade-w)' },
  failed: { label: 'Could not be read', color: 'var(--grade-d)' },
};

// Evidence files of one question for the selected department and audit cycle.
// Uploading a file never changes the auditor's evidence status, verification or scores.
export default function EvidencePanel({ question, departmentId, cycleId, onClose, onChanged }) {
  const [files, setFiles] = useState([]);
  const [canUpload, setCanUpload] = useState(false);
  const [limits, setLimits] = useState({ max_mb: 10, types: ['pdf', 'docx'] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const load = async () => {
    const res = await fetch(`/api/evidence/?department_id=${departmentId}&cycle_id=${cycleId}&metric_id=${question.id}`);
    const json = await res.json();
    if (!res.ok) { setError(json.error || 'Could not load the evidence'); return; }
    setFiles(json.files);
    setCanUpload(json.can_upload);
    setLimits({ max_mb: json.max_mb, types: json.types });
  };
  useEffect(() => { load(); }, [question.id, departmentId, cycleId]);

  // Refresh while text is being extracted
  useEffect(() => {
    if (!files.some(f => f.extraction === 'pending' || f.extraction === 'running')) return;
    const id = setTimeout(load, 2000);
    return () => clearTimeout(id);
  }, [files]);

  const upload = async (file) => {
    if (!file) return;
    setError('');
    if (file.size > limits.max_mb * 1024 * 1024) { setError(`The file is larger than ${limits.max_mb} MB.`); return; }
    setBusy(true);
    const form = new FormData();
    form.append('department_id', departmentId);
    form.append('cycle_id', cycleId);
    form.append('metric_id', question.id);
    form.append('file', file);
    try {
      const res = await fetch('/api/evidence/upload/', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      await load();
      onChanged?.();
    } catch (e) { setError(e.message); } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (f) => {
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    const res = await fetch(`/api/evidence/${f.id}/`, { method: 'DELETE' });
    if (!res.ok) { setError((await res.json()).error || 'Could not delete'); return; }
    await load();
    onChanged?.();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Evidence for ${question.code}`}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem' }}>Evidence · {question.code}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{question.key_aspect}</div>
            {question.evidence_mandatory && <span className="badge" style={{ marginTop: '4px', background: 'var(--primary-light)', color: 'var(--primary)' }}>Mandatory evidence</span>}
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose} aria-label="Close"><X size={14} /></button>
        </div>

        {files.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No files uploaded for this question.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {files.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <FileText size={16} color="var(--accent)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.ref} · {f.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {(f.size / 1024).toFixed(0)} KB · {f.uploaded_by} · {new Date(f.uploaded_at).toLocaleString()}
                  {f.page_count ? ` · ${f.page_count} pages` : ''}
                </div>
                <div style={{ fontSize: '0.7rem', color: STATUS[f.extraction]?.color }}>
                  {(f.extraction === 'pending' || f.extraction === 'running') && <Loader2 size={11} className="animate-spin" style={{ verticalAlign: '-2px' }} />}
                  {' '}{STATUS[f.extraction]?.label}{f.extraction_note ? `: ${f.extraction_note}` : ''}
                </div>
              </div>
              <a className="btn btn-outline btn-sm" href={`/api/evidence/${f.id}/download/`} title="Download"><Download size={13} /></a>
              {f.can_delete && <button className="btn btn-outline btn-sm" onClick={() => remove(f)} title="Delete"><Trash2 size={13} /></button>}
            </div>
          ))}
        </div>

        {canUpload ? (
          <div style={{ marginTop: '14px' }}>
            <input ref={inputRef} type="file" accept={limits.types.map(t => `.${t}`).join(',')} style={{ display: 'none' }}
              onChange={e => upload(e.target.files?.[0])} />
            <button className="btn btn-primary btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Upload {limits.types.map(t => t.toUpperCase()).join(' / ')} (max {limits.max_mb} MB)
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '12px' }}>Evidence is uploaded by the Head of Department or the Admin.</div>
        )}
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '10px' }}>
          Uploading a file does not verify it or change the auditor's evidence status or score. Scanned PDFs are marked for manual verification.
        </div>
        {error && <div role="alert" style={{ fontSize: '0.78rem', color: 'var(--grade-d)', marginTop: '8px' }}><AlertTriangle size={13} style={{ verticalAlign: '-2px' }} /> {error}</div>}
      </div>
    </div>
  );
}
