const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const currentId = this.id++;
      this.callbacks.set(currentId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: currentId, method, params }));
    });
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function run() {
  console.log('--- Starting Chrome Headless Remote Session ---');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--user-data-dir=/tmp/chrome_loop_verify_' + Date.now(),
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--window-size=1280,900'
  ]);

  chromeProc.stderr.on('data', () => {}); // silence stderr

  await sleep(2000);

  let versionInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    versionInfo = await res.json();
    console.log('Connected to Chrome:', versionInfo.Browser);
  } catch (e) {
    console.error('Failed to connect to Chrome debugging port:', e);
    chromeProc.kill();
    process.exit(1);
  }

  // Create new target tab
  const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?https://loop-seven-delta.vercel.app/login`, { method: 'PUT' });
  const tabInfo = await newTabRes.json();
  const cdp = new CDPClient(tabInfo.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');

  console.log('CDP connection established. Setting auth session in localStorage...');

  // Generate valid signed JWT
  const token = jwt.sign(
    { email: 'admin@spit.ac.in', isAdmin: true },
    process.env.JWT_SECRET,
    { expiresIn: '2h' }
  );
  const userSession = {
    token,
    email: 'admin@spit.ac.in',
    isAdmin: true,
    onboarded: true,
    name: 'Administrator'
  };

  await sleep(1500);

  // Set auth in localStorage
  await cdp.send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('loop_current_user', JSON.stringify(${JSON.stringify(userSession)}));
      localStorage.setItem('loop_theme', 'dark');
      console.log('Auth set successfully');
    `
  });

  console.log('\n======================================================');
  console.log('TEST 1: Inspecting Aman Kanojia (Nomura: story_2026_5136315)');
  console.log('======================================================');

  await cdp.send('Page.navigate', { url: 'https://loop-seven-delta.vercel.app/stories/story_2026_5136315' });
  await sleep(3500);

  const amanEvaluation = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const name = document.querySelector('h1')?.innerText;
      const roleCompany = document.querySelector('header p')?.innerText;
      
      // Header details (CGPA, package, stipend)
      const headerDivs = Array.from(document.querySelectorAll('header > div:last-child > div')).map(d => ({
        label: d.querySelector('p:first-child')?.innerText,
        value: d.querySelector('p:last-child')?.innerText
      }));

      // Section checks
      const sections = Array.from(document.querySelectorAll('main > section')).map(s => ({
        id: s.id,
        title: s.querySelector('h2')?.innerText,
        layoutClass: s.querySelector('.story-content-layout') ? 'story-content-layout' : 'none',
        cardCount: s.querySelectorAll('.story-content-card').length,
        computedDisplay: window.getComputedStyle(s).display
      }));

      // Check preparation topics layout
      const prepSection = document.getElementById('section-prep');
      const prepCards = prepSection ? Array.from(prepSection.querySelectorAll('.story-content-card')).map(c => ({
        title: c.querySelector('h3')?.innerText,
        hasOl: !!c.querySelector('ol'),
        hasUl: !!c.querySelector('ul'),
        paragraphCount: c.querySelectorAll('p').length,
        resourceLinksCount: c.querySelectorAll('.story-inline-link').length
      })) : [];

      // Check compensation section
      const compSection = document.getElementById('section-compensation');
      const compText = compSection?.innerText;

      // Check interview rounds section
      const roundsSection = document.getElementById('section-rounds');
      const roundCards = roundsSection ? Array.from(roundsSection.querySelectorAll('.story-content-card')).map(c => ({
        title: c.querySelector('h3')?.innerText,
        stageNumber: c.querySelector('span')?.innerText,
        hasFormattedText: !!c.querySelector('.story-ordered-list') || !!c.querySelector('p')
      })) : [];

      // Check resources section
      const resSection = document.getElementById('section-resources');
      const resourceCards = resSection ? Array.from(resSection.querySelectorAll('.story-content-card')).map(c => ({
        name: c.querySelector('h4')?.innerText,
        type: c.querySelector('span')?.innerText,
        linkText: c.querySelector('a')?.innerText,
        href: c.querySelector('a')?.href,
        target: c.querySelector('a')?.target
      })) : [];

      // Check grid styles (ensure no repeat(auto-fit) exists in main content)
      const cardContainers = Array.from(document.querySelectorAll('.story-content-layout')).map(el => ({
        display: window.getComputedStyle(el).display,
        flexDirection: window.getComputedStyle(el).flexDirection,
        width: window.getComputedStyle(el).width
      }));

      return {
        name,
        roleCompany,
        headerDivs,
        sections,
        compText,
        prepCards,
        roundCards,
        resourceCards,
        cardContainers
      };
    })()`,
    returnByValue: true
  });

  const aman = amanEvaluation.result.value;
  console.log('Candidate Name:', aman.name);
  console.log('Role & Company:', aman.roleCompany);
  console.log('Header fields:', aman.headerDivs);
  console.log('Major Sections Rendered:', aman.sections.map(s => `${s.id} (${s.cardCount} cards)`));
  console.log('Preparation Topics (Vertical cards):', aman.prepCards.length);
  aman.prepCards.forEach(p => console.log('  -', p.title, `[paragraphs: ${p.paragraphCount}, resources: ${p.resourceLinksCount}]`));
  console.log('Placement Journey Stages:', aman.roundCards.length);
  aman.roundCards.forEach(r => console.log('  -', r.title));
  console.log('Resources Rendered (Single-column vertical stack):', aman.resourceCards.length);
  aman.resourceCards.slice(0, 4).forEach(r => console.log('  -', r.name, '->', r.href));
  console.log('Container Computed Layouts:', aman.cardContainers);

  // Take Desktop Screenshot
  const ssDesktop = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '../target_aman_kanojia_desktop.png'), Buffer.from(ssDesktop.data, 'base64'));
  console.log('Saved desktop screenshot to backend/target_aman_kanojia_desktop.png');

  // Switch to Mobile Viewport (iPhone 14: 390x844)
  console.log('\n--- Switching to Mobile Viewport (390x844) ---');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
    mobile: true
  });
  await sleep(1500);

  const amanMobileEval = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const containers = Array.from(document.querySelectorAll('.story-content-layout')).map(el => ({
        display: window.getComputedStyle(el).display,
        flexDirection: window.getComputedStyle(el).flexDirection,
        width: window.getComputedStyle(el).width
      }));
      return { containers };
    })()`,
    returnByValue: true
  });
  console.log('Mobile Layout Containers:', amanMobileEval.result.value.containers);

  const ssMobile = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '../target_aman_kanojia_mobile.png'), Buffer.from(ssMobile.data, 'base64'));
  console.log('Saved mobile screenshot to backend/target_aman_kanojia_mobile.png');

  // Reset viewport
  await cdp.send('Emulation.clearDeviceMetricsOverride');

  console.log('\n======================================================');
  console.log('TEST 2: Inspecting Shivsharan Sanjawad (UBS: story_2026_74878838)');
  console.log('======================================================');

  await cdp.send('Page.navigate', { url: 'https://loop-seven-delta.vercel.app/stories/story_2026_74878838' });
  await sleep(3500);

  const shivEvaluation = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const name = document.querySelector('h1')?.innerText;
      const roleCompany = document.querySelector('header p')?.innerText;
      
      const headerDivs = Array.from(document.querySelectorAll('header > div:last-child > div')).map(d => ({
        label: d.querySelector('p:first-child')?.innerText,
        value: d.querySelector('p:last-child')?.innerText
      }));

      const sections = Array.from(document.querySelectorAll('main > section')).map(s => ({
        id: s.id,
        title: s.querySelector('h2')?.innerText,
        cardCount: s.querySelectorAll('.story-content-card').length
      }));

      // Study materials
      const matSection = document.getElementById('section-materials');
      const materials = matSection ? Array.from(matSection.querySelectorAll('.story-content-card')).map(c => ({
        title: c.querySelector('h4')?.innerText,
        category: c.querySelector('span')?.innerText,
        buttonText: c.querySelector('a, button')?.innerText,
        href: c.querySelector('a')?.href
      })) : [];

      // Test resource links
      const resSection = document.getElementById('section-resources');
      const resources = resSection ? Array.from(resSection.querySelectorAll('.story-content-card')).map(c => ({
        name: c.querySelector('h4')?.innerText,
        href: c.querySelector('a')?.href,
        target: c.querySelector('a')?.target
      })) : [];

      return {
        name,
        roleCompany,
        headerDivs,
        sections,
        materials,
        resources
      };
    })()`,
    returnByValue: true
  });

  const shiv = shivEvaluation.result.value;
  console.log('Candidate Name:', shiv.name);
  console.log('Role & Company:', shiv.roleCompany);
  console.log('Header fields (CGPA & Compensation):', shiv.headerDivs);
  console.log('Major Sections:', shiv.sections.map(s => `${s.id} (${s.cardCount} cards)`));
  console.log('Study Materials Rendered:', shiv.materials);
  console.log('Resources Rendered:', shiv.resources);

  const ssShiv = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '../target_shivsharan_desktop.png'), Buffer.from(ssShiv.data, 'base64'));
  console.log('Saved desktop screenshot to backend/target_shivsharan_desktop.png');

  console.log('\n======================================================');
  console.log('TEST 3: Admin Edit Modal Workflow & Field Preservation');
  console.log('======================================================');

  // Click "Edit Story" button
  await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Edit Story'));
      if (editBtn) editBtn.click();
    })()`
  });
  await sleep(1500);

  const editModalEval = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const modal = document.querySelector('.glass-panel.animate-fade-in');
      if (!modal) return { isOpen: false };
      
      const inputs = Array.from(modal.querySelectorAll('input')).map(i => ({ name: i.name || i.placeholder, value: i.value }));
      const textareas = Array.from(modal.querySelectorAll('textarea')).map(t => ({ name: t.name || t.placeholder, length: t.value.length }));
      
      return {
        isOpen: true,
        inputs: inputs.slice(0, 10),
        textareas
      };
    })()`,
    returnByValue: true
  });

  console.log('Edit Modal Open:', editModalEval.result.value.isOpen);
  console.log('Inputs in Edit Modal:', editModalEval.result.value.inputs);
  console.log('Textareas in Edit Modal:', editModalEval.result.value.textareas);

  const ssModal = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, '../target_edit_story_modal.png'), Buffer.from(ssModal.data, 'base64'));
  console.log('Saved modal screenshot to backend/target_edit_story_modal.png');

  cdp.close();
  chromeProc.kill();
  console.log('\n=== ALL LIVE PRODUCTION VERIFICATIONS COMPLETE ===');
}

run().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
