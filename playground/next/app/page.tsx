import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import InlineSVG from '@yves/inline-svg';
import importedStarUrl from './assets/imported-star.svg';

const colorSource = `
  <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="26" fill="#facc15" stroke="#854d0e" stroke-width="6" />
    <path d="M22 34h20" stroke="#854d0e" stroke-width="6" stroke-linecap="round" />
    <path d="M20 48h24" fill="none" stroke="url(#kept-missing-gradient)" stroke-width="3" />
  </svg>
`;

const dirtySource = `
  <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" onload="alert('root onload should be stripped')">
    <script>alert('script should be stripped')</script>
    <rect x="8" y="8" width="64" height="64" rx="16" fill="#ef4444" onclick="alert('onclick should be stripped')" />
    <path d="M24 40h32" stroke="white" stroke-width="8" stroke-linecap="round" clip-path="url(javascript:alert('clip path should be stripped'))" />
  </svg>
`;

const dimensionSource = `
  <svg width="240" height="96" viewBox="0 0 240 96" xmlns="http://www.w3.org/2000/svg">
    <rect x="4" y="4" width="232" height="88" rx="20" fill="#dbeafe" stroke="#2563eb" stroke-width="8" />
    <path d="M36 48h168" stroke="#1d4ed8" stroke-width="12" stroke-linecap="round" />
  </svg>
`;

export default async function PlaygroundPage() {
  const ssrLogo = await readFile(join(process.cwd(), 'public/ssr-logo.svg'), 'utf8');

  return (
    <main>
      <header>
        <h1>@yves/inline-svg playground</h1>
        <p>
          Manual Next.js playground for static/imported URLs, a local remote-URL substitute, SSR markup,
          sanitizer behavior, opt-in <code>currentColor</code> styling, and dimension handling.
        </p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>SSR: server-resolved SVG markup</h2>
          <p className="note">
            The page reads <code>public/ssr-logo.svg</code> on the server and passes raw markup through
            <code> svg</code>. The initial HTML should already contain the sanitized inline SVG.
          </p>
          <div className="stage">
            <InlineSVG svg={ssrLogo} title="SSR inline logo" removeDimensions width={180} />
          </div>
        </section>

        <section className="card">
          <h2>Static/imported SVG URL</h2>
          <p className="note">
            This imports <code>app/assets/imported-star.svg</code> through Next/webpack as a URL, then
            fetches and sanitizes it on the client.
          </p>
          <div className="stage">
            <InlineSVG src={importedStarUrl} title="Imported star" size={72} fallback="Loading imported SVG..." />
          </div>
        </section>

        <section className="card">
          <h2>Public static asset URL</h2>
          <p className="note">
            This uses a public asset path. It behaves like any other browser-only URL source.
          </p>
          <div className="stage">
            <InlineSVG src="/static-public.svg" title="Public static check" size={72} fallback="Loading public SVG..." />
          </div>
        </section>

        <section className="card">
          <h2>Remote URL substitute</h2>
          <p className="note">
            <code>/api/remote-icon</code> returns SVG from a route handler so the demo works offline while
            exercising the same URL-fetch path as a remote CDN SVG.
          </p>
          <div className="stage">
            <InlineSVG src="/api/remote-icon" title="Fetched route SVG" loading="lazy" fallback="Lazy loading route SVG..." />
          </div>
        </section>

        <section className="card">
          <h2>Opt-in currentColor styling</h2>
          <p className="note">
            The left icon keeps source colors. The right icon rewrites literal fill/stroke values to
            <code> currentColor</code> while preserving <code>none</code> and <code>url(...)</code> paints.
          </p>
          <div className="stage">
            <span className="swatch">
              <InlineSVG svg={colorSource} title="Original source colors" removeDimensions size={72} />
              original
            </span>
            <span className="swatch">
              <InlineSVG svg={colorSource} title="Current color rewrite" removeDimensions size={72} color="#7c3aed" currentColor />
              currentColor
            </span>
          </div>
        </section>

        <section className="card">
          <h2>Sanitizer behavior</h2>
          <p className="note">
            This inline SVG intentionally includes <code>script</code>, <code>onload</code>, <code>onclick</code>,
            and a JavaScript URL reference. It should render without alerts; inspect the DOM to verify the
            unsafe attributes are gone.
          </p>
          <div className="stage">
            <InlineSVG svg={dirtySource} title="Sanitized dangerous input" removeDimensions size={80} currentColor color="#dc2626" />
          </div>
        </section>

        <section className="card">
          <h2>Dimension handling</h2>
          <p className="note">
            Source dimensions are <code>240x96</code>. These examples preserve <code>viewBox</code>, remove
            source dimensions, then apply <code>size</code> or explicit <code>width</code>/<code>height</code>.
          </p>
          <div className="stage">
            <span className="swatch">
              <InlineSVG svg={dimensionSource} title="Square size override" removeDimensions size={72} />
              size=72
            </span>
            <span className="swatch">
              <InlineSVG svg={dimensionSource} title="Explicit dimensions" removeDimensions width={150} height={60} />
              150×60
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
