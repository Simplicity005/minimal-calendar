"use client";

import { useEffect, useState } from "react";

/**
 * Keeps an element mounted for `ms` after `show` turns false so a CSS exit
 * animation can play. Put `data-closing="true"` on the element while `closing`.
 */
export function usePresence(show: boolean, ms = 200) {
  const [mounted, setMounted] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [show, ms]);

  return { mounted: show || mounted, closing: mounted && !show };
}
