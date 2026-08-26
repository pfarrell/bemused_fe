// A modified click (ctrl/cmd/shift/alt, or a non-primary button) is the
// user's way of asking the browser to open the link its own way (new tab,
// new window, etc). We only take over plain left-clicks.
export const isPlainLeftClick = ({ button, metaKey, ctrlKey, shiftKey, altKey }) =>
  button === 0 && !metaKey && !ctrlKey && !shiftKey && !altKey;
