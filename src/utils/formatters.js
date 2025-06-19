/**
 * Format duration from seconds to MM:SS format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration (e.g., "1:01", "0:59")
 */
export const formatDuration = (seconds) => {
  if (!seconds || isNaN(seconds)) return '';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

