const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
  
  await page.goto('http://localhost:5174/');
  await page.waitForTimeout(5000);
  
  const html = await page.innerHTML('#root');
  console.log('ROOT HTML LENGTH:', html.length);
  console.log('ROOT HTML PREVIEW:', html.substring(0, 300));
  console.log('ERRORS:', errors);
  
  await browser.close();
})();
