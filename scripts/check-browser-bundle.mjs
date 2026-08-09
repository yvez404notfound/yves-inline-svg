import { builtinModules } from 'node:module';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

const gzipBudgetBytes = 18 * 1024;
const outputDir = new URL('../.bundle-size/', import.meta.url);
const outputFile = new URL('inline-svg.browser.min.js', outputDir);
const metafile = new URL('inline-svg.browser.meta.json', outputDir);
const forbiddenLocalInputs = [/sanitize\.node\.[jt]s$/];
const forbiddenPackages = [
  'sanitize-html',
  'htmlparser2',
  'postcss',
  'jsdom',
  'parse5',
  'whatwg-url',
  'entities',
  'domhandler',
  'domutils',
  'dom-serializer',
  'cssstyle',
  'data-urls',
  'tough-cookie',
  'w3c-xmlserializer',
  'whatwg-encoding'
];

await rm(outputDir, { force: true, recursive: true });
await mkdir(outputDir, { recursive: true });

const result = await build({
  bundle: true,
  conditions: ['browser'],
  entryPoints: ['dist/index.js'],
  external: ['react', 'react/jsx-runtime'],
  format: 'esm',
  logLevel: 'silent',
  metafile: true,
  minify: true,
  outfile: outputFile.pathname,
  platform: 'browser',
  target: 'es2020'
});

await writeFile(metafile, JSON.stringify(result.metafile, null, 2));

const bundled = await readFile(outputFile);
const gzipBytes = gzipSync(bundled, { level: 9 }).byteLength;
const forbiddenInputs = Object.keys(result.metafile.inputs).filter(
  (input) =>
    forbiddenLocalInputs.some((pattern) => pattern.test(input.replaceAll('\\', '/'))) ||
    forbiddenPackages.some((packageName) => includesNodeModule(input, packageName))
);
const builtinNames = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const builtinImports = Object.values(result.metafile.outputs)
  .flatMap((output) => output.imports)
  .filter((outputImport) => builtinNames.has(outputImport.path) || builtinNames.has(outputImport.path.replace(/^node:/, '')));

console.log(`browser bundle: ${bundled.byteLength} B minified, ${gzipBytes} B gzip`);
console.log(`metafile: ${metafile.pathname}`);
console.log(`bundle: ${outputFile.pathname}`);
console.log(
  'equivalent command: esbuild dist/index.js --bundle --minify --format=esm --platform=browser --target=es2020 --external:react --external:react/jsx-runtime --conditions=browser'
);

if (forbiddenInputs.length > 0) {
  throw new Error(`Browser bundle includes server/heavy sanitizer packages:\n${forbiddenInputs.join('\n')}`);
}

if (builtinImports.length > 0) {
  throw new Error(
    `Browser bundle references Node built-ins:\n${builtinImports.map((outputImport) => outputImport.path).join('\n')}`
  );
}

if (gzipBytes > gzipBudgetBytes) {
  throw new Error(`Browser bundle gzip size ${gzipBytes} B exceeds budget ${gzipBudgetBytes} B.`);
}

function includesNodeModule(input, packageName) {
  const normalized = input.replaceAll('\\', '/');
  return (
    normalized === `node_modules/${packageName}` ||
    normalized.startsWith(`node_modules/${packageName}/`) ||
    normalized.includes(`/node_modules/${packageName}/`) ||
    normalized.endsWith(`/node_modules/${packageName}`)
  );
}
