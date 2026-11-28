const puppeteer = require('puppeteer-core'); const path = require('path'); const fs = require('fs');
const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms)); const errors = [];
(async () => {
  const b = await puppeteer.launch({executablePath:'/usr/bin/google-chrome', headless:'new', args:['--no-sandbox']});
  const pg = await b.newPage(); pg.on('pageerror', e => errors.push(e.message));
  await pg.goto(url + '#settings'); await sleep(300);
  const backup = fs.readFileSync(path.resolve(__dirname, '../backup/lituk-backup-2026-11-25.json'), 'utf8');
  // import user's backup into an empty app
  await pg.$eval('#imp-text', (e, v) => e.value = v, backup);
  await pg.click('#btn-import'); await sleep(100);
  console.log('modal:', await pg.$eval('.modal p', e => e.textContent));
  await pg.click('#modal-ok'); await sleep(200);
  let p = await pg.evaluate(() => JSON.parse(localStorage.getItem('lituk.v1.progress')));
  console.log('after import: stats', Object.keys(p.s).length, 'papers', p.h.length);
  // import again: nothing duplicated
  await pg.$eval('#imp-text', (e, v) => e.value = v, backup); await pg.click('#btn-import'); await sleep(100);
  console.log('re-import modal:', await pg.$eval('.modal p', e => e.textContent)); await pg.click('#modal-ok'); await sleep(200);
  p = await pg.evaluate(() => JSON.parse(localStorage.getItem('lituk.v1.progress')));
  console.log('after re-import: stats', Object.keys(p.s).length, 'papers', p.h.length);
  // export, then import exported text into a fresh profile
  await pg.click('#btn-export'); await sleep(100);
  const ex = await pg.$eval('#exp-text', e => e.value);
  console.log('export length', ex.length, 'download button', !!(await pg.$('#btn-dl')));
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await sleep(300);
  await pg.$eval('#imp-text', (e, v) => e.value = v, ex); await pg.click('#btn-import'); await sleep(100); await pg.click('#modal-ok'); await sleep(200);
  p = await pg.evaluate(() => JSON.parse(localStorage.getItem('lituk.v1.progress')));
  console.log('round trip: stats', Object.keys(p.s).length, 'papers', p.h.length);
  await pg.goto(url + '#home'); await sleep(200);
  console.log('home tiles:', (await pg.$$eval('.tile b', e => e.map(x => x.textContent))).join(' | '));
  await pg.goto(url + '#settings'); await sleep(200);
  await pg.$eval('#imp-text', e => e.value = 'nonsense'); await pg.click('#btn-import'); await sleep(100);
  console.log('bad input:', await pg.$eval('#io-msg', e => e.textContent), '| modal open', !!(await pg.$('.modal')));
  console.log(errors.length ? 'ERRORS ' + errors.join('; ') : 'no page errors'); await b.close();
})();
