# Contributing and codebase guide

This repository contains the initial v1 implementation of `@yves/inline-svg`: a small React/Next.js package for rendering sanitized inline SVGs from server-provided SVG markup or browser-fetched SVG URLs.

The package is intentionally narrow. v1 owns the React component API, Next.js-friendly client boundary, URL loading shell, SSR behavior for raw markup, sanitizer baseline, dimension helpers, and `color`-driven `currentColor` rewriting that preserves source colors when no color is supplied. Avoid expanding it into a broad SVG loader unless the public scope changes.

## Repository map

- `src/index.ts` is the package entry point. It exports `InlineSVG` as both a named and default export, plus the public prop/event types.
- `src/InlineSVG.tsx` owns the React component behavior:
  - normalizing `src` values from strings or static asset objects with a `src` field;
  - rendering sanitized `svg` markup immediately, including during server rendering;
  - rendering a stable fallback shell for URL sources and fetching them in the browser after hydration;
  - lazy URL loading with `IntersectionObserver` when available;
  - wrapper styling and sizing, including the block-by-default `<span>` shell, inner SVG fill sizing, load/error callbacks, and `data-inline-svg` state attributes.
- `src/sanitize.ts` owns SVG preparation before anything is injected into the DOM. Keep sanitizer allowlists, unsafe URL-function stripping, accessibility semantics, title/dimension transforms, and `currentColor` paint rewriting centralized there.
- `test/InlineSVG.test.tsx` contains the executable behavior coverage using `node:test`, Testing Library, JSDOM, and `react-dom/server`.
- `package.json`, `tsconfig*.json`, and the lockfile define the publishable package shape and validation commands.

## Common commands

From the repository root:

```sh
npm install
npm run build
npm run test
npm run typecheck
npm run lint
```

`lint` currently aliases TypeScript checking. `prepack` runs `npm run build`, so `npm pack` should produce `dist/` from the publishable package build.

There is intentionally no in-repository playground in this package shape. Validate changes with the package commands above and with behavior tests that exercise the public component API.

## Security and trust model

All rendered SVG markup must pass through `prepareSvgMarkup` in `src/sanitize.ts`. Do not add component paths that inject raw markup directly.

Current sanitizer/accessibility ownership:

- `sanitize-html` removes disallowed tags and attributes while preserving SVG tag/attribute casing.
- The allowlist is deliberately SVG-focused and excludes inline `style` attributes and event handlers.
- URL-bearing attributes are restricted to `http`/`https` schemes where the sanitizer applies scheme checks.
- A post-sanitize pass removes attributes whose `url(...)` references are not local fragment IDs or `http(s)` URLs.
- `currentColor` rewriting is requested by the component when the `color` prop is supplied or `currentColor={true}` is explicit. It only changes literal `fill`/`stroke` paint attributes and intentionally preserves `none`, existing `currentColor`, CSS variables, and obvious `url(...)` paint references.
- Accessibility semantics are applied in `applyRootSvgOptions`: meaningful `title` text creates one named inner SVG image, while omitted/empty titles are decorative (`aria-hidden="true"`); all SVGs get `focusable="false"` and root `tabindex` is removed.

Sanitization is a baseline, not permission to trust arbitrary third-party SVGs. Remote `src` values are fetched in the browser, sanitized, and injected after hydration; callers should still prefer trusted origins, size limits where appropriate, CSP, and review of user- or brand-visible assets. If you broaden the allowlist, add tests for both the newly allowed behavior and representative unsafe input that must still be stripped.

## Changing component behavior

When changing props or rendering behavior:

1. Update `InlineSVGProps` and exported types in `src/InlineSVG.tsx`/`src/index.ts` as needed.
2. Preserve the SSR boundary: `svg` markup can render inline on the server; URL `src` sources should keep a deterministic fallback shell until browser fetch completes.
3. Preserve `viewBox` during dimension changes. `removeDimensions` should remove source root `width`/`height` for raw `svg` markup variables and URL-fetched markup; without that prop or wrapper sizing, source dimensions should be preserved. `size`, `width`, and `height` should apply to the wrapper `<span>`, while the inner `<svg>` fills the matching wrapper axes with `100%` dimensions so source dimensions do not fight wrapper sizing.
4. Keep color rewriting automatic when `color` is supplied, preserve source paints when `color` is absent, and honor the `currentColor={false}` opt-out. `color` should remain a wrapper CSS color, so source paints that already use `currentColor` still inherit it.
5. Preserve accessibility semantics for WCAG Level A-supporting SVG image behavior: meaningful `title` gives one accessible image name, omitted/empty title is decorative, and the SVG itself is not keyboard-focusable by default. Interactive controls still need app-level labels.
6. Add or update behavior tests in `test/InlineSVG.test.tsx`. Prefer observable rendering, accessibility role queries, callback, sanitization, fetch, and server-rendering assertions over source-text checks.
7. Update README examples and this guide when public usage or contributor workflow changes.
