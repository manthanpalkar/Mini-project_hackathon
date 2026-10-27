import { useContext } from 'react';
import { VisibilityContext, DEFAULT_VISIBILITY } from '../context/VisibilityContext';

export function useVisibility() {
  const context = useContext(VisibilityContext);
  if (!context) {
    return {
      visibility: DEFAULT_VISIBILITY,
      loading: false,
      error: null,
      refreshVisibility: () => Promise.resolve(),
      updateVisibility: () => Promise.resolve()
    };
  }
  return context;
}

export default useVisibility;
