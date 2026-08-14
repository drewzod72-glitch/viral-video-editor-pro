const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  
  // Log ALL console messages
  page.on('console', msg => {
    console.log('CONSOLE:', msg.type(), msg.text());
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  
  await page.goto('http://localhost:5173/');
  await new Promise(r => setTimeout(r, 3000));
  
  // Enter studio
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Launch Studio'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 3000));
  
  // Upload video
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Custom Upload'));
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  
  await page.evaluate(() => {
    const zone = Array.from(document.querySelectorAll('div')).find(z => z.textContent.includes('TAP TO UPLOAD VIDEO'));
    if (zone) zone.click();
  });
  await new Promise(r => setTimeout(r, 500));
  
  const fileInput = await page.$('input[type="file"]');
  if (fileInput) {
    await fileInput.uploadFile('/tmp/test-video.mp4');
    await new Promise(r => setTimeout(r, 2000));
  }
  
  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.type('Viral edit');
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Submit
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('FORGE FINAL VIDEO'));
    if (btn) btn.click();
  });
  
  await new Promise(r => setTimeout(r, 20000));
  
  // Click BAKE PRO
  console.log('=== CLICKING BAKE PRO ===');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('BAKE PRO'));
    if (btn) btn.click();
  });
  
  // Listen for 15 seconds
  await new Promise(r => setTimeout(r, 15000));
  
  console.log('=== TEST ENDED ===');
  
  await browser.close();
})();
