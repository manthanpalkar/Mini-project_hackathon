import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Strip non-essential console.log and debugger statements from application code in production
function dropConsolePlugin(mode) {
  if (mode !== 'production') return null;
  return {
    name: 'drop-console',
    transform(code, id) {
      if (id.includes('node_modules')) return null;
      if (!/\.(jsx?|tsx?)$/.test(id)) return null;
      if (code.includes('console.log') || code.includes('debugger')) {
        return {
          code: code
            .replace(/\bconsole\.log\s*\([^)]*\)\s*;?/g, '')
            .replace(/\bdebugger\s*;?/g, ''),
          map: null
        };
      }
      return null;
    }
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    dropConsolePlugin(mode)
  ].filter(Boolean),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Keep pdfjs-dist isolated in its own dynamic import chunks (not in manualChunks)
            // to prevent Rollup from grouping __vitePreload into vendor-pdf and leaking into index.html
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[VITE_PROXY_ERROR]', err);
          });
        }
      },
      '/uploads': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
      }
    }
  },
  preview: {
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:5001',
        changeOrigin: true,
      },
      '/uploads': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:5001',
        changeOrigin: true,
      }
    }
  }
}))
