import {mkdir, writeFile} from 'node:fs/promises';
import {validateCommon} from './validate/common';
import {validateV1} from './validate/v1';
import {validateV2} from './validate/v2';
import {pathsFor, versionFromEnv} from './version';

const v = versionFromEnv();
const {a, report} = await validateCommon();
const specific = {v1: validateV1, v2: validateV2}[v](a);
await mkdir(pathsFor(v).analysis, {recursive: true});
await writeFile(`${pathsFor(v).analysis}/visual-validation.json`, JSON.stringify({version: v, ...report, ...specific}, null, 2) + '\n');
console.log(`${v}: source/schema/export, pauses and ${Object.keys(specific).join(', ')} passed. ${report.eventsChecked} drum events within ${report.maximumDrumEventDelayMS.toFixed(2)} ms, ${report.notesChecked} notes within ${report.maximumNoteDelayMS.toFixed(2)} ms.`);
