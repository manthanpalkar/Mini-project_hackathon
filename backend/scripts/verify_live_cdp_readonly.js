const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function verifyLiveFrontend() {
  console.log('Logging in to live Render backend to get JWT...');
  const loginRes = await fetch('https://loop-qnh9.onrender.com/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@spit.ac.in', password: 'admin123' })
  });
  const userSession = await loginRes.json();
  console.log('Auth OK for:', userSession.email);

  const chromeProc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const newTab = await fetch('http://127.0.0.1:9222/json/new?https://loop-seven-delta.vercel.app/login', { method: 'PUT' }).then(r => r.json());
  const ws = new WebSocket(newTab.webSocketDebuggerUrl);
  await new Promise(r => {
    ws.addEventListener('open', r, { once: true });
  });

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 2000));

  // Set auth
  await send('Runtime.evaluate', {
    expression: `(() => {
      localStorage.setItem('loop_current_user', ${JSON.stringify(JSON.stringify(userSession))});
      localStorage.setItem('loop_theme', 'dark');
      return 'OK';
    })()`,
    returnByValue: true
  });

  // 1. Inspect Krishika Jalali Detail Page
  console.log('\n--- Navigating to Krishika Jalali Detail Page ---');
  await send('Page.navigate', { url: 'https://loop-seven-delta.vercel.app/stories/story_2027_0340510c' });
  await new Promise(r => setTimeout(r, 3500));

  const krishikaDom = await send('Runtime.evaluate', {
    expression: `(() => {
      const h1 = document.querySelector('h1')?.innerText;
      const badges = Array.from(document.querySelectorAll('span')).map(s => s.innerText.trim()).filter(Boolean);
      const isCSE = badges.includes('CSE');
      const isCE = badges.includes('CE');
      const packageBadge = badges.find(b => b.includes('18.10 LPA') || b.includes('18.1'));
      const stipendBadge = badges.find(b => b.includes('40k'));
      const companyHeader = document.querySelector('header')?.innerText;
      const rounds = Array.from(document.querySelectorAll('.story-content-card h3, .story-content-card h4')).map(h => h.innerText);
      return {
        h1,
        isCSE,
        isCE,
        packageBadge,
        stipendBadge,
        badgesSample: badges.slice(0, 10),
        roundsSample: rounds.slice(0, 5),
        companyHeaderSnippet: companyHeader ? companyHeader.substring(0, 150) : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Krishika Live Detail DOM:', JSON.stringify(krishikaDom?.result?.value, null, 2));

  // Save screenshot
  const ss1 = await send('Page.captureScreenshot', { format: 'png' });
  const ssPath1 = '/Users/swapnil/.gemini/antigravity/brain/2aa0a3f3-e6fa-4d47-82e1-1109724f7a72/final_live_krishika_jalali.png';
  fs.writeFileSync(ssPath1, Buffer.from(ss1.data, 'base64'));
  console.log('Saved Krishika screenshot to:', ssPath1);

  // 2. Inspect Stories List / Card
  console.log('\n--- Navigating to Home / Stories List ---');
  await send('Page.navigate', { url: 'https://loop-seven-delta.vercel.app/' });
  await new Promise(r => setTimeout(r, 3500));

  const listDom = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.story-card, div[class*=\"story\"], div[class*=\"card\"]')).map(c => {
        const text = c.innerText;
        return {
          textSnippet: text.substring(0, 100).replace(/\\n/g, ' ')
        };
      });
      const krishikaCard = Array.from(document.querySelectorAll('*')).find(el => el.innerText && el.innerText.includes('Krishika Jalali') && el.innerText.includes('IDFC FIRST Bank'));
      return {
        cardsCount: cards.length,
        hasKrishikaCard: !!krishikaCard,
        krishikaCardText: krishikaCard ? krishikaCard.innerText.substring(0, 200).replace(/\\n/g, ' ') : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Stories List DOM:', JSON.stringify(listDom?.result?.value, null, 2));

  const ss2 = await send('Page.captureScreenshot', { format: 'png' });
  const ssPath2 = '/Users/swapnil/.gemini/antigravity/brain/2aa0a3f3-e6fa-4d47-82e1-1109724f7a72/final_live_stories_list.png';
  fs.writeFileSync(ssPath2, Buffer.from(ss2.data, 'base64'));
  console.log('Saved list screenshot to:', ssPath2);

  chromeProc.kill();
  process.exit(0);
}

verifyLiveFrontend().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
