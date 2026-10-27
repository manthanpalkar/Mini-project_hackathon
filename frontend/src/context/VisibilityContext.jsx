import { createContext } from 'react';

export const DEFAULT_VISIBILITY = Object.freeze({
  stories: true,
  resources: true,
  achievements: true
});

export const VisibilityContext = createContext({
  visibility: DEFAULT_VISIBILITY,
  loading: true,
  error: null,
  refreshVisibility: () => Promise.resolve(),
  updateVisibility: () => Promise.resolve()
});

export { useVisibility } from '../hooks/useVisibility';
