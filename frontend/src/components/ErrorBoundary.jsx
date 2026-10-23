import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[LOOP ErrorBoundary caught exception]:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/home';
  };

  render() {
    if (this.state.hasError) {
      const isDev = Boolean(import.meta.env?.DEV);
      const isChunkLoadError = 
        this.state.error?.name === 'ChunkLoadError' ||
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Failed to fetch');

      return (
        <div style={{
          minHeight: '70vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: 'var(--bg-primary, #090a0c)',
          color: 'var(--text-primary, #f5f5f5)'
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            padding: '2.5rem',
            borderRadius: '20px',
            backgroundColor: 'var(--bg-surface, #121316)',
            border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.5)',
            textAlign: 'center'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem auto'
            }}>
              <AlertCircle size={28} />
            </div>

            <h2 style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              margin: '0 0 0.75rem 0',
              fontFamily: 'var(--font-display, sans-serif)'
            }}>
              {isChunkLoadError ? 'New Update Available' : 'Something went wrong'}
            </h2>

            <p style={{
              fontSize: '0.92rem',
              color: 'var(--text-secondary, #a1a1a6)',
              lineHeight: 1.5,
              margin: '0 0 2rem 0'
            }}>
              {isChunkLoadError
                ? 'A newer version of the LOOP platform was deployed. Please reload the page to load the updated content.'
                : 'An unexpected rendering error occurred. You can reload this view or return to the main dashboard.'}
            </p>

            {isDev && this.state.error && (
              <pre style={{
                textAlign: 'left',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                color: '#ef4444',
                overflowX: 'auto',
                marginBottom: '1.5rem',
                maxHeight: '120px'
              }}>
                {this.state.error.toString()}
              </pre>
            )}

            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}>
              <button
                type="button"
                onClick={this.handleReload}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.4rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} />
                <span>Reload Page</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="btn btn-secondary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.4rem',
                  borderRadius: '12px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: 'pointer'
                }}
              >
                <Home size={16} />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
