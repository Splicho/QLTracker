type ThemeValue = "light" | "dark" | "system";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    finished: Promise<void>;
  };
};

function setTransitionOrigin(x: number, y: number) {
  document.documentElement.style.setProperty("--x", `${x}px`);
  document.documentElement.style.setProperty("--y", `${y}px`);
}

function clearTransitionOrigin() {
  document.documentElement.style.removeProperty("--x");
  document.documentElement.style.removeProperty("--y");
}

function getElementCenter(element: HTMLElement) {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function changeThemeWithTransition(
  theme: ThemeValue,
  setTheme: (theme: ThemeValue) => void,
  element?: HTMLElement | null,
  origin?: { x: number; y: number } | null,
) {
  const nextOrigin = origin ?? (element ? getElementCenter(element) : null);
  const transitionDocument = document as ViewTransitionDocument;

  if (!transitionDocument.startViewTransition || !nextOrigin) {
    setTheme(theme);
    return;
  }

  setTransitionOrigin(nextOrigin.x, nextOrigin.y);

  transitionDocument
    .startViewTransition(() => {
      setTheme(theme);
    })
    .finished.finally(() => {
      clearTransitionOrigin();
    });
}
