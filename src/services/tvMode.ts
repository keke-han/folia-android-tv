// src/services/tvMode.ts
// Dedicated TV APK and a local browser flag share the same navigation and layout.
export const isTvMode = (): boolean => import.meta.env.VITE_FOLIA_TV === 'true'
    || (import.meta.env.DEV && typeof window !== 'undefined' && window.location && new URLSearchParams(window.location.search).get('tv') === '1')
    || (typeof document !== 'undefined' && document.documentElement.dataset.foliaTv === 'true');
