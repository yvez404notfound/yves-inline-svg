import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { configureSvgPurifier, createPrepareSvgMarkup } from './sanitize.js';
import type { DOMPurify, WindowLike } from 'dompurify';
import type { PrepareSvgOptions, SvgSanitizerRuntime } from './sanitize.js';

const serverWindow = new JSDOM('').window;
const runtime: SvgSanitizerRuntime = {
  DOMParser: serverWindow.DOMParser,
  purifier: configureSvgPurifier(createDOMPurify(serverWindow as unknown as WindowLike) as DOMPurify)
};

export const prepareSvgMarkup: (markup: string, options?: PrepareSvgOptions) => string = createPrepareSvgMarkup(() => runtime);
export type { PrepareSvgOptions } from './sanitize.js';
