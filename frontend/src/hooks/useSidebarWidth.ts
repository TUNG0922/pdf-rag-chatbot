import { useState, useCallback, useEffect, useRef } from "react";

const STORAGE_KEY = "sidebar_width";
const MIN_WIDTH = 220;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 280;

function clamp(value: number) {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
}

/**
 * Manages the sidebar width with drag-to-resize and localStorage persistence.
 * Returns the current width and a handler to start dragging from a handle.
 */
export function useSidebarWidth() {
  const [width, setWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    return saved >= MIN_WIDTH && saved <= MAX_WIDTH ? saved : DEFAULT_WIDTH;
  });

  const dragging = useRef(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const handleMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      // The navbar starts at the left edge, so width == cursor X.
      setWidth(clamp(ev.clientX));
    };
    const handleUp = () => {
      dragging.current = false;
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  return { width, onMouseDown, MIN_WIDTH, MAX_WIDTH };
}
