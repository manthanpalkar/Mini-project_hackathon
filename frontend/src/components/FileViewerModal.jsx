import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Backward compatibility redirector.
 * If any legacy component ever invokes FileViewerModal,
 * it immediately forwards to the dedicated /preview/:id route.
 */
export default function FileViewerModal({ file, files = [] }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (file?.id) {
      navigate(`/preview/${file.id}`, { state: { file, files } });
    }
  }, [file, files, navigate]);

  return null;
}
