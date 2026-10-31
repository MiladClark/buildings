import { afterEach, describe, expect, it, vi } from "vitest";
import {
  focusDialogOnTouch,
  trackMobileViewport,
  viewportGeometry,
} from "./mobile-viewport";

const screen = {
  layoutHeight: 844,
  height: 844,
  top: 0,
  scale: 1,
  editing: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("mobile viewport geometry", () => {
  it("accounts for the keyboard, its suggestion row and viewport panning", () => {
    expect(viewportGeometry({ ...screen, height: 480, top: 44 })).toEqual({
      height: 480,
      top: 44,
      keyboardOpen: true,
    });
    expect(viewportGeometry({ ...screen, height: 436, top: 44 }).height).toBe(
      436,
    );
  });

  it.each([
    { height: 844, editing: true }, // Hardware keyboard / keyboard dismissed.
    { height: 780, editing: true }, // Browser chrome, not a software keyboard.
    { height: 480, editing: false }, // A resize without editing.
    { height: 480, editing: true, scale: 2 }, // Pinch zoom.
  ])(
    "does not treat $height / $editing / $scale as an open keyboard",
    (input) => {
      expect(viewportGeometry({ ...screen, ...input }).keyboardOpen).toBe(
        false,
      );
    },
  );

  it("works in landscape and clamps transient negative viewport offsets", () => {
    expect(
      viewportGeometry({ ...screen, layoutHeight: 390, height: 210, top: -2 }),
    ).toEqual({ height: 210, top: 0, keyboardOpen: true });
  });
});

class TestElement {
  style = {
    setProperty: vi.fn(),
    removeProperty: vi.fn(),
  };
  toggleAttribute = vi.fn();
  removeAttribute = vi.fn();
  focus = vi.fn();
  isContentEditable = false;
}

class TestInput extends TestElement {
  type = "text";
  readOnly = false;
  disabled = false;
}

function environment() {
  vi.stubGlobal("HTMLElement", TestElement);
  vi.stubGlobal("HTMLInputElement", TestInput);
  vi.stubGlobal("HTMLTextAreaElement", class extends TestInput {});
  const root = new TestElement();
  const doc = Object.assign(new EventTarget(), {
    documentElement: root,
    activeElement: new TestInput(),
  });
  const viewport = Object.assign(new EventTarget(), {
    height: 844,
    offsetTop: 0,
    scale: 1,
  });
  let callback: FrameRequestCallback | undefined;
  const win = Object.assign(new EventTarget(), {
    innerHeight: 844,
    visualViewport: viewport,
    document: doc,
    requestAnimationFrame: vi.fn((fn: FrameRequestCallback) => {
      callback = fn;
      return 1;
    }),
    cancelAnimationFrame: vi.fn(() => {
      callback = undefined;
    }),
    scrollTo: vi.fn(),
    matchMedia: vi.fn(() => ({ matches: true })),
  });
  vi.stubGlobal("window", win);
  return {
    root,
    doc,
    viewport,
    win,
    flush: () => {
      const fn = callback;
      callback = undefined;
      fn?.(0);
    },
  };
}

describe("viewport tracking lifecycle", () => {
  it("coalesces keyboard events without scrolling or focusing the page", () => {
    const env = environment();
    const stop = trackMobileViewport(env.win as unknown as Window);
    env.viewport.height = 480;
    env.viewport.offsetTop = 40;
    env.viewport.dispatchEvent(new Event("resize"));
    env.viewport.dispatchEvent(new Event("scroll"));
    expect(env.win.requestAnimationFrame).toHaveBeenCalledTimes(1);
    env.flush();
    expect(env.root.style.setProperty).toHaveBeenCalledWith(
      "--visual-viewport-height",
      "480px",
    );
    expect(env.root.style.setProperty).toHaveBeenCalledWith(
      "--visual-viewport-top",
      "40px",
    );
    expect(env.root.toggleAttribute).toHaveBeenLastCalledWith(
      "data-keyboard-open",
      true,
    );
    expect(env.win.scrollTo).not.toHaveBeenCalled();
    expect(env.doc.activeElement.focus).not.toHaveBeenCalled();

    // Changing fields keeps keyboard geometry; dismissing it restores the state.
    env.doc.activeElement = Object.assign(new TestInput(), {
      type: "password",
    });
    env.doc.dispatchEvent(new Event("focusout"));
    env.doc.dispatchEvent(new Event("focusin"));
    env.flush();
    expect(env.root.toggleAttribute).toHaveBeenLastCalledWith(
      "data-keyboard-open",
      true,
    );
    env.viewport.height = 844;
    env.viewport.dispatchEvent(new Event("resize"));
    env.flush();
    expect(env.root.toggleAttribute).toHaveBeenLastCalledWith(
      "data-keyboard-open",
      false,
    );
    stop();
  });

  it.each(["readOnly", "disabled"])("ignores %s inputs", (property) => {
    const env = environment();
    Object.assign(env.doc.activeElement, { [property]: true });
    env.viewport.height = 480;
    const stop = trackMobileViewport(env.win as unknown as Window);
    expect(env.root.toggleAttribute).toHaveBeenLastCalledWith(
      "data-keyboard-open",
      false,
    );
    stop();
  });

  it("falls back without VisualViewport and removes listeners / queued frames", () => {
    const env = environment();
    const win = { ...env.win, visualViewport: undefined };
    const stopFallback = trackMobileViewport(
      Object.assign(env.win, win) as unknown as Window,
    );
    expect(env.root.style.setProperty).toHaveBeenCalledWith(
      "--visual-viewport-height",
      "844px",
    );
    env.doc.dispatchEvent(new Event("focusin"));
    stopFallback();
    expect(env.win.cancelAnimationFrame).toHaveBeenCalledWith(1);
    env.root.style.setProperty.mockClear();
    env.win.requestAnimationFrame.mockClear();
    env.doc.dispatchEvent(new Event("focusin"));
    env.win.dispatchEvent(new Event("resize"));
    env.flush();
    expect(env.win.requestAnimationFrame).not.toHaveBeenCalled();
    expect(env.root.style.setProperty).not.toHaveBeenCalled();
  });
});

describe("mobile dialog focus", () => {
  it("focuses the dialog instead of opening a keyboard and leaves desktop focus native", () => {
    const env = environment();
    const event = new Event("openAutoFocus", { cancelable: true });
    Object.defineProperty(event, "target", { value: env.root });
    focusDialogOnTouch(event);
    expect(event.defaultPrevented).toBe(true);
    expect(env.root.focus).toHaveBeenCalledWith({ preventScroll: true });
    env.win.matchMedia.mockReturnValue({ matches: false });
    const desktop = new Event("openAutoFocus", { cancelable: true });
    Object.defineProperty(desktop, "target", { value: env.root });
    focusDialogOnTouch(desktop);
    expect(desktop.defaultPrevented).toBe(false);
  });
});
