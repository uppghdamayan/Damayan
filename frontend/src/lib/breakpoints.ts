/**
 * Single source of truth for layout breakpoints.
 *
 * These values are mirrored in `src/app/globals.css` as the
 * `--container-phone/tablet/laptop/compact/wide` keys inside `@theme inline`,
 * which is what generates the `@laptop/app:` / `@max-laptop/app:` Tailwind
 * variants. Keep the two in sync — CSS decides how things look, this file
 * decides how the JS in `uiStore` and the resize handles behave, and the whole
 * design depends on both measuring the same thing.
 *
 * The quantity being measured is the width of `#app-root`, NOT
 * `window.innerWidth`. `UiScaleEffect` sets `zoom` on `<html>`, so the two
 * differ at any UI scale other than 100%. `uiStore.appWidth` is fed by a
 * ResizeObserver on `#app-root`, which puts it in the same coordinate space as
 * the container queries.
 */
export const BP = {
  /** Below this the app is not usable; `NarrowScreenNotice` takes over. */
  phone: 640,
  tablet: 768,
  /** Side panels switch from in-flow columns to overlays below this. */
  laptop: 1024,
  /** Below this the two side panels are mutually exclusive. */
  compact: 1101,
  wide: 1440,
} as const;

/** The center column may never be squeezed below this by panel resizing. */
export const MIN_CENTER_W = 560;

export const SIDEBAR_MIN_PX = 200;
export const SIDEBAR_MAX_PX = 360;

export const DOC_PANEL_MIN_PX = 300;
export const DOC_PANEL_MAX_PX = 720;

/** sessionStorage key for dismissing the narrow-screen blocker. */
export const NARROW_NOTICE_DISMISSED_KEY = 'damayan-narrow-notice-dismissed';
