import { Music } from 'lucide-react';

export default function AudioPreview({
  src,
  fileName = 'Audio File',
  fileSize = ''
}) {
  if (!src) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      padding: '2rem',
      boxSizing: 'border-box'
    }}>
      <div style={{
        maxWidth: '560px',
        width: '100%',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
        backgroundColor: '#18181b',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '1.5rem'
      }}>
        <div style={{
          width: '76px',
          height: '76px',
          borderRadius: '50%',
          backgroundColor: 'rgba(168, 85, 247, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#c084fc',
          border: '1px solid rgba(168, 85, 247, 0.3)'
        }}>
          <Music size={38} />
        </div>

        <div style={{ width: '100%' }}>
          <h3 style={{
            color: '#ffffff',
            margin: '0 0 0.5rem 0',
            fontSize: '1.25rem',
            fontWeight: 600,
            wordBreak: 'break-word'
          }}>
            {fileName}
          </h3>
          {fileSize && (
            <p style={{
              color: '#a1a1aa',
              margin: 0,
              fontSize: '0.85rem'
            }}>
              {fileSize}
            </p>
          )}
        </div>

        <audio
          src={src}
          controls
          preload="metadata"
          style={{
            width: '100%',
            outline: 'none',
            borderRadius: '8px'
          }}
        >
          Your browser does not support the audio element.
        </audio>
      </div>
    </div>
  );
}
