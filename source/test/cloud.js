const puppeteer = require('puppeteer-core');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errors = [];
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome', headless:'new', args:['--no-sandbox','--disable-gpu']});
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  // fake capability layer: the "cloud" document lives in localStorage under __cloud
  await page.evaluateOnNewDocument(() => {
    const log = []; window.__log = log;
    const doc = path => ({
      async get(){ log.push('get ' + path); const v = localStorage.getItem('__cloud'); return {exists: !!v, data: () => v ? JSON.parse(v) : undefined}; },
      async set(d){ log.push('set ' + path); if (window.__failSet) { const e = new Error('no'); e.code = 'not_granted'; throw e; } localStorage.setItem('__cloud', JSON.stringify(d)); }
    });
    window.claude = {use: name => new Promise(res => setTimeout(() => res(name === 'db' ? Object.freeze({doc}) : name === 'user' ? Object.freeze({id: async () => 'u_test'}) : null), 50))};
  });
  const click = async sel => { await page.waitForSelector(sel, {timeout:3000}); await page.click(sel); await sleep(60); };
  const tiles = async () => (await page.$$eval('.tile b', els => els.map(e => e.textContent))).join(' | ');
  const cloudDoc = () => page.evaluate(() => JSON.parse(localStorage.getItem('__cloud') || 'null'));
  const doPaper = async (n, check) => { for (let i = 0; i < n; i++) { const type = await page.$eval('#opts input', e => e.type); await page.click('#opt-0'); if (type === 'checkbox') await page.click('#opt-1'); if (check) await click('#btn-check'); if (i < n - 1) await click('#btn-next'); } await click(check ? '#btn-finish2' : '#btn-finish'); await click('#modal-ok'); };

  await page.goto(url); await sleep(500);
  console.log('a. first load sync:', (await page.$eval('#sync', e => e.textContent)).trim(), '| log', await page.evaluate(() => window.__log.join(', ')));
  await click('#start-mock'); await doPaper(24, false); await sleep(1200);
  let c = await cloudDoc();
  console.log('b. after mock: cloud history', c.h.length, 'stats', Object.keys(c.s).length, '| log', await page.evaluate(() => window.__log.join(', ')));
  // instant paper: no cloud writes during the paper, one at the end
  await click('#btn-home'); await sleep(100); await page.evaluate(() => { window.__log.length = 0; });
  await click('#start-weak'); await doPaper(24, true); await sleep(1200);
  console.log('c. instant paper log:', await page.evaluate(() => window.__log.join(', ')));
  c = await cloudDoc(); console.log('   cloud history', c.h.length, 'stats', Object.keys(c.s).length);
  // new device: wipe local progress, keep cloud
  await page.evaluate(() => { localStorage.removeItem('lituk.v1.progress'); });
  await page.goto(url + '#home'); await page.reload(); await sleep(600);
  console.log('d. new device restored tiles:', await tiles(), '| sync:', (await page.$eval('#sync', e => e.textContent)).trim());
  // two devices: device B has an extra result the cloud lacks, cloud has results B lacks
  await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('lituk.v1.progress')); p.h = [{t: 5, k: 'm', c: 0, f: 'e', sc: 20, n: 24, d: 100, to: 0}]; p.s = {zzzzzzz: [1, 0, 1, 20000]}; localStorage.setItem('lituk.v1.progress', JSON.stringify(p)); });
  await page.reload(); await sleep(1200);
  c = await cloudDoc();
  console.log('e. merged cloud history', c.h.map(h => h.k + h.sc).join(','), '| has local-only stat', !!c.s.zzzzzzz, 'stats', Object.keys(c.s).length);
  // reset propagates; a stale device with old local data must not resurrect it
  const stale = await page.evaluate(() => localStorage.getItem('lituk.v1.progress'));
  await page.goto(url + '#settings'); await sleep(400); await click('#btn-reset'); await click('#modal-ok'); await sleep(1000);
  c = await cloudDoc(); console.log('f. after reset cloud: history', c.h.length, 'stats', Object.keys(c.s).length, 'r>0', c.r > 0);
  await page.evaluate(v => localStorage.setItem('lituk.v1.progress', v), stale);
  await page.goto(url + '#home'); await page.reload(); await sleep(1000);
  console.log('g. stale device after reset tiles:', await tiles());
  // write refused (view-only viewer): falls back to local, no crash
  await page.evaluate(() => { window.__failSet = true; });
  await click('#start-ch-2'); await doPaper(24, true); await sleep(1200);
  console.log('h. refused write: sync text =', await page.evaluate(() => { location.hash = 'settings'; return new Promise(r => setTimeout(() => r(document.getElementById('sync').textContent.trim()), 200)); }));
  const local = await page.evaluate(() => JSON.parse(localStorage.getItem('lituk.v1.progress')));
  console.log('   local still has result:', local.h.length);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
