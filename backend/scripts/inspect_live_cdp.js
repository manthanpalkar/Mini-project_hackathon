const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
// Uses built-in global WebSocket in Node 22+

async function testCDP() {
  console.log('Logging in to live backend...');
  const loginRes = await fetch('https://loop-qnh9.onrender.com/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@spit.ac.in', password: 'admin123' })
  });
  const userSession = await loginRes.json();
  console.log('Logged in as:', userSession.email, 'Role:', userSession.role);

  const chromeProc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-sandbox'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  const newTab = await fetch('http://127.0.0.1:9222/json/new?https://loop-seven-delta.vercel.app/login', { method: 'PUT' }).then(r => r.json());
  const ws = new WebSocket(newTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (data) => {
        const msg = JSON.parse(data);
        if (msg.id === msgId) {
          ws.removeListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  await new Promise(r => setTimeout(r, 2000));

  // Set auth on https://loop-seven-delta.vercel.app
  const setAuthRes = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        localStorage.setItem('loop_current_user', ${JSON.stringify(JSON.stringify(userSession))});
        localStorage.setItem('loop_theme', 'dark');
        return 'AUTH_OK: ' + localStorage.getItem('loop_current_user').substring(0, 50);
      } catch (e) {
        return 'ERR: ' + e.message;
      }
    })()`,
    returnByValue: true
  });
  console.log('Auth eval:', setAuthRes?.result?.value);

  // Function to navigate and inspect story
  async function inspectStory(storyId, expectedName) {
    console.log(`\n======================================================`);
    console.log(`INSPECTING LIVE STORY: ${expectedName} (${storyId})`);
    console.log(`======================================================`);

    await send('Page.navigate', { url: `https://loop-seven-delta.vercel.app/stories/${storyId}` });

    let h1 = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const res = await send('Runtime.evaluate', {
        expression: `(() => {
          const h = document.querySelector('h1');
          return h ? h.innerText : null;
        })()`,
        returnByValue: true
      });
      if (res?.result?.value) {
        h1 = res.result.value;
        break;
      }
    }

    console.log('H1 Rendered:', h1);

    const evalDetails = await send('Runtime.evaluate', {
      expression: `(() => {
        const roleCompany = document.querySelector('header p')?.innerText;
        const cgpa = Array.from(document.querySelectorAll('header > div:last-child > div')).map(d => ({
          label: d.querySelector('p:first-child')?.innerText,
          value: d.querySelector('p:last-child')?.innerText
        }));

        const roundsCards = Array.from(document.querySelectorAll('#section-rounds .story-content-card')).map(c => {
          const title = c.querySelector('h3, h4')?.innerText;
          const badge = c.querySelector('span[style*="background-color: rgba(16, 185, 129"]')?.innerText;
          const questions = c.querySelectorAll('.story-question-item').length;
          const answers = c.querySelectorAll('.story-answer-item').length;
          return { title, badge, questions, answers };
        });

        const prepCards = Array.from(document.querySelectorAll('#section-prep .story-content-card')).map(c => {
          const title = c.querySelector('h3, h4')?.innerText;
          const resourceLinks = Array.from(c.querySelectorAll('.story-inline-link')).map(a => a.innerText);
          return { title, resourceLinks };
        });

        const resources = Array.from(document.querySelectorAll('#section-resources .story-content-card')).map(c => {
          const title = c.querySelector('h3, h4, span')?.innerText;
          const link = c.querySelector('a')?.href;
          return { title, link };
        });

        const jdLink = Array.from(document.querySelectorAll('a')).find(a => a.innerText && a.innerText.includes('.pdf'));

        return {
          roleCompany,
          cgpa,
          roundsCardsCount: roundsCards.length,
          roundsCards,
          prepCardsCount: prepCards.length,
          prepCards: prepCards.slice(0, 15),
          resourcesCount: resources.length,
          firstVerifiedPdfLink: jdLink ? { text: jdLink.innerText, href: jdLink.href } : null
        };
      })()`,
      returnByValue: true
    });

    console.log('Inspection Details:');
    console.log(JSON.stringify(evalDetails?.result?.value, null, 2));

    // Capture screenshot
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    const imgPath = path.join(__dirname, `../live_${storyId}.png`);
    fs.writeFileSync(imgPath, Buffer.from(ss.data, 'base64'));
    console.log(`Saved screenshot to: ${imgPath}`);
  }

  await inspectStory('story_2026_5136315', 'Aman Kanojia');
  await inspectStory('story_2026_74878838', 'Shivsharan Sanjawad');

  ws.close();
  chromeProc.kill();
  console.log('\nCDP Inspection Complete!');
}

testCDP().catch(err => {
  console.error('Fatal in testCDP:', err);
  process.exit(1);
});
