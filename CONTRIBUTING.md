# Contributing and codebase guide

This repository contains the initial v1 implementation of `yvez-inline-svg`: a small React/Next.js package for rendering sanitized inline SVGs from server-provided SVG markup or browser-fetched SVG URLs.

The package is intentionally narrow. v1 owns the React component API, Next.js-friendly client boundary, URL loading shell, SSR behavior for raw markup, sanitizer baseline, dimension helpers, and `color`-driven `currentColor` rewriting that preserves source colors when no color is supplied. Avoid expanding it into a broad SVG loader unless the public scope changes.

## Repository map

- `src/index.ts` is the package entry point. It exports `InlineSVG` as both a named and default export, plus the public prop/event types.
- `src/InlineSVG.tsx` owns the React component behavior:
  - normalizing `src` values from strings or static asset objects with a `src` field;
  - rendering sanitized `svg` markup immediately, including during server rendering;
  - rendering a stable fallback shell for URL sources and fetching them in the browser after hydration;
  - lazy URL loading with `IntersectionObserver` when available;
  - wrapper styling and sizing, including the block-by-default `<span>` shell, inner SVG fill sizing, load/error callbacks, and `data-inline-svg` state attributes.
- `src/sanitize.ts` owns SVG preparation before anything is injected into the DOM. Keep sanitizer allowlists, URL/reference policy, accessibility semantics, title/dimension transforms, and `currentColor` paint rewriting centralized there. `src/sanitize.browser.ts` and `src/sanitize.node.ts` are the environment adapters for the browser DOMPurify runtime and the server-only DOMPurify + `jsdom` runtime.
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
npm run bundle:size
```

`lint` currently aliases TypeScript checking. `bundle:size` builds the browser entry with React externalized and fails if server-only sanitizer dependencies enter the browser metafile or the gzip budget is exceeded. `prepack` runs `npm run build`, so `npm pack` should produce `dist/` from the publishable package build.

There is intentionally no in-repository playground in this package shape. Validate changes with the package commands above and with behavior tests that exercise the public component API.

## Security and trust model

All rendered SVG markup must pass through `prepareSvgMarkup` in `src/sanitize.ts`. Do not add component paths that inject raw markup directly.

Current sanitizer/accessibility ownership:

- DOMPurify removes disallowed tags and attributes using the SVG-focused allowlists in `src/sanitize.ts`; do not rely on a broad DOMPurify profile alone.
- The browser/default package-import condition resolves to `src/sanitize.browser.ts`/`dist/sanitize.browser.js`. It must not import `jsdom`, `parse5`, `whatwg-url`, Node built-ins, or other server-only sanitizer dependencies.
- The Node/server package-import condition resolves to `src/sanitize.node.ts`/`dist/sanitize.node.js`, the only runtime path that imports `jsdom`, preserving raw-markup SSR sanitization.
- The allowlist excludes inline `style` attributes, `<style>`, `foreignObject`, nested HTML, and event handlers. Hooks strip `on*` attributes case-insensitively even when DOMPurify would already remove them.
- URL-bearing attributes are local-fragment-only (`href="#id"`/`xlink:href="#id"`). `javascript:`, `data:`, protocol-relative, entity/whitespace-obfuscated, and external references are stripped.
- A post-sanitize pass removes presentation/reference attributes whose `url(...)` values are not local fragment IDs.
- `currentColor` rewriting is requested by the component when the `color` prop is supplied or `currentColor={true}` is explicit. It only changes literal `fill`/`stroke` paint attributes and intentionally preserves `none`, existing `currentColor`, CSS variables, and local `url(...)` paint references.
- Accessibility semantics are applied in `applyRootSvgOptions`: meaningful `title` text creates one named inner SVG image, while omitted/empty titles are decorative (`aria-hidden="true"`); all SVGs get `focusable="false"` and root `tabindex` is removed.
- The sanitizer corpus in `test/sanitize.test.ts` covers bypass classes; expand it whenever the allowlist or URL/reference policy changes.
- Keep `npm run bundle:size` passing when sanitizer dependencies change. It records a reproducible esbuild command with React externalized and checks the browser metafile for heavy/server sanitizer packages.

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
