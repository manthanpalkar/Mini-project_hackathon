import { useState, useEffect, useCallback, useRef } from 'react';

// In-memory cache with timestamp tracking for fast access
const memoryCache = {};
const memoryTimestamps = {};

// In-flight promise map for request deduplication across multiple components
const inFlightPromises = new Map();

const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Helper to load cache from sessionStorage with TTL check
const getSessionCache = (key, ttlMs = DEFAULT_CACHE_TTL_MS) => {
  try {
    const raw = sessionStorage.getItem(`loop_cache_${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== 'object' || !('data' in entry)) {
      return entry; // Legacy format fallback
    }
    const age = Date.now() - (entry.timestamp || 0);
    if (age > ttlMs) {
      sessionStorage.removeItem(`loop_cache_${key}`);
      return null;
    }
    return entry.data;
  } catch (e) {
    return null;
  }
};

// Helper to write cache to sessionStorage with timestamp
const setSessionCache = (key, val) => {
  try {
    const entry = {
      timestamp: Date.now(),
      data: val
    };
    sessionStorage.setItem(`loop_cache_${key}`, JSON.stringify(entry));
  } catch (e) {
    // Ignore storage limit exceptions
  }
};

// Maximum in-memory cache entries for low-spec device optimization (~1GB RAM)
const MAX_CACHE_ENTRIES = 50;
const pruneCacheIfNeeded = () => {
  const keys = Object.keys(memoryCache);
  if (keys.length > MAX_CACHE_ENTRIES) {
    const sorted = keys.sort((a, b) => (memoryTimestamps[a] || 0) - (memoryTimestamps[b] || 0));
    for (let i = 0; i < 15; i++) {
      if (sorted[i]) {
        delete memoryCache[sorted[i]];
        delete memoryTimestamps[sorted[i]];
      }
    }
  }
};

/**
 * Hook for intelligent client-side caching with request deduplication and TTL revalidation
 */
export const useCachedData = (key, fetcher, dependencies = [], ttlMs = DEFAULT_CACHE_TTL_MS) => {
  // Stabilize fetcher reference to prevent infinite re-fetching loops from inline functions
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Initialize state with in-memory or sessionStorage cached value
  const [data, setData] = useState(() => {
    const memAge = Date.now() - (memoryTimestamps[key] || 0);
    if (memoryCache[key] && memAge <= ttlMs) {
      return memoryCache[key];
    }
    const sessionVal = getSessionCache(key, ttlMs);
    if (sessionVal !== null) {
      memoryCache[key] = sessionVal;
      memoryTimestamps[key] = Date.now();
      return sessionVal;
    }
    return null;
  });

  const [loading, setLoading] = useState(() => {
    // If we already have fresh cached data, do not show initial loading skeleton
    const memAge = Date.now() - (memoryTimestamps[key] || 0);
    const hasFreshMem = memoryCache[key] && memAge <= ttlMs;
    const hasFreshSession = !hasFreshMem && getSessionCache(key, ttlMs) !== null;
    return !hasFreshMem && !hasFreshSession;
  });

  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setError(null);
    }

    // Request deduplication: reuse in-flight promise if another component requested same key
    if (inFlightPromises.has(key)) {
      try {
        const sharedResult = await inFlightPromises.get(key);
        if (isMountedRef.current) {
          setData(sharedResult);
          setLoading(false);
        }
        return sharedResult;
      } catch (err) {
        if (isMountedRef.current && !isBackground) {
          setError(err);
          setLoading(false);
        }
        throw err;
      }
    }

    const requestPromise = (async () => {
      try {
        const res = await fetcherRef.current();
        pruneCacheIfNeeded();
        memoryCache[key] = res;
        memoryTimestamps[key] = Date.now();
        setSessionCache(key, res);

        if (isMountedRef.current) {
          setData(res);
          setLoading(false);
        }
        return res;
      } catch (err) {
        if (isMountedRef.current && !isBackground) {
          setError(err);
          setLoading(false);
        }
        throw err;
      } finally {
        inFlightPromises.delete(key);
      }
    })();

    inFlightPromises.set(key, requestPromise);
    return requestPromise;
  }, [key]);

  // Revalidate (background fetch) on mount or dependency changes
  useEffect(() => {
    const memAge = Date.now() - (memoryTimestamps[key] || 0);
    const hasFreshData = memoryCache[key] && memAge <= ttlMs;

    // If cache is stale or missing, show loading
    if (!hasFreshData) {
      setLoading(true);
    }

    // Background revalidation
    fetchData(hasFreshData).catch(() => {});
  }, [key, fetchData, ttlMs, ...dependencies]);

  // Mutate function allows optimistic UI updates
  const mutate = useCallback((newData, revalidate = true) => {
    pruneCacheIfNeeded();
    memoryCache[key] = newData;
    memoryTimestamps[key] = Date.now();
    setSessionCache(key, newData);
    setData(newData);
    
    if (revalidate) {
      // Re-fetch in background to synchronize with server
      fetchData(true).catch(() => {});
    }
  }, [key, fetchData]);

  return { data, loading, error, mutate, refresh: () => fetchData(false) };
};

/**
 * Global helper to prefetch data into memory and sessionStorage on link/card hover.
 * When the user navigates, the page renders instantly with zero loading delay.
 */
export const prefetchData = async (key, fetcher, ttlMs = DEFAULT_CACHE_TTL_MS) => {
  if (typeof window === 'undefined' || typeof fetcher !== 'function') return null;
  const memAge = Date.now() - (memoryTimestamps[key] || 0);
  if (memoryCache[key] && memAge <= ttlMs) {
    return memoryCache[key];
  }
  const sessionVal = getSessionCache(key, ttlMs);
  if (sessionVal !== null) {
    memoryCache[key] = sessionVal;
    memoryTimestamps[key] = Date.now();
    return sessionVal;
  }
  if (inFlightPromises.has(key)) {
    return inFlightPromises.get(key);
  }
  const promise = (async () => {
    try {
      const res = await fetcher();
      pruneCacheIfNeeded();
      memoryCache[key] = res;
      memoryTimestamps[key] = Date.now();
      setSessionCache(key, res);
      return res;
    } catch {
      return null;
    } finally {
      inFlightPromises.delete(key);
    }
  })();
  inFlightPromises.set(key, promise);
  return promise;
};

// Global helper to clear all caches (e.g. on logout or account switch)
export const clearAllCaches = () => {
  Object.keys(memoryCache).forEach(k => {
    delete memoryCache[k];
    delete memoryTimestamps[k];
  });
  inFlightPromises.clear();
  try {
    Object.keys(sessionStorage).forEach(k => {
      if (k.startsWith('loop_cache_')) {
        sessionStorage.removeItem(k);
      }
    });
  } catch (e) {
    // Ignore storage issues
  }
};

// Automatically listen to auth expiration and logout events to prevent cross-account cache leakage
if (typeof window !== 'undefined') {
  window.addEventListener('loop_auth_expired', () => {
    clearAllCaches();
  });
  window.addEventListener('loop_logout', () => {
    clearAllCaches();
  });
}

