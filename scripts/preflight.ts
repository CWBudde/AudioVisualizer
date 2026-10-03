import {bundle} from '@remotion/bundler';
import {ensureBrowser, openBrowser, selectComposition, renderStill} from '@remotion/renderer';
import {mkdir} from 'node:fs/promises';

await mkdir('out', {recursive: true});
await ensureBrowser();
const chromiumOptions = {gl: 'angle'} as const;
const browser = await openBrowser('chrome', {logLevel: 'verbose', chromiumOptions});
try {
  const serveUrl = await bundle({entryPoint: 'src/preflight.tsx'});
  const composition = await selectComposition({serveUrl, id: 'Preflight', puppeteerInstance: browser, chromiumOptions});
  await renderStill({serveUrl, composition, frame: 15, output: 'out/preflight.png', puppeteerInstance: browser, chromiumOptions});
  console.log('Browser, WebGL2 and Remotion frame capture passed.');
} finally { await browser.close({silent: true}); }
