
export default function ImagePreview({
  src,
  alt = 'Image Preview',
  scale = 1.0
}) {
  if (!src) return null;

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
      height: '100%',
      overflow: 'auto',
      padding: '1.5rem',
      boxSizing: 'border-box'
    }}>
      <img
        src={src}
        alt={alt}
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          transition: 'transform 0.15s ease',
          maxWidth: scale <= 1.0 ? '100%' : 'none',
          maxHeight: scale <= 1.0 ? 'calc(100dvh - 120px)' : 'none',
          objectFit: 'contain',
          borderRadius: '8px',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.75)',
          display: 'block'
        }}
      />
    </div>
  );
}
