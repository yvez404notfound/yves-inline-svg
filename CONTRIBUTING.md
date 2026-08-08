# Contributing and codebase guide

This repository contains the initial v1 implementation of `@yves/inline-svg`: a small React/Next.js package for rendering sanitized inline SVGs from server-provided SVG markup or browser-fetched SVG URLs.

The package is intentionally narrow. v1 owns the React component API, Next.js-friendly client boundary, URL loading shell, SSR behavior for raw markup, sanitizer baseline, dimension helpers, and opt-in `currentColor` color rewriting. Avoid expanding it into a broad SVG loader unless the public scope changes.

## Repository map

- `src/index.ts` is the package entry point. It exports `InlineSVG` as both a named and default export, plus the public prop/event types.
- `src/InlineSVG.tsx` owns the React component behavior:
  - normalizing `src` values from strings or static asset objects with a `src` field;
  - rendering sanitized `svg` markup immediately, including during server rendering;
  - rendering a stable fallback shell for URL sources and fetching them in the browser after hydration;
  - lazy URL loading with `IntersectionObserver` when available;
  - wrapper styling, load/error callbacks, and `data-inline-svg` state attributes.
- `src/sanitize.ts` owns SVG preparation before anything is injected into the DOM. Keep sanitizer allowlists, unsafe URL-function stripping, title/dimension transforms, and `currentColor` paint rewriting centralized there.
- `test/InlineSVG.test.tsx` contains the executable behavior coverage using `node:test`, Testing Library, JSDOM, and `react-dom/server`.
- `playground/next` is a local Next.js App Router playground for manual checks against the packed package output.
- `package.json`, `tsconfig*.json`, and the lockfiles define the publishable package shape and validation commands.

## Common commands

From the repository root:

```sh
npm install
npm run build
npm run test
npm run typecheck
npm run lint
```

`lint` currently aliases TypeScript checking. `prepack` runs `npm run build`, so `npm pack` should produce `dist/` from the same build path used by the playground.

## Next playground

The playground verifies behavior that is awkward to cover with unit tests alone: Next.js static/imported SVG URLs, public asset URLs, a route-handler stand-in for a remote SVG URL, server-resolved markup, sanitizer behavior, `currentColor`, and dimension handling.

Run it with:

```sh
npm install
npm --prefix playground/next install
npm --prefix playground/next run install:package
npm --prefix playground/next run dev
```

Then open <http://localhost:3000>. The `install:package` script packs the repository and installs the tarball into the playground so the app exercises publishable `dist/` output, not source files. After changing package source, rerun `npm --prefix playground/next run install:package` and restart Next. For a production-mode check, run:

```sh
npm --prefix playground/next run install:package
npm --prefix playground/next run build
npm --prefix playground/next run start
```

## Security and trust model

All rendered SVG markup must pass through `prepareSvgMarkup` in `src/sanitize.ts`. Do not add component paths that inject raw markup directly.

Current sanitizer ownership:

- `sanitize-html` removes disallowed tags and attributes while preserving SVG tag/attribute casing.
- The allowlist is deliberately SVG-focused and excludes inline `style` attributes and event handlers.
- URL-bearing attributes are restricted to `http`/`https` schemes where the sanitizer applies scheme checks.
- A post-sanitize pass removes attributes whose `url(...)` references are not local fragment IDs or `http(s)` URLs.
- `currentColor` rewriting only changes literal `fill`/`stroke` paint attributes and intentionally preserves `none`, existing `currentColor`, CSS variables, and obvious `url(...)` paint references.

Sanitization is a baseline, not permission to trust arbitrary third-party SVGs. Remote `src` values are fetched in the browser, sanitized, and injected after hydration; callers should still prefer trusted origins, size limits where appropriate, CSP, and review of user- or brand-visible assets. If you broaden the allowlist, add tests for both the newly allowed behavior and representative unsafe input that must still be stripped.

## Changing component behavior

When changing props or rendering behavior:

1. Update `InlineSVGProps` and exported types in `src/InlineSVG.tsx`/`src/index.ts` as needed.
2. Preserve the SSR boundary: `svg` markup can render inline on the server; URL `src` sources should keep a deterministic fallback shell until browser fetch completes.
3. Preserve `viewBox` during dimension changes. `removeDimensions` should remove source `width`/`height`; `size`, `width`, and `height` should then apply rendered dimensions.
4. Keep color rewriting opt-in. `color` should remain a wrapper CSS color, and source paints should only be rewritten when `currentColor` is true.
5. Add or update behavior tests in `test/InlineSVG.test.tsx`. Prefer observable rendering, callback, sanitization, fetch, and server-rendering assertions over source-text checks.
6. Update the Next playground when a change is best validated manually in a real Next app.
7. Update README examples and this guide when public usage or contributor workflow changes.
