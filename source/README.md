# Source

- `bank/q_*.txt` – question bank. One per line: `type|chapter|question|options (correct first) " // "|EN explanation|ZH explanation`
- `src/app.html` – app template (bank is embedded at build time)
- `build.py` – validates bank, writes `dist/index.html`
- `test/*.js` – puppeteer tests

Build and deploy: `cd source && python3 build.py && cp dist/index.html ../index.html`, then commit and push.
User data lives in localStorage (`lituk.v1.progress`, `lituk.v1.settings`, `lituk.v1.session`); do not change its format.
