import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { UploadCloud, X, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import { MAX_FILE_SIZE, formatBytes, validateFile } from '../utils/upload';
import UploadProgress from './UploadProgress';

export default function FileUploadModal({
  isOpen,
  onClose,
  folders = [],
  currentFolderId,
  onUploadSuccess,
  startUploadContext // optionally use the background UploadDock uploader
}) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [folderId, setFolderId] = useState(currentFolderId || 'system-placement-material');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelection = (selectedFile) => {
    if (!selectedFile) return;

    try {
      validateFile(selectedFile);
      setFile(selectedFile);
      setError(null);
      if (!title) {
        setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (err) {
      setFile(null);
      setError(err.message);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    try {
      validateFile(file);
    } catch (err) {
      setError(err.message);
      return;
    }

    if (startUploadContext) {
      // Dispatches to background upload dock
      startUploadContext({
        file,
        title: title.trim() || file.name.replace(/\.[^/.]+$/, ''),
        description: description.trim(),
        category,
        folderId
      }, onUploadSuccess);
    }

    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100000,
        padding: '2.5rem 1rem',
        overflowY: 'auto',
        overscrollBehavior: 'contain'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          margin: 'auto',
          backgroundColor: 'var(--bg-primary, #1c1c1e)',
          border: '1px solid var(--border-color, #38383a)',
          borderRadius: '24px',
          width: '100%',
          maxWidth: '560px',
          maxHeight: 'calc(100vh - 4rem)',
          overflowY: 'auto',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.75rem',
          borderBottom: '1px solid var(--border-color, #38383a)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary, #fff)' }}>
              Upload Resource
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary, #8e8e93)' }}>
              Direct MongoDB GridFS Stream • Up to 200 MB
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #8e8e93)',
              cursor: 'pointer',
              padding: '0.4rem',
              borderRadius: '8px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Drag & Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${isDragging ? 'var(--accent-primary, #0071e3)' : 'var(--border-color, rgba(255, 255, 255, 0.15))'}`,
              backgroundColor: isDragging ? 'rgba(0, 113, 227, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => handleFileSelection(e.target.files[0])}
            />

            {file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle size={38} color="#34c759" />
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                  {file.name}
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #8e8e93)' }}>
                  {formatBytes(file.size)} • Click or drop another file to replace
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                <UploadCloud size={44} color="var(--accent-primary, #0071e3)" style={{ opacity: 0.9 }} />
                <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary, #fff)' }}>
                  Drag & Drop your file here
                </span>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary, #8e8e93)' }}>
                  or <span style={{ color: 'var(--accent-primary, #0071e3)', fontWeight: 600 }}>Choose File</span> from device
                </span>
                <div style={{
                  marginTop: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary, #8e8e93)',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  paddingTop: '0.5rem',
                  width: '100%'
                }}>
                  <strong>Maximum file size: 200 MB</strong>
                  <br />
                  PDF • DOCX • PPTX • XLSX • ZIP • Images • Code
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              backgroundColor: 'rgba(255, 69, 58, 0.1)',
              border: '1px solid rgba(255, 69, 58, 0.3)',
              color: '#ff453a',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* Resource Name */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: '0.4rem' }}>
              Resource Name *
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Operating Systems Complete Notes"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                borderRadius: '10px',
                padding: '0.65rem 0.85rem',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: '0.4rem' }}>
              Description (Optional)
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Summary or syllabus coverage"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                borderRadius: '10px',
                padding: '0.65rem 0.85rem',
                color: '#fff',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {/* Target Folder & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: '0.4rem' }}>
                Target Folder
              </label>
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary, #2c2c2e)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              >
                {folders.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.parentId ? `  ↳ ${f.name}` : f.name} {f.visibility === 'private' ? '🔒' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary, #fff)', marginBottom: '0.4rem' }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-secondary, #2c2c2e)',
                  border: '1px solid var(--border-color, rgba(255, 255, 255, 0.15))',
                  borderRadius: '10px',
                  padding: '0.65rem 0.85rem',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              >
                <option value="General">General</option>
                <option value="Placement">Placement</option>
                <option value="Coding">Coding</option>
                <option value="Notes">Notes</option>
                <option value="Interview">Interview</option>
                <option value="Cheatsheet">Cheatsheet</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                borderRadius: '10px',
                padding: '0.65rem 1.25rem',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file}
              style={{
                backgroundColor: file ? 'var(--accent-primary, #0071e3)' : 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '10px',
                padding: '0.65rem 1.5rem',
                color: '#fff',
                fontWeight: 600,
                cursor: file ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
            >
              <UploadCloud size={16} /> Start Upload
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
