/** Keep keyboard geometry separate from the page's layout viewport. */
export function viewportGeometry({
  layoutHeight,
  height,
  top,
  scale,
  editing,
}: {
  layoutHeight: number;
  height: number;
  top: number;
  scale: number;
  editing: boolean;
}) {
  // Pinch zoom is not a keyboard resize. Let the browser handle zoom and pan.
  if (Math.abs(scale - 1) > 0.01) {
    return { height: layoutHeight, top: 0, keyboardOpen: false };
  }
  return {
    height: Math.max(0, height),
    top: Math.max(0, top),
    keyboardOpen:
      editing && layoutHeight - height > Math.max(120, layoutHeight * 0.2),
  };
}

function isEditing(element: Element | null) {
  if (element instanceof HTMLTextAreaElement)
    return !element.readOnly && !element.disabled;
  if (element instanceof HTMLInputElement) {
    return (
      !element.readOnly &&
      !element.disabled &&
      /^(text|search|email|url|tel|password|number)$/.test(element.type)
    );
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

/** Publish geometry for overlays only; never scroll, blur or move a form. */
export function trackMobileViewport(win: Window = window) {
  const root = win.document.documentElement;
  const viewport = win.visualViewport;
  let frame: number | undefined;

  function apply() {
    frame = undefined;
    const geometry = viewportGeometry({
      layoutHeight: win.innerHeight,
      height: viewport?.height ?? win.innerHeight,
      top: viewport?.offsetTop ?? 0,
      scale: viewport?.scale ?? 1,
      editing: isEditing(win.document.activeElement),
    });
    root.style.setProperty("--visual-viewport-height", `${geometry.height}px`);
    root.style.setProperty("--visual-viewport-top", `${geometry.top}px`);
    root.toggleAttribute("data-keyboard-open", geometry.keyboardOpen);
  }

  function schedule() {
    if (frame === undefined) frame = win.requestAnimationFrame(apply);
  }

  apply();
  viewport?.addEventListener("resize", schedule);
  viewport?.addEventListener("scroll", schedule);
  win.addEventListener("resize", schedule);
  win.addEventListener("pageshow", schedule);
  win.document.addEventListener("focusin", schedule);
  win.document.addEventListener("focusout", schedule);

  return () => {
    if (frame !== undefined) win.cancelAnimationFrame(frame);
    viewport?.removeEventListener("resize", schedule);
    viewport?.removeEventListener("scroll", schedule);
    win.removeEventListener("resize", schedule);
    win.removeEventListener("pageshow", schedule);
    win.document.removeEventListener("focusin", schedule);
    win.document.removeEventListener("focusout", schedule);
    root.style.removeProperty("--visual-viewport-height");
    root.style.removeProperty("--visual-viewport-top");
    root.removeAttribute("data-keyboard-open");
  };
}

/** Opening a mobile dialog should not also summon the software keyboard. */
export function focusDialogOnTouch(event: Event) {
  if (!window.matchMedia("(hover: none) and (pointer: coarse)").matches) return;
  if (!(event.target instanceof HTMLElement)) return;
  event.preventDefault();
  event.target.focus({ preventScroll: true });
}
