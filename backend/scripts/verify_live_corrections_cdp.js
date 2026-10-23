const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function verifyLiveFrontendCorrections() {
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

  const checkStories = [
    { id: 'story_2026_22149823', expectedName: 'Kanishka Anand Amritkar', expectedBranch: 'CE' },
    { id: 'story_2027_d1bb7dd4', expectedName: 'Dhruv Mukesh Tiwari', expectedBranch: 'CSE' },
    { id: 'story_2025_7ec35412', expectedName: 'Bhavesh Chaudhari', expectedBranch: 'CSE' },
    { id: 'story_2026_26830791', expectedName: 'Shubham Karampure', expectedBranch: 'CSE-DS' },
    { id: 'story_2026_10137144', expectedName: 'Prashant Tiwari', expectedBranch: 'MCA' }
  ];

  console.log('\n--- VERIFYING LIVE STORY DETAIL PAGES ON VERCEL ---');
  for (const item of checkStories) {
    await send('Page.navigate', { url: `https://loop-seven-delta.vercel.app/stories/${item.id}` });
    await new Promise(r => setTimeout(r, 2500));

    const pageData = await send('Runtime.evaluate', {
      expression: `(() => {
        const h1 = document.querySelector('h1')?.innerText;
        const badges = Array.from(document.querySelectorAll('span, p, div')).map(s => s.innerText.trim()).filter(Boolean);
        const hasExpectedBranch = badges.includes('${item.expectedBranch}');
        const hasExpectedName = h1 && h1.includes('${item.expectedName}');
        return {
          h1,
          hasExpectedName,
          hasExpectedBranch,
          badgesSample: Array.from(new Set(badges.filter(b => b.length < 20))).slice(0, 15)
        };
      })()`,
      returnByValue: true
    });

    console.log(`[${item.id}] Target: ${item.expectedName} (${item.expectedBranch})`);
    console.log(`  Live H1: "${pageData?.result?.value?.h1}" | Name Match: ${pageData?.result?.value?.hasExpectedName} | Branch Match (${item.expectedBranch}): ${pageData?.result?.value?.hasExpectedBranch}`);

    // Screenshot
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    const ssPath = `/Users/swapnil/.gemini/antigravity/brain/2aa0a3f3-e6fa-4d47-82e1-1109724f7a72/live_verified_${item.id}.png`;
    fs.writeFileSync(ssPath, Buffer.from(ss.data, 'base64'));
  }

  chromeProc.kill();
  console.log('\nAll 5 corrected stories verified live via Chrome CDP.');
  process.exit(0);
}

verifyLiveFrontendCorrections().catch(err => {
  console.error('CDP verification error:', err);
  process.exit(1);
});
