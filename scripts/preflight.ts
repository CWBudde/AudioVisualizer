import {bundle} from '@remotion/bundler';
import {ensureBrowser, openBrowser, selectComposition, renderStill} from '@remotion/renderer';
import {mkdir} from 'node:fs/promises';
import {meanLuma} from './luma';

await mkdir('out', {recursive: true});
await ensureBrowser();
const chromiumOptions = {gl: 'angle'} as const;
const browser = await openBrowser('chrome', {logLevel: 'verbose', chromiumOptions});
try {
  const serveUrl = await bundle({entryPoint: 'src/preflight.tsx'});
  // Raw WebGL2 (v1/v2), then React Three Fiber with a half-float multisampled target (v3).
  for (const [id, output] of [['Preflight', 'out/preflight.png'], ['PreflightThree', 'out/preflight-three.png']]) {
    const composition = await selectComposition({serveUrl, id, puppeteerInstance: browser, chromiumOptions});
    await renderStill({serveUrl, composition, frame: 15, output, puppeteerInstance: browser, chromiumOptions});
    const luma = meanLuma(output);
    if (luma < 2) throw new Error(`${id} captured a blank frame (YAVG ${luma.toFixed(2)})`);
    console.log(`${id}: frame captured, YAVG ${luma.toFixed(2)}`);
  }
  console.log('Browser, WebGL2, R3F half-float targets and Remotion frame capture passed.');
} finally { await browser.close({silent: true}); }
