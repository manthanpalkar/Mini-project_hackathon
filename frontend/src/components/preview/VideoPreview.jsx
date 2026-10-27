
export default function VideoPreview({
  src,
  poster = null
}) {
  if (!src) return null;

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
        maxWidth: '1080px',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
        backgroundColor: '#000000',
        border: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <video
          src={src}
          poster={poster}
          controls
          autoPlay={false}
          playsInline
          style={{
            width: '100%',
            height: 'auto',
            maxHeight: 'calc(100dvh - 160px)',
            display: 'block'
          }}
        >
          Your browser does not support the video tag.
        </video>
      </div>
    </div>
  );
}
