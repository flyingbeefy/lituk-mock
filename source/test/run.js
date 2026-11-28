const puppeteer = require('puppeteer-core');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '../dist/index.html');
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({executablePath:'/usr/bin/google-chrome', headless:'new', args:['--no-sandbox','--disable-gpu']});
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.setViewport({width:390, height:844, deviceScaleFactor:2});
  await page.goto(url); await sleep(300);
  const click = async sel => { await page.waitForSelector(sel, {timeout:3000}); await page.click(sel); await sleep(60); };
  const txt = sel => page.$eval(sel, e => e.textContent);
  console.log('home tiles:', (await page.$$eval('.tile b', els => els.map(e => e.textContent))).join(' | '));
  await page.screenshot({path:'home-mobile.png', fullPage:true});

  // 1. mock exam, results at end: answer every question with the first displayed option
  await click('#start-mock');
  console.log('test header:', (await txt('.where')).trim(), '| timer', await txt('#timer'));
  let types = {};
  for (let i = 0; i < 24; i++) {
    const info = await page.evaluate(() => ({n: document.querySelectorAll('#opts input').length, type: document.querySelector('#opts input').type, hint: !!document.getElementById('hint')}));
    types[info.type + info.n] = (types[info.type + info.n] || 0) + 1;
    await page.click('#opt-0');
    if (info.type === 'checkbox') { await page.click('#opt-1'); await page.click('#opt-2'); } // third click must be refused
    const checked = await page.$$eval('#opts input:checked', e => e.length);
    if (info.type === 'checkbox' && checked !== 2) errors.push('choose-two allowed ' + checked);
    if (i === 3) await click('#btn-flag');
    if (i === 5) await page.screenshot({path:'test-mobile.png', fullPage:true});
    if (i < 23) await click('#btn-next');
  }
  console.log('question shapes in mock:', JSON.stringify(types));
  await click('#btn-finish');
  console.log('finish modal:', await txt('.modal p'));
  await click('#modal-ok');
  console.log('result:', (await txt('.big')).trim(), '|', (await txt('.stamp')).trim(), '|', (await txt('.meta')).trim());
  await page.screenshot({path:'result-mobile.png', fullPage:false});
  console.log('review items (wrong filter):', await page.$$eval('.rev', e => e.length));
  await click('#flt-all');
  console.log('review items (all):', await page.$$eval('.rev', e => e.length));
  // consistency: score equals number of .rev.ok
  const okc = await page.$$eval('.rev.ok', e => e.length);
  console.log('ok items', okc);
  await click('#btn-home'); await sleep(100);
  console.log('home tiles after mock:', (await page.$$eval('.tile b', els => els.map(e => e.textContent))).join(' | '));

  // 2. weak-spot practice with instant feedback: answer correctly using internal knowledge of correct marks
  await click('#start-weak');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('lituk.v1.session')));
  console.log('weak session: fb', stored.fb, 'n', stored.q.length, 'limit', stored.limit);
  for (let i = 0; i < 24; i++) {
    const type = await page.$eval('#opts input', e => e.type);
    await page.click('#opt-0'); if (type === 'checkbox') await page.click('#opt-1');
    await click('#btn-check');
    const verdict = await txt('.verdict');
    if (i === 0) { console.log('instant verdict:', verdict, '| exp:', (await txt('.exp')).slice(0, 120)); await page.screenshot({path:'instant-mobile.png', fullPage:true}); }
    if (i < 23) await click('#btn-next');
  }
  await click('#btn-finish2'); await click('#modal-ok');
  console.log('weak result:', (await txt('.big')).trim(), (await txt('.stamp')).trim());
  await click('#btn-home'); await sleep(100);
  console.log('home tiles after weak:', (await page.$$eval('.tile b', els => els.map(e => e.textContent))).join(' | '));
  const prog = await page.evaluate(() => JSON.parse(localStorage.getItem('lituk.v1.progress')));
  console.log('stats entries', Object.keys(prog.s).length, 'history', prog.h.map(h => h.k + ':' + h.sc + '/' + h.n).join(','));

  // 3. chapter practice (ch1 has 18), quit midway in instant mode
  await click('#start-ch-1');
  console.log('ch1:', (await txt('.where')).trim(), '| timer present', !!(await page.$('#timer')));
  await page.click('#opt-0'); await click('#btn-check'); await click('#btn-quit'); await click('#modal-ok'); await sleep(100);
  // 4. resume banner + reload persistence
  await click('#start-mock'); await page.click('#opt-0'); await click('#btn-next');
  await page.reload(); await sleep(300);
  console.log('resume banner:', await txt('.banner h2'), '|', await txt('.banner p'));
  await click('#btn-resume');
  console.log('resumed at:', (await txt('.where')).trim());
  // timer expiry: rewind t0
  await page.evaluate(() => { const z = JSON.parse(localStorage.getItem('lituk.v1.session')); z.t0 -= 46 * 60 * 1000; localStorage.setItem('lituk.v1.session', JSON.stringify(z)); });
  await page.reload(); await sleep(300); await click('#btn-resume'); await sleep(700);
  console.log('after timeout:', (await txt('.big')).trim(), '|', (await txt('.meta')).trim());
  await click('#btn-home'); await sleep(100);
  // 5. weak list, history, settings
  await page.goto(url + '#weak'); await sleep(200);
  console.log('weak list items:', await page.$$eval('.rev', e => e.length), '| chips:', (await page.$$eval('.chip', e => e.map(x => x.textContent))).join(' '));
  await page.screenshot({path:'weak-mobile.png'});
  await page.goto(url + '#history'); await sleep(200);
  console.log('history rows:', await page.$$eval('.hrow', e => e.length));
  await page.click('.hrow button'); await sleep(100);
  console.log('opened result:', (await txt('.mast h1')).trim(), (await txt('.big')).trim());
  await page.goto(url + '#settings'); await sleep(200);
  await click('#set-lang-en'); await sleep(100);
  console.log('settings (en):', (await txt('.card h2')).trim(), '| sync:', (await txt('#sync')).trim());
  await click('#set-theme-dark'); await click('#set-zh-0');
  await page.goto(url + '#home'); await sleep(200);
  await page.screenshot({path:'home-dark-en.png', fullPage:true});
  await page.setViewport({width:1280, height:900, deviceScaleFactor:1});
  await click('#start-ch-3'); await page.click('#opt-0'); await click('#btn-check');
  console.log('zh hidden in explanation:', (await page.$('.exp .zh')) === null);
  await page.screenshot({path:'test-desktop-dark.png'});
  await click('#btn-quit'); await click('#modal-ok'); await sleep(100);
  await page.goto(url + '#settings'); await sleep(200);
  await click('#btn-reset'); await click('#modal-ok'); await sleep(100);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('lituk.v1.progress')));
  console.log('after reset: stats', Object.keys(after.s).length, 'history', after.h.length, 'r>0', after.r > 0);
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
})().catch(e => { console.error('TEST FAILED', e); process.exit(1); });
