const { chromium } = require('playwright');
const fs = require('fs');
const shots = [
  ['raw-1.png', 'Pop. Repeat.<br>Feel better.', '01-pop-repeat.png'],
  ['raw-2.png', 'Swipe a whole<br>row at once.', '02-swipe.png'],
  ['raw-3.png', 'Every<br>last one.', '03-cleared.png'],
  ['raw-4.png', 'Count<br>every pop.', '04-stats.png'],
];
const font = fs.readFileSync(require.resolve('@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf', { paths: ['/home/user/wildchild-apps'] })).toString('base64');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1320, height: 2868 }, deviceScaleFactor: 1 });
  for (const [src, title, out] of shots) {
    const img = fs.readFileSync(src).toString('base64');
    await p.setContent(`<!doctype html><html><head><style>
      @font-face{font-family:N;src:url(data:font/ttf;base64,${font})}
      html,body{margin:0;width:1320px;height:2868px;background:#5B4BE0;overflow:hidden}
      h1{position:absolute;left:0;right:0;top:150px;margin:0;text-align:center;font-family:N;font-size:124px;line-height:1.05;letter-spacing:-3px;color:#fff}
      .phone{position:absolute;left:132px;top:520px;width:1056px;height:2222px;border-radius:72px;overflow:hidden;
        box-shadow:0 40px 90px rgba(10,5,40,.45),0 0 0 14px rgba(255,255,255,.18);background:#5B4BE0}
      .phone img{display:block;width:1056px;height:auto;margin-top:96px}
    </style></head><body><h1>${title}</h1><div class="phone"><img src="data:image/png;base64,${img}"></div></body></html>`);
    await p.waitForTimeout(200);
    await p.screenshot({ path: out });
  }
  await b.close();
})();
