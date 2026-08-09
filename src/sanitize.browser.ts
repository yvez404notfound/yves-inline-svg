import createDOMPurify from 'dompurify';
import { configureSvgPurifier, createPrepareSvgMarkup } from './sanitize.js';
import type { DOMPurify } from 'dompurify';
import type { PrepareSvgOptions, SvgSanitizerRuntime } from './sanitize.js';

let runtime: SvgSanitizerRuntime | null = null;

function getBrowserRuntime(): SvgSanitizerRuntime {
  const browserWindow = globalThis.window;

  if (!browserWindow?.DOMParser) {
    throw new Error('InlineSVG requires a browser DOM or the node sanitizer entry for SVG sanitization.');
  }

  if (!runtime) {
    runtime = {
      DOMParser: browserWindow.DOMParser,
      purifier: configureSvgPurifier(createDOMPurify(browserWindow) as DOMPurify)
    };
  }

  return runtime;
}

export const prepareSvgMarkup: (markup: string, options?: PrepareSvgOptions) => string = createPrepareSvgMarkup(getBrowserRuntime);
export type { PrepareSvgOptions } from './sanitize.js';
