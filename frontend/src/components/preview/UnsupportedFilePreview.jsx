import { 
  Download, Presentation, FileSpreadsheet, FileText, 
  Archive, File, Loader
} from 'lucide-react';

export default function UnsupportedFilePreview({
  fileName = '',
  ext = '',
  badge = { label: 'FILE', bg: 'rgba(255, 255, 255, 0.1)', text: '#ffffff' },
  downloading = false,
  onDownload
}) {
  const isPpt = ext === 'pptx' || ext === 'ppt' || ext === 'odp';
  const isSheet = ext === 'xlsx' || ext === 'xls' || ext === 'csv' || ext === 'ods';
  const isDoc = ext === 'docx' || ext === 'doc' || ext === 'odt' || ext === 'rtf';
  const isArchive = ext === 'zip' || ext === 'rar' || ext === '7z' || ext === 'tar' || ext === 'gz';

  const renderIcon = () => {
    if (isPpt) return <Presentation size={38} />;
    if (isSheet) return <FileSpreadsheet size={38} />;
    if (isDoc) return <FileText size={38} />;
    if (isArchive) return <Archive size={38} />;
    return <File size={38} />;
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      padding: '2rem',
      boxSizing: 'border-box'
    }}>
      <div style={{
        textAlign: 'center',
        maxWidth: '480px',
        width: '100%',
        padding: '3rem 2.25rem',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '18px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
        boxSizing: 'border-box'
      }}>
        {/* Large Rounded Format Icon */}
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '18px',
          backgroundColor: badge.bg,
          color: badge.text,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem'
        }}>
          {renderIcon()}
        </div>

        {/* Title */}
        <h3 style={{
          color: '#ffffff',
          fontSize: '1.25rem',
          fontWeight: 700,
          margin: '0 0 0.5rem 0',
          wordBreak: 'break-word',
          lineHeight: '1.35'
        }}>
          {fileName}
        </h3>

        {/* Format Explanation */}
        <p style={{
          color: '#a1a1aa',
          fontSize: '0.88rem',
          margin: '0 0 1.75rem 0',
          lineHeight: '1.55'
        }}>
          Preview is not available for this file type ({badge.label}). You can download the file to open it with your device application.
        </p>

        {/* Prominent Action Button */}
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          style={{
            backgroundColor: 'var(--accent-color, #0a84ff)',
            color: '#ffffff',
            border: 'none',
            padding: '0.75rem 2rem',
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.55rem',
            fontWeight: 600,
            fontSize: '0.92rem',
            cursor: downloading ? 'wait' : 'pointer',
            transition: 'opacity 0.15s ease',
            boxShadow: '0 8px 24px rgba(10, 132, 255, 0.35)'
          }}
        >
          {downloading ? <Loader size={18} className="spin-animation" /> : <Download size={18} />}
          <span>{downloading ? 'Downloading...' : 'Download File'}</span>
        </button>
      </div>
    </div>
  );
}
