import { useEffect } from 'react';
import { isPlainLeftClick } from './tabBridgeProtocol';

// Overtone and pshare/bemused share the patf.com origin, so a same-origin
// BroadcastChannel can find a tab regardless of how it was opened (typed
// URL, bookmark, clicked through) -- unlike named `<a target>` links, which
// can only reach tabs connected via a window.open()/opener chain.
const CHANNEL_NAME = 'patf-app-bridge';
const FIND_TIMEOUT_MS = 150;

const openNewTab = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

// Mounted once by the app announcing itself as `role`. Answers "is anyone
// there?" pings for that role, and navigates this tab when asked to.
export function useTabBridge(role) {
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const message = event.data;
      if (message.role !== role) return;
      if (message.type === 'find') {
        channel.postMessage({ type: 'found', role, requestId: message.requestId });
      } else if (message.type === 'navigate') {
        window.focus();
        window.location.href = message.url;
      }
    };
    return () => channel.close();
  }, [role]);
}

// Looks for an existing tab announcing itself as `role`; if one answers in
// time, asks it to navigate. Otherwise falls back to opening a new tab.
export function navigateOtherAppTab(role, url) {
  if (typeof BroadcastChannel === 'undefined') {
    openNewTab(url);
    return;
  }

  const channel = new BroadcastChannel(CHANNEL_NAME);
  const requestId = Math.random().toString(36).slice(2);
  let found = false;

  const timer = setTimeout(() => {
    channel.close();
    if (!found) openNewTab(url);
  }, FIND_TIMEOUT_MS);

  channel.onmessage = (event) => {
    const message = event.data;
    if (message.type === 'found' && message.role === role && message.requestId === requestId) {
      found = true;
      clearTimeout(timer);
      channel.postMessage({ type: 'navigate', role, url });
      channel.close();
    }
  };

  channel.postMessage({ type: 'find', role, requestId });
}

export function handleBridgeLinkClick(event, role, url) {
  if (event.defaultPrevented || !isPlainLeftClick(event)) return;
  event.preventDefault();
  navigateOtherAppTab(role, url);
}
