/**
 * Liquid Textile — Behaviors
 *
 * The few interactions every app ends up writing, done once, without a
 * framework: theme selection, platform-aware key labels, a combobox, a
 * dialog, and toasts. Each is a plain function over plain elements, styled
 * by foundation.css, and none needs the others.
 *
 *   import { initTheme, keys, combobox, dialog, toast } from './behaviors.js';
 */

// ------------------------------------------------------------------ theme ---

/**
 * Set data-theme on <html> from a saved choice, else the OS setting, and
 * keep following the OS until the person chooses. Call it before first
 * paint (a module script in <head>) to avoid a flash of the wrong theme.
 *
 * Returns { get, set, toggle }. set(null) forgets the choice.
 */
export function initTheme({ key = 'lt-theme', root = document.documentElement } = {}) {
  const media = matchMedia('(prefers-color-scheme: dark)');
  const saved = () => { try { return localStorage.getItem(key); } catch { return null; } };
  const apply = (t) => root.setAttribute('data-theme', t);
  const current = () => saved() || (media.matches ? 'dark' : 'light');

  apply(current());
  media.addEventListener('change', () => { if (!saved()) apply(current()); });

  return {
    get: () => root.getAttribute('data-theme'),
    set(theme) {
      try { theme ? localStorage.setItem(key, theme) : localStorage.removeItem(key); } catch { /* a preference */ }
      apply(theme || current());
    },
    toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
  };
}

// ------------------------------------------------------------------- keys ---

const MAC = typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.userAgentData?.platform || navigator.platform || '');

/**
 * A shortcut as this platform writes it. "Mod" is Cmd on a Mac and Ctrl
 * elsewhere; handlers should accept either (ev.metaKey || ev.ctrlKey).
 *
 *   keys('Mod+Enter') → '⌘↵' on a Mac, 'Ctrl+Enter' elsewhere
 */
export function keys(combo) {
  const parts = combo.split('+');
  if (!MAC) return parts.map((p) => (p === 'Mod' ? 'Ctrl' : p)).join('+');
  const mac = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃', Enter: '↵' };
  return parts.map((p) => mac[p] ?? p).join('');
}
keys.mac = MAC;

/** True when a key press is meant as typing, not as a shortcut. */
export function isTyping(el) {
  if (!el) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return true;
  return el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(el.type);
}

// --------------------------------------------------------------- combobox ---

let comboCount = 0;

/**
 * Turn a text input into a combobox: a filtered list under it, arrow keys
 * and Enter to choose, Escape to close. The input's parent must be
 * positioned (position: relative); the list is appended to it.
 *
 *   combobox(input, {
 *     options: () => [{ value: 'a.md', meta: '5' }, ...],   // read on every open
 *     onChoose: (value) => ...,                             // '' when cleared
 *     onType: (text) => ...,                                // as the person types
 *   })
 *
 * Typed text filters by substring and highlights the match. Returns
 * { open, close, choose, destroy }.
 */
