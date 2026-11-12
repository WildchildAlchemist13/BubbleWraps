const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
  const url = (qs) => 'file://' + path.resolve('icon.html') + '?' + qs;
  const shots = [
    ['icon.png', 'scale=0.9', false],                       // iOS / store icon, full bleed violet
    ['android-icon-foreground.png', 'scale=0.6&bg=0', true], // inside the 66% adaptive safe zone
    ['android-icon-monochrome.png', 'scale=0.6&bg=0&mono=1', true],
    ['splash-icon.png', 'scale=0.78&bg=0', true],
  ];
  for (const [file, qs, transparent] of shots) {
    await p.goto(url(qs));
    await p.screenshot({ path: file, omitBackground: transparent });
  }
  // solid background layer for Android adaptive icon
  await p.setContent('<html><body style="margin:0;background:#5B4BE0;width:1024px;height:1024px"></body></html>');
  await p.screenshot({ path: 'android-icon-background.png' });
  // small favicon for web
  const f = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 48 / 1024 });
  await f.goto(url('scale=0.9'));
  await f.screenshot({ path: 'favicon.png' });
  await b.close();
})();
