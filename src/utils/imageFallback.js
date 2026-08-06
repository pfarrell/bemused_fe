// src/utils/imageFallback.js
// Shared onError handler for <img> elements pointed at a '/sm/' (small) thumbnail
// variant that may not exist on disk — falls back to the full-size path.
export function handleSmallImageError(e) {
  if (e.target.src.includes('/sm/')) {
    e.target.src = e.target.src.replace('/sm/', '/');
    e.target.onerror = null;
  }
}