export function combobox(input, { options, onChoose = () => {}, onType = () => {}, empty = 'No matches' } = {}) {
  const id = `lt-combo-${++comboCount}`;
  const menu = document.createElement('ul');
  menu.className = 'lt-popover lt-menu';
  menu.id = id;
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  Object.assign(menu.style, {
    position: 'absolute', top: 'calc(100% + 4px)', left: '0', zIndex: '10',
    minWidth: '100%', width: 'max-content', maxWidth: 'min(560px, calc(100vw - 32px))',
  });
  input.parentElement.append(menu);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', id);
  input.autocomplete = 'off';

  let items = [];
  let active = -1;
  let picked = false;   // the box holds a chosen value, not a search

  function render() {
    const q = picked ? '' : input.value.trim().toLowerCase();
    items = options().filter((o) => !q || String(o.label ?? o.value).toLowerCase().includes(q));
    active = items.length ? 0 : -1;
    menu.textContent = '';
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'lt-menu-empty';
      li.textContent = empty;
      menu.append(li);
    }
    items.forEach((o, i) => {
      const li = document.createElement('li');
      li.className = 'lt-menu-item';
      li.id = `${id}-${i}`;
      li.setAttribute('role', 'option');
      const label = String(o.label ?? o.value);
      const name = document.createElement('span');
      const at = q ? label.toLowerCase().indexOf(q) : -1;
      if (at >= 0) {
        const m = document.createElement('mark');
        m.textContent = label.slice(at, at + q.length);
        name.append(label.slice(0, at), m, label.slice(at + q.length));
      } else {
        name.textContent = label;
      }
      li.append(name);
      if (o.meta !== undefined) {
        const meta = document.createElement('span');
        meta.className = 'lt-menu-meta';
        meta.textContent = o.meta;
        li.append(meta);
      }
      // mousedown, not click: a click blurs the input and closes the menu first.
      li.addEventListener('mousedown', (ev) => { ev.preventDefault(); choose(o.value); });
      li.addEventListener('mousemove', () => { if (active !== i) { active = i; mark(); } });
      menu.append(li);
    });
    mark();
  }

  function mark() {
    [...menu.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    const li = menu.children[active];
    if (li?.id) { input.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); }
    else input.removeAttribute('aria-activedescendant');
  }

  function open() {
    render();
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    menu.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  }

  function choose(value) {
    input.value = value;
    picked = !!value;
    close();
    onChoose(value);
  }

  const onFocus = () => { input.select(); open(); };
  const onInput = () => { picked = false; open(); onType(input.value); };
  const onKey = (ev) => {
    const isOpen = !menu.hidden;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      if (!isOpen) return open();
      if (!items.length) return;
      active = (active + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      mark();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (isOpen && active >= 0) choose(items[active].value);
      input.blur();
    } else if (ev.key === 'Escape' && isOpen) {
      // The first Escape closes the list; the next one is the page's.
      ev.preventDefault();
      ev.stopPropagation();
      close();
    }
  };

  input.addEventListener('focus', onFocus);
  input.addEventListener('blur', close);
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKey);

  return {
    open,
    close,
    choose,
    /** True when the box holds a value picked from the list. */
    get picked() { return picked; },
    destroy() {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', close);
      input.removeEventListener('input', onInput);
      input.removeEventListener('keydown', onKey);
      menu.remove();
    },
  };
}

// ----------------------------------------------------------------- dialog ---

/**
 * A modal over a native <dialog class="lt-dialog">. The browser does the
 * hard parts (focus held inside, Escape closes, the rest of the page inert);
 * this adds closing on a backdrop click and handing focus back afterwards.
 *
 * Returns { open, close, toggle, get isOpen }.
 */
export function dialog(el, { onClose = () => {} } = {}) {
  let returnTo = null;
  el.addEventListener('click', (ev) => {
    // A click on the dialog element itself, outside its content box, is the backdrop.
    if (ev.target !== el) return;
    const r = el.getBoundingClientRect();
    const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
    if (!inside) el.close();
  });
  el.addEventListener('close', () => { returnTo?.focus?.(); returnTo = null; onClose(); });
  return {
    open() { if (!el.open) { returnTo = document.activeElement; el.showModal(); } },
    close() { if (el.open) el.close(); },
    toggle() { el.open ? el.close() : this.open(); },
    get isOpen() { return el.open; },
  };
}

// ------------------------------------------------------------------ toast ---

let region = null;

/**
 * A short message near the foot of the screen, announced to screen readers
 * (role=status, polite). Returns a function that dismisses it early.
 * Set --lt-toast-lift on <body> to clear anything else floating down there.
 */
export function toast(message, { timeout = 2400, tone = '' } = {}) {
  if (!region || !region.isConnected) {
    region = document.createElement('div');
    region.className = 'lt-toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.append(region);
  }
  const el = document.createElement('div');
  el.className = `lt-toast lt-popover${tone ? ` lt-tone-${tone}` : ''}`;
  el.textContent = message;
  // One at a time reads better than a stack for short confirmations.
  region.textContent = '';
  region.append(el);
  let timer = setTimeout(dismiss, timeout);
  function dismiss() {
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 220);
  }
  return dismiss;
}
