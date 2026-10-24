import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * BrowserRouter keeps the previous page's scroll position. On a phone that
 * opened the next page half-way down, with its title hidden under the sticky
 * header. Reset to the top on every route change, except for in-page anchors
 * (e.g. /agency/compliance#credential-review-queue), which handle their own
 * scrolling.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname, hash]);
  return null;
}
