// Google OAuth can't work over the plain-HTTP LAN origin — Google rejects
// redirect URIs pointing at private IPs — so Google entry points are hidden there.
export const isLanAccess = () => window.location.hostname === '172.16.1.10';

export const isMobileDevice = () =>
  window.innerWidth <= 768 ||
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
