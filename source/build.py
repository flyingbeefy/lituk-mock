#!/usr/bin/env python3
"""Parse and validate the question bank, then embed it into the app template."""
import glob, hashlib, json, re, sys, collections, os

ROOT = os.path.dirname(os.path.abspath(__file__))
CJK = re.compile(r'[一-鿿]')
errors, bank, seen_q, seen_id = [], [], {}, {}

for path in sorted(glob.glob(os.path.join(ROOT, 'bank', 'q_*.txt'))):
    for ln, raw in enumerate(open(path, encoding='utf-8'), 1):
        line = raw.rstrip('\n')
        if not line.strip() or line.startswith('#'):
            continue
        where = f'{os.path.basename(path)}:{ln}'
        f = line.split('|')
        if len(f) != 6:
            errors.append(f'{where}: expected 6 fields, got {len(f)}'); continue
        typ, ch, q, opts, en, zh = [x.strip() for x in f]
        if typ not in 'smt' or len(typ) != 1:
            errors.append(f'{where}: bad type {typ!r}'); continue
        if ch not in '12345':
            errors.append(f'{where}: bad chapter {ch!r}'); continue
        if not q or not en or not zh:
            errors.append(f'{where}: empty field')
        if not CJK.search(zh):
            errors.append(f'{where}: zh explanation has no Chinese')
        if CJK.search(q) or CJK.search(en) or CJK.search(opts):
            errors.append(f'{where}: Chinese in English field')
        if typ == 't':
            if opts not in ('T', 'F'):
                errors.append(f'{where}: t needs T or F'); continue
            o = 1 if opts == 'T' else 0
        else:
            o = [x.strip() for x in opts.split(' // ')]
            if typ == 'm' and len(o) != 4:
                errors.append(f'{where}: m needs 4 options, got {len(o)}')
            if typ == 's' and len(o) not in (2, 4):
                errors.append(f'{where}: s needs 2 or 4 options, got {len(o)}')
            if len(set(x.lower() for x in o)) != len(o):
                errors.append(f'{where}: duplicate options')
            if any(not x for x in o):
                errors.append(f'{where}: empty option')
            if typ == 'm' and 'TWO' not in q:
                errors.append(f'{where}: m question should say TWO')
            if typ == 's' and 'TWO' in q:
                errors.append(f'{where}: s question mentions TWO')
        key = re.sub(r'\W+', ' ', q.lower()).strip()
        if key in seen_q:
            errors.append(f'{where}: duplicate question of {seen_q[key]}')
        seen_q[key] = where
        qid = hashlib.sha1(key.encode()).hexdigest()[:7]
        if qid in seen_id:
            errors.append(f'{where}: id collision with {seen_id[qid]}')
        seen_id[qid] = where
        bank.append([qid, typ, int(ch), q, o, en, zh])

by_ch = collections.Counter(b[2] for b in bank)
by_t = collections.Counter(b[1] for b in bank)
two = sum(1 for b in bank if b[1] == 's' and len(b[4]) == 2)
four = [b for b in bank if b[1] == 's' and len(b[4]) == 4]
longest = sum(1 for b in four if len(b[4][0]) == max(len(x) for x in b[4]) and sum(len(x) == len(b[4][0]) for x in b[4]) == 1)
print(f'total {len(bank)}  by chapter {dict(sorted(by_ch.items()))}  by type {dict(by_t)}  two-statement {two}')
print(f'correct option is the single longest in {longest}/{len(four)} four-option questions ({100*longest/len(four):.0f}%)')
if errors:
    print('\n'.join(errors)); sys.exit(1)

if '--check' in sys.argv:
    sys.exit(0)
tpl = open(os.path.join(ROOT, 'src', 'app.html'), encoding='utf-8').read()
data = json.dumps(bank, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
assert '/*__BANK__*/[]' in tpl
out = tpl.replace('/*__BANK__*/[]', data)
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
open(os.path.join(ROOT, 'dist', 'index.html'), 'w', encoding='utf-8').write(out)
print(f'wrote dist/index.html ({len(out.encode())/1024:.0f} KiB)')
