# @yves/inline-svg

Small React/Next.js component for rendering sanitized inline SVGs from either raw SVG markup or SVG URLs.

It is intentionally narrow: v1 focuses on React and Next.js, static/imported SVG asset URLs, remote SVG URLs, SSR-aware rendering boundaries, a sanitizer baseline, and `color`-driven `currentColor` styling that preserves source colors when no color is supplied.

Contributors can read [CONTRIBUTING.md](./CONTRIBUTING.md) for the codebase map, package validation commands, and sanitizer ownership guidance.

## Install

```sh
npm install @yves/inline-svg
```

Peer dependency: React 18 or 19. Runtime Node support is `>=18`.

## React usage

```tsx
import InlineSVG from '@yves/inline-svg';

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

`svg` markup is sanitized and can be rendered during SSR. When you pass `color`, literal `fill` and `stroke` paint attributes are rewritten to `currentColor` so that color takes effect. Without `color`, source colors are preserved by default. Pass `currentColor={false}` to preserve source colors even when `color` is supplied.

## Static/imported SVG asset URLs

Use `src` for URLs emitted by your bundler or framework. The component accepts either a string URL or a static asset object with a `src` field.

```tsx
import InlineSVG from '@yves/inline-svg';
import iconUrl from './icon.svg?url';

export function ViteIcon() {
  return <InlineSVG src={iconUrl} title="Settings" fallback={<span aria-hidden />} />;
}
```

```tsx
import InlineSVG from '@yves/inline-svg';
import icon from './icon.svg'; // supported when your toolchain emits a URL or { src: string }

export function ImportedIcon() {
  return <InlineSVG src={icon} title="Account" size="1.25rem" />;
}
```

URL sources are fetched in the browser after hydration. Provide `fallback` when you want stable loading/error UI.

## Remote URL example

```tsx
import InlineSVG from '@yves/inline-svg';

export function RemoteBadge() {
  return (
    <InlineSVG
      src="https://cdn.example.com/badges/pro.svg"
      title="Pro plan"
      loading="lazy"
      fallback={<span className="icon-placeholder" aria-hidden />}
      onError={(error) => console.error(error)}
    />
  );
}
```

Remote SVGs are fetched, sanitized, then injected. Prefer URLs you control and keep normal browser defenses such as CSP in place.

## Next.js examples

### App Router/public asset

`InlineSVG` is published with a `use client` boundary. You can render it from a Server Component with serializable props. If you pass callbacks such as `onLoad` or `onError`, put that wrapper in a Client Component.

```tsx
// app/page.tsx
import InlineSVG from '@yves/inline-svg';

export default function Page() {
  return <InlineSVG src="/icons/check.svg" title="Ready" size={24} color="#16a34a" />;
}
```

### SSR with server-resolved markup

For deterministic inline SVG in the initial HTML, read or generate the SVG markup on the server and pass it through `svg`.

```tsx
// app/page.tsx
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import InlineSVG from '@yves/inline-svg';

export default async function Page() {
  const svg = await readFile(join(process.cwd(), 'public/icons/logo.svg'), 'utf8');

  return <InlineSVG svg={svg} title="Acme" removeDimensions width={120} />;
}
```

## SSR boundary

- `svg="<svg ...>"`: sanitized and rendered inline on the server and client.
- `src="/icon.svg"` or `src="https://..."`: the server renders a stable `<span data-inline-svg="loading">` shell with your `fallback`; the browser fetches, sanitizes, and swaps in the SVG after hydration.
- Imported/static asset URLs are still URLs. If you need the actual SVG in server-rendered HTML, resolve the file to markup yourself and pass `svg`.

## Styling and color props

- `className` and `style` apply to the stable wrapper `<span>`.
- `color` sets the wrapper CSS `color`; when supplied, literal `fill` and `stroke` attributes are rewritten to `currentColor` so this color cascades into the SVG.
- Without `color`, source `fill` and `stroke` values are preserved by default. Set `currentColor={true}` to force rewriting for an inherited CSS color, or `currentColor={false}` to preserve source paints even when `color` is supplied. The opt-out only disables rewriting; source paints that already use `currentColor` still inherit the wrapper color. The rewrite preserves `none`, existing `currentColor`, CSS variables, and obvious `url(...)` references for gradients, masks, and patterns.
- `size` sets both rendered SVG width and height. Explicit `width` or `height` overrides that axis.
- `removeDimensions` removes source `width`/`height` before applying explicit dimensions, while preserving `viewBox`.
- `title` inserts an accessible `<title>` and `aria-label`; `title=""` marks the SVG hidden.

## Security notes

This package sanitizes all SVG markup with `sanitize-html` before injection and configures it for SVG case preservation. The sanitizer baseline strips script tags, event handler attributes, inline style attributes from supplied SVGs, and `javascript:`-style URL attributes covered by the SVG allowlist.

Sanitization reduces risk; it is not a complete trust model for arbitrary third-party SVGs. Treat remote SVG URLs like other active content inputs: use trusted origins, size limits where appropriate, CSP, and review any SVGs that can affect user trust or brand presentation.

## Why this exists

Existing packages such as broad inline-SVG loaders solve many edge cases. `@yves/inline-svg` aims for a smaller v1 surface instead:

- a small Next.js-aware React API;
- an explicit SSR-aware source boundary (`svg` renders on the server, `src` fetches in the browser);
- a built-in sanitizer baseline rather than documentation-only safety guidance;
- `color`-driven `currentColor` styling with explicit force/opt-out controls instead of competing feature-for-feature with larger inline-SVG packages.
