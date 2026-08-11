# yvez-inline-svg
![NPM Version](https://img.shields.io/npm/v/yvez-inline-svg)
![NPM Downloads](https://img.shields.io/npm/dm/yvez-inline-svg)

Small React/Next.js component for rendering sanitized inline SVGs from either raw SVG markup or SVG URLs.

It is intentionally narrow: v1 focuses on React and Next.js, static/imported SVG asset URLs, remote SVG URLs, SSR-aware rendering boundaries, a sanitizer baseline, and `color`-driven `currentColor` styling that preserves source colors when no color is supplied.

Contributors can read [CONTRIBUTING.md](./CONTRIBUTING.md) for the codebase map, package validation commands, and sanitizer ownership guidance.

## Install

```sh
npm install yvez-inline-svg
```

Peer dependency: React 18 or 19. Runtime Node support is `>=18`.

## React usage

```tsx
import InlineSVG from "yvez-inline-svg";

const check = `
  <svg viewBox="0 0 24 24" width="24" height="24">
    <path fill="#111" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
  </svg>
`;

export function StatusIcon() {
	return (
		<InlineSVG
			svg={check}
			title="Complete"
			size={20}
			color="seagreen"
			removeDimensions
		/>
	);
}
```

`svg` markup is sanitized and can be rendered during SSR. The example passes `removeDimensions` because raw SVG string variables keep source `width`/`height` unless you opt in to removing them. When you pass `color`, literal `fill` and `stroke` paint attributes are rewritten to `currentColor` so that color takes effect. Without `color`, source colors are preserved by default. Pass `currentColor={false}` to preserve source colors even when `color` is supplied.

## Static/imported SVG asset URLs

Use `src` for URLs emitted by your bundler or framework. The component accepts either a string URL or a static asset object with a `src` field.

```tsx
import InlineSVG from "yvez-inline-svg";
import iconUrl from "./icon.svg?url";

export function ViteIcon() {
	return (
		<InlineSVG
			src={iconUrl}
			title="Settings"
			fallback={<span aria-hidden />}
		/>
	);
}
```

```tsx
import InlineSVG from "yvez-inline-svg";
import icon from "./icon.svg"; // supported when your toolchain emits a URL or { src: string }

export function ImportedIcon() {
	return (
		<InlineSVG
			src={icon}
			title="Account"
			size="1.25rem"
		/>
	);
}
```

URL sources are fetched in the browser after hydration. Provide `fallback` when you want stable loading/error UI.

## Remote URL example

```tsx
import InlineSVG from "yvez-inline-svg";

export function RemoteBadge() {
	return (
		<InlineSVG
			src="https://cdn.example.com/badges/pro.svg"
			title="Pro plan"
			loading="lazy"
			fallback={
				<span
					className="icon-placeholder"
					aria-hidden
				/>
			}
			onError={(error) => console.error(error)}
		/>
	);
}
```

Remote SVGs are fetched in the browser, sanitized with the browser DOMPurify path, then injected. Prefer URLs you control and keep normal browser defenses such as CSP in place.

## Next.js examples

### App Router/public asset

`InlineSVG` is published with a `use client` boundary. You can render it from a Server Component with serializable props. If you pass callbacks such as `onLoad` or `onError`, put that wrapper in a Client Component.

```tsx
// app/page.tsx
import InlineSVG from "yvez-inline-svg";

export default function Page() {
	return (
		<InlineSVG
			src="/icons/check.svg"
			title="Ready"
			size={24}
			color="#16a34a"
		/>
	);
}
```

### SSR with server-resolved markup

For deterministic inline SVG in the initial HTML, read or generate the SVG markup on the server and pass it through `svg`.

```tsx
// app/page.tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import InlineSVG from "yvez-inline-svg";

export default async function Page() {
	const svg = await readFile(
		join(process.cwd(), "public/icons/logo.svg"),
		"utf8",
	);

	return (
		<InlineSVG
			svg={svg}
			title="Acme"
			removeDimensions
			width={120}
		/>
	);
}
```

## SSR boundary

- `svg="<svg ...>"`: sanitized and rendered inline on the server and client.
- `src="/icon.svg"` or `src="https://..."`: the server renders a stable `<span data-inline-svg="loading">` shell with your `fallback`; the browser fetches, sanitizes, and swaps in the SVG after hydration.
- Imported/static asset URLs are still URLs. If you need the actual SVG in server-rendered HTML, resolve the file to markup yourself and pass `svg`.

Sanitization uses DOMPurify in both environments. The browser/default package-import condition loads only the browser DOMPurify runtime. The Node/server condition loads a separate DOMPurify + `jsdom` runtime so raw `svg` markup can still be sanitized during SSR without putting `jsdom` or its parser dependencies into browser bundles.

## Styling and color props

- `className` and `style` apply to the stable wrapper `<span>`, which uses `display: block` by default. Override `style.display` if you need different layout.
- `color` sets the wrapper CSS `color`; when supplied, literal `fill` and `stroke` attributes are rewritten to `currentColor` so this color cascades into the SVG.
- Without `color`, source `fill` and `stroke` values are preserved by default. Set `currentColor={true}` to force rewriting for an inherited CSS color, or `currentColor={false}` to preserve source paints even when `color` is supplied. The opt-out only disables rewriting; source paints that already use `currentColor` still inherit the wrapper color. The rewrite preserves `none`, existing `currentColor`, CSS variables, and obvious `url(...)` references for gradients, masks, and patterns.
- `size` sets both wrapper width and height. Explicit `width` or `height` overrides that axis on the wrapper. When the wrapper is sized by these props (or inline `style.width`/`style.height`), the inner SVG uses `width="100%"`/`height="100%"` for the matching axes so source dimensions do not fight the wrapper.
- `removeDimensions` removes source root `width`/`height` while preserving `viewBox`. This applies to raw markup string variables passed with `svg`; without `removeDimensions` or wrapper sizing, source dimensions are preserved.
- `title` controls image semantics: meaningful text names the SVG image; omitted or empty titles make it decorative.

## Accessibility

`InlineSVG` is designed to support WCAG Level A usage for SVG image behavior when used correctly; it does not make an entire app conformant by itself.

- Meaningful `title` text renders the inner SVG as a single accessible image with `role="img"`, an accessible name, and a `<title>` element. The wrapper `<span>` is not given its own image role or label.
- If `title` is omitted or `title=""`, the SVG is treated as decorative with `aria-hidden="true"`; source `<title>`/ARIA labeling on the SVG is stripped during preparation.
- SVGs are not keyboard-focusable by default (`focusable="false"` and no root `tabindex`). Wrap the component in a labeled button/link when the icon is part of an interactive control.
- `fallback` content is rendered as supplied while URL SVGs load or fail. Use accessible fallback text or labels when that fallback conveys meaning; use hidden/decorative fallback for purely visual placeholders.

## Security notes

This package sanitizes all SVG markup with DOMPurify before injection, using a narrow SVG tag/attribute allowlist and package-level URL checks. The sanitizer baseline strips script tags at any depth, event handler attributes, inline `<style>` and `style` CSS, `foreignObject`/nested HTML, `javascript:`/`data:` URLs, external references, and unsafe `url(...)` paint/reference values, and rejects malformed or wrong-namespace roots. Local fragment references such as gradients, clip paths, masks, filters, and symbols are preserved.

Sanitization reduces risk; it is not a complete trust model for arbitrary third-party SVGs. Treat remote SVG URLs like other active content inputs: use trusted origins, size limits where appropriate, CSP, and review any SVGs that can affect user trust or brand presentation.

## Bundle-size goal

The default safe browser path is expected to stay lightweight: React is externalized as a peer, DOMPurify is the only sanitizer included in browser bundles, and server-only sanitizer dependencies must remain out of browser metafiles. Contributors can run `npm run bundle:size` to build a minified browser bundle with React externalized and fail on known heavy/server sanitizer packages or a gzip budget regression.

## Why this exists

Existing packages such as broad inline-SVG loaders solve many edge cases. `yvez-inline-svg` aims for a smaller v1 surface instead:

- a small Next.js-aware React API;
- an explicit SSR-aware source boundary (`svg` renders on the server, `src` fetches in the browser);
- a built-in sanitizer baseline rather than documentation-only safety guidance;
- `color`-driven `currentColor` styling with explicit force/opt-out controls instead of competing feature-for-feature with larger inline-SVG packages.
