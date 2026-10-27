import { useState, useEffect, useCallback } from 'react';
import { getSectionVisibility, updateSectionVisibility as apiUpdateSectionVisibility } from '../utils/db';
import { VisibilityContext, DEFAULT_VISIBILITY } from './VisibilityContext';

export function VisibilityProvider({ children }) {
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVisibility = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSectionVisibility();
      if (data && typeof data === 'object') {
        setVisibility({
          stories: Boolean(data.stories),
          resources: Boolean(data.resources),
          achievements: Boolean(data.achievements)
        });
      }
      setError(null);
    } catch (err) {
      console.warn('[VisibilityContext] Failed to retrieve section visibility:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisibility();

    // Listen for cross-tab or in-app updates
    const handleVisibilityChanged = (e) => {
      if (e.detail && typeof e.detail === 'object') {
        setVisibility(prev => ({
          ...prev,
          stories: Boolean(e.detail.stories),
          resources: Boolean(e.detail.resources),
          achievements: Boolean(e.detail.achievements)
        }));
      } else {
        fetchVisibility();
      }
    };

    window.addEventListener('loop_visibility_changed', handleVisibilityChanged);
    return () => {
      window.removeEventListener('loop_visibility_changed', handleVisibilityChanged);
    };
  }, [fetchVisibility]);

  const updateVisibility = async (newSettings) => {
    try {
      const response = await apiUpdateSectionVisibility(newSettings);
      const updated = response?.visibility || newSettings;
      const cleanUpdated = {
        stories: Boolean(updated.stories),
        resources: Boolean(updated.resources),
        achievements: Boolean(updated.achievements)
      };
      setVisibility(cleanUpdated);

      // Broadcast update across windows/tabs
      try {
        window.dispatchEvent(new CustomEvent('loop_visibility_changed', { detail: cleanUpdated }));
      } catch {}

      return response;
    } catch (err) {
      // Re-fetch to ensure sync with source of truth on failure
      fetchVisibility();
      throw err;
    }
  };

  return (
    <VisibilityContext.Provider value={{ visibility, loading, error, refreshVisibility: fetchVisibility, updateVisibility }}>
      {children}
    </VisibilityContext.Provider>
  );
}

export default VisibilityProvider;
