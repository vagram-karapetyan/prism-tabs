export type PopupShortcutAction =
  | 'sort'
  | 'ungroup'
  | 'undo'
  | 'escape'
  | null;

export interface ShortcutKeyEventLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  target?: unknown;
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Checks whether the event target is an editable form control or contenteditable element.
 */
export function isEditableEventTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') {
    return false;
  }

  const maybeElement = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
  };

  if (maybeElement.isContentEditable === true) {
    return true;
  }

  if (typeof maybeElement.tagName === 'string') {
    return EDITABLE_TAGS.has(maybeElement.tagName.toUpperCase());
  }

  return false;
}

/**
 * Classifies popup-level hotkeys while ignoring global actions inside inputs and IME compositions.
 */
export function classifyPopupShortcut(event: ShortcutKeyEventLike): PopupShortcutAction {
  if (event.isComposing) {
    return null;
  }

  const normalizedKey = event.key.toLowerCase();

  if (normalizedKey === 'escape') {
    return 'escape';
  }

  if (isEditableEventTarget(event.target)) {
    return null;
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && normalizedKey === 'p') {
    return 'sort';
  }

  if (event.altKey && !event.ctrlKey && !event.metaKey && normalizedKey === 'u') {
    return 'ungroup';
  }

  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && normalizedKey === 'z') {
    return 'undo';
  }

  return null;
}
