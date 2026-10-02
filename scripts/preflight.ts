import {bundle} from '@remotion/bundler';
import {openBrowser, selectComposition, renderStill} from '@remotion/renderer';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';

await mkdir('out', {recursive: true});
const browser = await openBrowser('chrome', {logLevel: 'verbose', browserExecutable: resolve('.cache/browser/chrome-headless-shell-linux64/chrome-headless-shell')});
try {
  const serveUrl = await bundle({entryPoint: 'src/preflight.tsx'});
  const composition = await selectComposition({serveUrl, id: 'Preflight', puppeteerInstance: browser});
  await renderStill({serveUrl, composition, output: 'out/preflight.png', puppeteerInstance: browser});
  console.log('Browser and Remotion frame capture passed.');
} finally { await browser.close({silent: true}); }
