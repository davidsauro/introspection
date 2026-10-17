// v-autogrow: a <textarea> that grows to fit its text as she types (and shrinks back),
// instead of scrolling inside a fixed box. Re-measures on input, when the bound value is
// changed from outside (e.g. moving to another day), and when the box changes width.

function fit(el) {
  el.style.height = 'auto';
  // scrollHeight excludes the border; add it back so the last line isn't clipped.
  const border = el.offsetHeight - el.clientHeight;
  el.style.height = `${el.scrollHeight + border}px`;
}

const observers = new WeakMap();

export const vAutogrow = {
  mounted(el) {
    el.style.overflowY = 'hidden';
    el.style.resize = 'none';
    el.addEventListener('input', () => fit(el));
    let width = 0;
    const ro = new ResizeObserver(([entry]) => {
      // Only width changes re-wrap the text; ignore the height changes fit() itself causes.
      if (entry.contentRect.width !== width) {
        width = entry.contentRect.width;
        fit(el);
      }
    });
    ro.observe(el);
    observers.set(el, ro);
    fit(el);
  },
  updated(el) {
    fit(el);
  },
  unmounted(el) {
    observers.get(el)?.disconnect();
  },
};
