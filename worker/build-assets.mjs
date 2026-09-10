import {mkdir, copyFile, cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

// 只打包網站檔案，避免把原始碼、設定與測試發布為靜態資產。
const root = fileURLToPath(new URL('../', import.meta.url));
const target = join(root, 'worker/public/admin');
await mkdir(target, {recursive:true});
for (const name of ['index.html','app.js','editor.js','companion-core.js','companion.js','companion.css','sync.js','manifest.webmanifest','version.json']) {
  await copyFile(join(root,name), join(target,name));
}
for (const name of ['assets','data']) await cp(join(root,name), join(target,name), {recursive:true});
