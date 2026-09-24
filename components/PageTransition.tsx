"use client";

import { ViewTransition } from "react";

const NAV_ENTER = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
} as const;

const NAV_EXIT = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
} as const;

/** Wrap a page's root JSX so hierarchical navigation (tagged with `transitionTypes`
    on the triggering Link/router.push) slides directionally; untagged navigation
    (e.g. the top nav bar) crossfades with no direction. */
export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter={NAV_ENTER} exit={NAV_EXIT} default="none">
      {children}
    </ViewTransition>
  );
}
