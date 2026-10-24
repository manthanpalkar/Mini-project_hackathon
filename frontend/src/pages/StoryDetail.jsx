import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, FileText, Award, Code, BookOpen, Layers, X, Edit, Trash2, Plus, 
  ExternalLink, Sparkles, CheckCircle2, Trophy, Medal, Lightbulb, Quote, Target, Cpu, 
  Users, MessageSquare, GraduationCap, 
  Rocket, Compass, Star, ArrowRight, UserCheck, Briefcase
} from 'lucide-react';
import { getStoryById, updateStory, deleteStory, addPendingStory, fileToBase64, resolveUrl, getResourceFileUrl } from '../utils/db';
import FormattedText, { renderInlineWithLinks } from '../components/FormattedText';
import { formatDisplayBranch } from '../utils/branchUtils';

export function formatCurrencyText(val) {
  if (!val) return '';
  let s = String(val).trim();
  // Sanitize misrecognized currency symbols (·, <, €, ₴) to official Indian Rupee ₹
  s = s.replace(/[₴·<€]\s*(\d)/g, '₹$1');
  s = s.replace(/\b1pa\b/gi, 'LPA');
  s = s.replace(/\bIpa\b/g, 'LPA');
  // Fix 7 used as ₹ in amounts
  s = s.replace(/(?:^|[\s\+\(])7\s*(80,000|1,35,000|1,00,000|25,000|8,50,000|50,000|40,000|30,000)\b/g, ' ₹$1');
  s = s.replace(/\b(?:Rs\.?|INR)\s*/gi, '₹');
  
  // Format bare numeric stipends
  if (/^\d{4,6}$/.test(s)) {
    const num = parseInt(s, 10);
    return `₹${num.toLocaleString('en-IN')}/month`;
  }
  if (/^\d{1,2},\d{3}$/.test(s)) {
    return `₹${s}/month`;
  }
  if (/^75k$/i.test(s)) {
    return '₹75,000/month';
  }
  if (/^(\d+)k$/i.test(s)) {
    const kMatch = s.match(/^(\d+)k$/i);
    return `₹${kMatch[1]},000/month`;
  }
  return s;
}


// Structured Preparation Strategy & Study Routine Parser
function parsePrepTopics(prepText, resources = []) {
  if (!prepText || typeof prepText !== 'string') return { intro: '', topics: [], rawText: '' };

  let text = prepText.trim().replace(/^[📚📖🎯💡📌]\s*/u, '');
  // Clean up any unlinked resume filenames
  text = text.replace(/^(?:My\s*)?Resume\s*[-:]\s*[A-Za-z0-9_\-\.]+\.pdf\b/gmi, '');
  // Clean up personal contact details
  text = text.replace(/(?:FEEL\s*FREE\s*TO\s*REACH\s*OUT|Contact\s*:\s*\d{8,}|Phone\s*:\s*\d{8,})[\s\S]*$/gi, '').trim();

  // 1. Normalize punctuation spacing (myself.I -> myself. I)
  text = text.replace(/([a-z0-9\)])\.([A-Z])/g, '$1. $2');
  text = text.replace(/([a-z0-9\)])\?([A-Z])/g, '$1? $2');
  text = text.replace(/([a-z0-9\)])\!([A-Z])/g, '$1! $2');

  // 2. Separate inline numbered list items that were accidentally on the same line
  text = text.replace(/([.:!?])\s+([0-9]+[\.\)])\s+/g, '$1\n\n$2 ');

  // Split on numbered items: e.g. "1) ", "2) ", "1. ", "2. ", "(1) "
  const topicSplitRegex = /(?:^|\n+)(?=(?:[0-9]+[\.\)]|\([0-9]+\))\s+)/;
  const rawParts = text.split(topicSplitRegex).map(p => p.trim()).filter(Boolean);

  if (rawParts.length >= 2) {
    let intro = '';
    const topics = [];

    rawParts.forEach((part) => {
      const match = part.match(/^(?:([0-9]+)[\.\)]|\(([0-9]+)\))\s+([\s\S]*)$/);
      if (match) {
        const fullBody = match[3].trim();
        const lines = fullBody.split('\n').map(l => l.trim()).filter(Boolean);
        let title = lines[0] || `Strategy ${topics.length + 1}`;
        let body = fullBody;

        if (title.length > 70) {
          const colonIdx = title.indexOf(':');
          const dashIdx = title.indexOf(' - ');
          if (colonIdx > 0 && colonIdx < 50) {
            title = title.substring(0, colonIdx).trim();
          } else if (dashIdx > 0 && dashIdx < 50) {
            title = title.substring(0, dashIdx).trim();
          } else {
            title = `Strategy ${topics.length + 1}`;
          }
        } else {
          body = lines.slice(1).join('\n').trim();
          if (!body) body = fullBody;
        }

        // Match relevant resources
        const topicResources = [];
        const lowerBody = fullBody.toLowerCase();
        (resources || []).forEach(res => {
          const rName = (res.name || '').toLowerCase();
          const rUrl = res.url || '';
          if (
            (rName.includes('striver') && (lowerBody.includes('striver') || lowerBody.includes('a2z') || lowerBody.includes('dsa'))) ||
            (rName.includes('sql') && (lowerBody.includes('sql') || lowerBody.includes('dbms'))) ||
            (rName.includes('dbms') && lowerBody.includes('dbms')) ||
            (rName.includes('oop') && (lowerBody.includes('oop') || lowerBody.includes('love babbar') || lowerBody.includes('whimsical'))) ||
            (rName.includes('puzzle') && lowerBody.includes('puzzle')) ||
            (rName.includes('guesstimate') && lowerBody.includes('guesstimate')) ||
            (rName.includes('aptitude') && (lowerBody.includes('aptitude') || lowerBody.includes('indiabix'))) ||
            (rName.includes('java') && lowerBody.includes('java')) ||
            (rUrl && fullBody.includes(rUrl))
          ) {
            if (!topicResources.some(tr => tr.url === res.url)) {
              topicResources.push(res);
            }
          }
        });

        topics.push({
          topicNumber: topics.length + 1,
          title: title,
          content: body,
          resources: topicResources
        });
      } else {
        if (topics.length === 0) {
          intro = intro ? `${intro}\n\n${part}` : part;
        } else {
          topics[topics.length - 1].content += `\n\n${part}`;
        }
      }
    });

    return { intro, topics, rawText: text };
  }

  return { intro: '', topics: [], rawText: text };
}

// Structured Placement Journey & Interview Stages Parser
function parseHowSecuredStages(howSecuredText) {
  if (!howSecuredText || typeof howSecuredText !== 'string') return { intro: '', stages: [], rawText: '' };

  let raw = howSecuredText.replace(/^[🏆🎉💼]\s*/u, '').trim();
  if (!raw) return { intro: '', stages: [], rawText: '' };

  // Normalize punctuation spacing
  raw = raw.replace(/([a-z0-9\)])\.([A-Z])/g, '$1. $2');
  raw = raw.replace(/([a-z0-9\)])\?([A-Z])/g, '$1? $2');
  raw = raw.replace(/([a-z0-9\)])\!([A-Z])/g, '$1! $2');

  const roundKeywords = "(?:Group\\s*Discussion|Technical|HR|Techno|Virtual|Online\\s*Assessment|Open\\s*Assessment|OA|Aptitude|Pre-placement|Coding|Managerial|Behavioral|Personal\\s*Interview)";
  const roundHeaderLine = new RegExp("^(?:(?:Round|Stage|Step)\\s*\\d+[:\\-–—\\s]+|[0-9]+[\\.\\)]\\s*(?:\\[?\\s*" + roundKeywords + "[^\\]\\n]*\\]?|" + roundKeywords + "\\b[^:\\n]*)|(?:Technical\\s*(?:Round|Interview)|HR\\s*(?:Round|Interview)|Techno\\s*HR|Group\\s*Discussion|Online\\s*Assessment|Open\\s*Assessment|Aptitude\\s*Test|Managerial\\s*Round|Behavioral\\s*Round|Personal\\s*Interview)\\b)", "i");

  const lines = raw.split('\n');
  const candidateHeaders = [];

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (roundHeaderLine.test(l)) {
      // Exclude interview questions inside rounds
      if (!/^[0-9]+[\.\)]\s*(?:What|How|Explain|Define|Implement|Write|Difference|Describe|Why|Can|Which|Is|Are|Tell|Based\s+on)\b/i.test(l)) {
        candidateHeaders.push({ index: i, line: l });
      }
    }
  }

  // If candidate has an introductory schedule list first where numbering restarts later:
  let finalHeaders = candidateHeaders;
  let restartIdx = -1;
  for (let j = 1; j < candidateHeaders.length; j++) {
    const prevMatch = candidateHeaders[j - 1].line.match(/^([0-9]+)[\.\)]/);
    const currMatch = candidateHeaders[j].line.match(/^([0-9]+)[\.\)]/);
    if (prevMatch && currMatch) {
      const prevNum = parseInt(prevMatch[1], 10);
      const currNum = parseInt(currMatch[1], 10);
      if (currNum <= prevNum && currNum === 1) {
        restartIdx = j;
        break;
      }
    }
  }

  if (restartIdx !== -1) {
    finalHeaders = candidateHeaders.slice(restartIdx);
  }

  if (finalHeaders.length === 0) {
    return { intro: raw, stages: [], rawText: raw };
  }

  const intro = lines.slice(0, finalHeaders[0].index).join('\n').trim();
  const stages = [];

  for (let k = 0; k < finalHeaders.length; k++) {
    const startLine = finalHeaders[k].index;
    const endLine = k + 1 < finalHeaders.length ? finalHeaders[k + 1].index : lines.length;
    let headerText = lines[startLine].trim();
    const content = lines.slice(startLine + 1, endLine).join('\n').trim();

    let date = null;
    let badge = null;

    const badgeMatch = headerText.match(/\[\s*([^\]]+(?:students?|candidates?|appeared|shortlisted|cleared|eligibility)[^\]]*)\s*\]/i);
    if (badgeMatch) {
      badge = badgeMatch[1].trim();
      headerText = headerText.replace(badgeMatch[0], '').trim();
    }

    const dateMatch = headerText.match(/(?:[–—\-]\s*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+[0-9]{4})?)|Date\s*:\s*([^\n]+)|\(([^\)]*(?:2024|2025|2026)[^\)]*)\))/i);
    if (dateMatch) {
      date = (dateMatch[1] || dateMatch[2] || dateMatch[3]).trim();
      headerText = headerText.replace(/(?:[–—\-]\s*[0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+(?:\s+[0-9]{4})?|Date\s*:\s*[^\n]+|\([^\)]*(?:2024|2025|2026)[^\)]*\))/i, '').trim();
    }

    headerText = headerText.replace(/^(?:(?:Round|Stage|Step)\s*\d+[:\-–—\s]*|[0-9]+[\.\)]\s*)/i, '').replace(/^[\[\(]|[\]\)]$/g, '').trim();
    if (!headerText) headerText = `Interview Stage ${k + 1}`;

    stages.push({
      stageNumber: k + 1,
      title: headerText,
      badge: badge,
      date: date,
      content: content
    });
  }

  return { intro, stages, rawText: raw };
}

// Advice to Juniors Parser (Strict: never invent synthetic quotes)
function parseAdviceContent(adviceText) {
  if (!adviceText || typeof adviceText !== 'string') return { quote: '', raw: '' };

  const text = adviceText.trim().replace(/^💡\s*/, '');
  let quote = '';
  const quoteMatch = text.match(/"([^"]{20,280})"/);
  if (quoteMatch) {
    quote = quoteMatch[1].trim();
  }

  return { quote, raw: text };
}

// Hackathons and Competitions Parser
function parseHackathonContent(hackathonText) {
  if (!hackathonText || typeof hackathonText !== 'string') return { intro: '', achievements: [], skills: [], impact: '' };

  let text = hackathonText.trim().replace(/^🏆\s*/u, '');
  let intro = '';
  let impact = '';

  const bulletParts = text.split(/•|\n/).map(l => l.trim()).filter(Boolean);
  const rawBullets = [];

  bulletParts.forEach(part => {
    const cleaned = part.replace(/^[-*•\d.)\s]+/, '').trim();
    if (!cleaned) return;
    const lower = cleaned.toLowerCase();
    if (lower.includes('participated in multiple') || lower.includes('my engineering journey') || lower.includes('experiences improved my')) {
      intro += (intro ? ' ' : '') + cleaned;
    } else if (lower.includes('notable achievements:')) {
      // header skip
    } else if (lower.includes('helped me gain') || lower.includes('beyond academics') || lower.includes('strengthened my resume')) {
      impact += (impact ? ' ' : '') + cleaned;
    } else {
      rawBullets.push(cleaned);
    }
  });

  const achievementIcons = [Trophy, Medal, Star, Award];
  const achievements = rawBullets.map((ach, idx) => {
    let badgeText = 'Milestone';
    let badgeColor = 'rgba(245, 158, 11, 0.12)';
    let textColor = '#fbbf24';
    const lower = ach.toLowerCase();

    if (lower.includes('winner') || lower.includes('1st') || lower.includes('first')) {
      badgeText = '1st Place / Winner';
      badgeColor = 'rgba(212, 255, 50, 0.15)';
      textColor = '#D4FF32';
    } else if (lower.includes('finalist') || lower.includes('top 10') || lower.includes('runner')) {
      badgeText = 'Top Finalist';
      badgeColor = 'rgba(59, 130, 246, 0.15)';
      textColor = '#60a5fa';
    } else if (lower.includes('ai') || lower.includes('solution') || lower.includes('built')) {
      badgeText = 'Technical Build';
      badgeColor = 'rgba(168, 85, 247, 0.15)';
      textColor = '#c084fc';
    } else if (lower.includes('collaborated') || lower.includes('team')) {
      badgeText = 'Cross-Domain Synergy';
      badgeColor = 'rgba(16, 185, 129, 0.15)';
      textColor = '#10b981';
    }

    return {
      id: idx,
      text: ach,
      badgeText,
      badgeColor,
      textColor,
      icon: achievementIcons[idx % achievementIcons.length]
    };
  });

  const skills = [
    { name: 'Team Collaboration', icon: Users, desc: 'Agile sprint teamwork across engineering disciplines' },
    { name: 'Rapid Prototyping', icon: Rocket, desc: 'Shipping production MVPs within 24-36 hour hackathon constraints' },
    { name: 'Problem-Solving Under Pressure', icon: Target, desc: 'Debugging architectures with tight deadline urgency' },
    { name: 'Technical Presentation', icon: MessageSquare, desc: 'Pitching software architecture clearly to industry judges' }
  ];

  return { intro, achievements, skills, impact };
}

const getResourceLink = (res) => {
  if (!res) return null;
  const raw = res.url || res.link || '';
  if (raw && typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
    if (/^[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) return `https://${trimmed}`;
  }
  if (res.name && typeof res.name === 'string') {
    const trimmed = res.name.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^www\./i.test(trimmed)) return `https://${trimmed}`;
    const lower = trimmed.toLowerCase();
    if (lower.includes('aws skillbuilder')) return 'https://explore.skillbuilder.aws/';
    if (lower.includes('striver') || lower.includes('sde sheet')) return 'https://takeuforward.org/interviews/strivers-sde-sheet-top-coding-interview-problems/';
    if (lower.includes('leetcode 75')) return 'https://leetcode.com/studyplan/leetcode-75/';
    if (lower.includes('leetcode')) return 'https://leetcode.com/problemset/';
    if (lower.includes('karpathy') || lower.includes('neural network')) return 'https://karpathy.ai/zero-to-hero.html';
    if (lower.includes('linux system programming')) return 'https://man7.org/tlpi/';
    if (lower.includes('amazon leadership')) return 'https://www.amazon.jobs/content/en/our-workplace/leadership-principles';
    if (lower.includes('deep learning book') || lower.includes('goodfellow')) return 'https://www.deeplearningbook.org/';
    if (lower.includes('cses')) return 'https://cses.fi/problemset/';
    if (lower.includes('codeforces')) return 'https://codeforces.com/catalog';
    if (lower.includes('designing data-intensive') || lower.includes('ddia')) return 'https://dataintensive.net/';
    if (lower.includes('geeksforgeeks') || lower.includes('gfg')) return 'https://www.geeksforgeeks.org/';
    if (lower.includes('sql') || lower.includes('hackerrank')) return 'https://www.hackerrank.com/domains/sql';
    if (lower.includes('qualcomm') || lower.includes('verilog')) return 'https://www.chipverify.com/verilog/verilog-tutorial';
    return `https://www.google.com/search?q=${encodeURIComponent(trimmed + ' computer engineering preparation')}`;
  }
  return null;
};

const dataURItoBlob = (dataURI) => {
  if (!dataURI || !dataURI.startsWith('data:')) return null;
  try {
    const parts = dataURI.split(',');
    const mimeString = parts[0].split(':')[1].split(';')[0];
    const byteString = parts[0].indexOf('base64') >= 0 ? atob(parts[1]) : unescape(parts[1]);
    const ia = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ia], { type: mimeString });
  } catch (e) {
    console.error("Error converting data URI to blob:", e);
    return null;
  }
};

function SectionEmptyState({ icon: Icon, title, message }) {
  return (
    <div
      className="story-content-card"
      style={{
        padding: '2.25rem 1.5rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.65rem',
        borderStyle: 'dashed',
        backgroundColor: 'rgba(255, 255, 255, 0.015)'
      }}
    >
      <div
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)'
        }}
      >
        <Icon size={20} />
      </div>
      <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.5 }}>
        {message}
      </p>
    </div>
  );
}

export default function StoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTimelineYear, setActiveTimelineYear] = useState(1);
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('section-compensation');
  const yearCardRefs = useRef({});

  // Reading progress tracker and scroll spy
  useEffect(() => {
    const handleScroll = () => {
      // 1. Reading progress bar percentage
      const totalScrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScrollHeight > 0) {
        const progress = Math.min(100, Math.max(0, (window.scrollY / totalScrollHeight) * 100));
        setReadingProgress(progress);
      }

      // 2. Quick navigation section spy (in exact 9-section order)
      const sections = [
        'section-compensation',
        'section-journey',
        'section-rounds',
        'section-prep',
        'section-projects',
        'section-advice',
        'section-resources',
        'section-resume',
        'section-materials'
      ];
      const scrollPos = window.scrollY + 180;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSection(sections[i]);
          break;
        }
      }

      // 3. Placement Preparation Journey milestone spy
      const years = [1, 2, 3, 4];
      const viewportMid = window.innerHeight * 0.42;
      let matchedYear = 1;
      for (const yr of years) {
        const el = yearCardRefs.current[yr];
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= viewportMid) {
            matchedYear = yr;
          }
        }
      }
      setActiveTimelineYear(matchedYear);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToYear = (yr) => {
    setActiveTimelineYear(yr);
    const el = yearCardRefs.current[yr];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getStoryFiles = () => {
    if (!story) return [];
    const list = [];
    const rf = story.resumeFile;
    const resumeName = rf?.fileName || (typeof story.resume === 'object' ? story.resume.fileName : (story.resume || 'Resume.pdf'));
    const resumeUrl = getResourceFileUrl({
      resumeFile: rf,
      resume: story.resume,
      url: rf?.url
    });
    list.push({
      id: `resume-${story.id}`,
      title: `${story.name}'s Resume`,
      fileName: resumeName,
      type: 'PDF',
      mimeType: 'application/pdf',
      fileSize: rf?.fileSize || '',
      url: resumeUrl || '',
      previewUrl: resumeUrl || ''
    });

    if (Array.isArray(story.studyMaterials)) {
      story.studyMaterials.forEach((m, idx) => {
        const matUrl = getResourceFileUrl(m);
        list.push({
          id: `mat-${story.id}-${idx}`,
          title: m.title || `Material ${idx + 1}`,
          fileName: m.fileName || m.title || `Material-${idx + 1}`,
          type: m.type || 'Document',
          fileSize: m.fileSize || '',
          url: matUrl || '',
          previewUrl: matUrl || ''
        });
      });
    }
    return list;
  };

  const handleDownloadFile = (fileName, url) => {
    if (!url || url === '#') {
      alert('No file available for download.');
      return;
    }
    try {
      if (url.startsWith('data:')) {
        const blob = dataURItoBlob(url);
        if (blob) {
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName || 'file';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        } else {
          alert('Failed to process file for download.');
        }
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName || 'file';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error("Download failed:", e);
      alert("Failed to download file.");
    }
  };



  useEffect(() => {
    // Check if story was preloaded in sessionStorage for instant 0ms rendering
    let hasCached = false;
    try {
      const raw = sessionStorage.getItem(`loop_cache_story_detail_${id}`);
      if (raw) {
        const entry = JSON.parse(raw);
        if (entry && entry.data) {
          setStory(entry.data);
          setLoading(false);
          hasCached = true;
        }
      }
    } catch {}

    if (!hasCached) {
      setLoading(true);
    }

    getStoryById(id).then(found => {
      setStory(found || null);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [id]);

  // Auth and Ownership
  const userSession = localStorage.getItem('loop_current_user');
  const currentUser = (() => {
    try {
      return userSession ? JSON.parse(userSession) : null;
    } catch (e) {
      return null;
    }
  })();
  const isAdmin = currentUser?.isAdmin;
  const isOwner = currentUser && story && (
    currentUser.email.split('@')[0].replace(/\./g, ' ').toLowerCase() === story.name.toLowerCase() ||
    story.uploadedByEmail === currentUser.email
  );
  const canModify = isAdmin || isOwner;

  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editForm, setEditForm] = useState({
    name: '',
    company: '',
    role: '',
    branch: 'CSE',
    passoutYear: '',
    semester: '',
    cgpa: '',
    package: '',
    journey: {
      firstYear: '',
      secondYear: '',
      thirdYear: '',
      fourthYear: '',
      prep: '',
      projects: '',
      howSecured: ''
    },
    studyMaterials: [],
    resume: ''
  });

  const [editMaterialInput, setEditMaterialInput] = useState({
    title: '',
    type: 'PDF',
    fileName: '',
    fileSize: '',
    previewUrl: ''
  });

  const [resumeMode, setResumeMode] = useState('upload'); // 'upload' | 'link'
  const [resumeLinkUrl, setResumeLinkUrl] = useState('');
  const [resumeLinkError, setResumeLinkError] = useState('');

  const [materialMode, setMaterialMode] = useState('upload'); // 'upload' | 'link'
  const [materialLinkTitle, setMaterialLinkTitle] = useState('');
  const [materialLinkCategory, setMaterialLinkCategory] = useState('DSA Preparation');
  const [materialLinkUrl, setMaterialLinkUrl] = useState('');
  const [materialLinkError, setMaterialLinkError] = useState('');

  useEffect(() => {
    if (isEditing) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isEditing]);

  const processMaterialFile = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    let determinedType = 'Notes';
    if (extension === 'pdf') {
      determinedType = 'PDF';
    } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
      determinedType = 'Image';
    }
    
    fileToBase64(file).then(base64Url => {
      setEditMaterialInput({
        title: file.name.substring(0, file.name.lastIndexOf('.')) || file.name,
        type: determinedType,
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        previewUrl: base64Url
      });
    }).catch(err => {
      console.error("Error reading file:", err);
      alert("Failed to read file.");
    });
  };

  const handleEditFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processMaterialFile(file);
  };

  const processResumeFile = (file) => {
    fileToBase64(file).then(base64Url => {
      setEditForm({
        ...editForm,
        resume: {
          fileName: file.name,
          fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          url: base64Url
        }
      });
    }).catch(err => {
      console.error("Error reading file:", err);
      alert("Failed to read file.");
    });
  };

  const isValidUrl = (string) => {
    try {
      const parsed = new URL(string);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
      return false;
    }
  };

  const startEdit = () => {
    const initialResume = story.resumeFile || story.resume || '';
    const initialResumeUrl = typeof initialResume === 'object' ? (initialResume.url || '') : (typeof initialResume === 'string' && initialResume.startsWith('http') ? initialResume : '');
    
    if (initialResumeUrl && (initialResumeUrl.startsWith('http://') || initialResumeUrl.startsWith('https://'))) {
      setResumeMode('link');
      setResumeLinkUrl(initialResumeUrl);
    } else {
      setResumeMode('upload');
      setResumeLinkUrl('');
    }
    setResumeLinkError('');

    setMaterialMode('upload');
    setMaterialLinkTitle('');
    setMaterialLinkCategory('DSA Preparation');
    setMaterialLinkUrl('');
    setMaterialLinkError('');

    setEditForm({
      name: story.name || '',
      company: story.company || '',
      role: story.role || '',
      branch: story.branch || 'CSE',
      passoutYear: story.passoutYear || '',
      semester: story.semester || '',
      cgpa: story.cgpa || '',
      package: story.package || story.ctc || '',
      journey: {
        firstYear: story.journey?.firstYear || '',
        secondYear: story.journey?.secondYear || '',
        thirdYear: story.journey?.thirdYear || '',
        fourthYear: story.journey?.fourthYear || '',
        prep: story.journey?.prep || '',
        projects: story.journey?.projects || '',
        howSecured: story.journey?.howSecured || ''
      },
      studyMaterials: story.studyMaterials || [],
      resume: initialResume
    });
    setEditMaterialInput({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' });
    setIsEditing(true);
  };

  const handleDelete = async () => {
    if (isAdmin) {
      if (window.confirm('Admin Action: Are you sure you want to delete this story directly?')) {
        await deleteStory(story.id);
        alert('Story deleted successfully.');
        navigate('/stories');
      }
    } else if (isOwner) {
      if (window.confirm('Contributor Action: Request administrator to delete this story?')) {
        await addPendingStory({
          ...story,
          requestType: 'delete',
          status: 'pending_delete',
          uploadedByEmail: currentUser.email
        });
        alert('Your deletion request has been submitted to the administrator for approval.');
        navigate('/stories');
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setUploadProgress(0);
    try {
      const payload = { ...editForm };
      
      if (resumeMode === 'link') {
        if (resumeLinkUrl.trim()) {
          if (!isValidUrl(resumeLinkUrl.trim())) {
            setResumeLinkError('Please enter a valid HTTP or HTTPS URL (e.g. https://drive.google.com/...)');
            setSubmitting(false);
            return;
          }
          const defaultDocName = `${payload.name || 'Candidate'} — ${payload.company || 'Placement'} — Resume — 2026.pdf`;
          payload.resumeFile = {
            fileName: defaultDocName,
            fileSize: 'Google Drive Document',
            url: resumeLinkUrl.trim()
          };
          payload.resume = defaultDocName;
        } else {
          payload.resumeFile = null;
          payload.resume = '';
        }
      } else {
        if (payload.resume && typeof payload.resume === 'object') {
          payload.resumeFile = {
            fileName: payload.resume.fileName,
            fileSize: payload.resume.fileSize,
            url: payload.resume.url
          };
          payload.resume = payload.resume.fileName;
        } else if (!payload.resume) {
          payload.resumeFile = null;
        }
      }

      if (isAdmin) {
        await updateStory(story.id, payload);
        alert('Admin Action: Changes saved directly.');
        setIsEditing(false);
        // Reload current story
        getStoryById(id).then(found => {
          if (found) setStory(found);
        }).catch(console.error);
      } else {
        await addPendingStory({
          ...payload,
          id: story.id,
          requestType: 'edit',
          status: 'pending_edit',
          uploadedByEmail: currentUser.email
        }, (progress) => {
          setUploadProgress(progress);
        });
        alert('Contributor Action: Your edits have been submitted to administrators for approval.');
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Error saving story changes:", err);
      alert(err.message || 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container skeleton-pulse" style={{ paddingTop: '6.5rem', paddingBottom: '6rem', maxWidth: '900px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem' }}>
          <div style={{ width: '120px', height: '1.5rem', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
        </div>
        <header style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '2.5rem', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', gap: '2.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ width: '60px', height: '1.2rem', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
                <div style={{ width: '80px', height: '1.2rem', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
              </div>
              <div style={{ height: '3rem', width: '250px', backgroundColor: 'var(--border-color)', borderRadius: '4px', marginBottom: '1rem' }} />
              <div style={{ height: '1.5rem', width: '180px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
            </div>
            <div style={{ width: '110px', height: '110px', backgroundColor: 'var(--border-color)', borderRadius: '24px' }} />
          </div>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ height: '1.5rem', width: '120px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
            <div style={{ height: '100px', backgroundColor: 'var(--border-color)', borderRadius: '12px' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ height: '1.5rem', width: '120px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
            <div style={{ height: '100px', backgroundColor: 'var(--border-color)', borderRadius: '12px' }} />
          </div>
        </div>
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 0.35; }
          }
          .skeleton-pulse {
            animation: pulse 1.5s infinite ease-in-out;
          }
        `}</style>
      </div>
    );
  }

  if (!story) {
    return (
      <div className="container" style={{ padding: '6rem 0', textAlign: 'center' }}>
        <h2>Senior profile not found</h2>
        <button onClick={() => navigate('/stories')} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Stories
        </button>
      </div>
    );
  }

  // Format multi-line projects list into modern single-column visual cards
  const formatProjects = (projectsString) => {
    if (!projectsString) return null;
    const lines = projectsString.split('\n').map(l => l.trim()).filter(Boolean);
    return (
      <div className="story-content-layout">
        {lines.map((line, index) => {
          let title = `Project ${index + 1}`;
          let desc = line;
          const match = line.match(/^\d*\.?\s*["']?([^"':]+)["']?[:-]\s*(.*)$/);
          if (match) {
            title = match[1].trim();
            desc = match[2].trim();
          }
          return (
            <div
              key={index}
              className="story-content-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(168, 85, 247, 0.12)',
                    color: '#c084fc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Code size={16} />
                  </div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {title}
                  </h4>
                </div>
                <span className="badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.55rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  Technical Highlight
                </span>
              </div>
              <FormattedText content={desc} />
            </div>
          );
        })}
      </div>
    );
  };

  // Available Milestones and Section Visibility
  const availableMilestones = [
    story?.journey?.firstYear && {
      yearNumber: 1,
      yearTitle: 'First Year',
      subtitle: 'Foundation & Exploration',
      content: story.journey.firstYear,
      phaseBadge: 'Phase 01'
    },
    story?.journey?.secondYear && {
      yearNumber: 2,
      yearTitle: 'Second Year',
      subtitle: 'Core Skills & Projects',
      content: story.journey.secondYear,
      phaseBadge: 'Phase 02'
    },
    story?.journey?.thirdYear && {
      yearNumber: 3,
      yearTitle: 'Third Year',
      subtitle: 'Internships & Preparation',
      content: story.journey.thirdYear,
      phaseBadge: 'Phase 03'
    },
    story?.journey?.fourthYear && {
      yearNumber: 4,
      yearTitle: 'Fourth Year',
      subtitle: 'Placement & Career Launch',
      content: story.journey.fourthYear,
      phaseBadge: 'Phase 04'
    }
  ].filter(Boolean);

  const rf = story?.resumeFile;
  const resumeRawUrl = getResourceFileUrl({
    resumeFile: rf,
    resume: story?.resume,
    url: rf?.url
  });
  const hasResumeActual = Boolean(
    (rf && (rf.url || rf.fileName)) ||
    (typeof story?.resume === 'object' && (story.resume.url || story.resume.fileName)) ||
    (typeof story?.resume === 'string' && story.resume.trim() && !['#', 'null', 'undefined', ''].includes(story.resume.trim())) ||
    (resumeRawUrl && resumeRawUrl !== '#')
  );
  const isDriveOrDocs = resumeRawUrl && (resumeRawUrl.includes('drive.google.com') || resumeRawUrl.includes('docs.google.com'));
  const isExternal = resumeRawUrl && (resumeRawUrl.startsWith('http://') || resumeRawUrl.startsWith('https://')) && !resumeRawUrl.includes(typeof window !== 'undefined' ? window.location.host : '');

  let displayResumeTitle = rf?.fileName || (typeof story?.resume === 'object' ? story.resume.fileName : (typeof story?.resume === 'string' && !story.resume.startsWith('http') ? story.resume : ''));
  if (!displayResumeTitle || displayResumeTitle.toLowerCase() === 'resume.pdf' || displayResumeTitle.toLowerCase() === 'candidate_verified_resume.pdf') {
    displayResumeTitle = `${story?.name || 'Candidate'} — ${story?.company || 'Company'} — Resume — 2026.pdf`;
  }

  const hasStudyMaterials = Array.isArray(story?.studyMaterials) && story.studyMaterials.length > 0;
  const hasCompensation = Boolean(story?.package || story?.ctc || story?.stipend || story?.offerType);
  const hasSecured = Boolean(story?.journey?.howSecured && story.journey.howSecured.trim());
  const hasPrep = Boolean(
    story?.journey?.prep &&
    story.journey.prep.trim() &&
    !story.journey.prep.includes('Focus consistently on Data Structures')
  );
  const adviceSec = story?.customSections?.find(s => s.title && s.title.toLowerCase().includes('advice'));
  const adviceText = (adviceSec?.content || story?.advice || '').trim();
  const hasAdvice = Boolean(adviceText);
  const hasResources = Boolean(story?.resources && story.resources.length > 0);
  const hasProjects = Boolean(
    story?.journey?.projects &&
    story.journey.projects.trim() &&
    story.journey.projects !== 'Core projects and domain architectures discussed in interview rounds.'
  );
  const hasJourney = availableMilestones.length > 0;

  // Exact 9-section order for sticky navigation
  const navSections = [
    { id: 'section-compensation', label: 'Compensation & Offer', icon: Briefcase },
    { id: 'section-journey', label: 'College Journey', icon: Compass },
    { id: 'section-rounds', label: 'Placement Journey', icon: Layers },
    { id: 'section-prep', label: 'Prep Strategy', icon: Award },
    { id: 'section-projects', label: 'Projects', icon: Code },
    { id: 'section-advice', label: 'Advice to Juniors', icon: Lightbulb },
    { id: 'section-resources', label: 'Resources', icon: BookOpen },
    { id: 'section-resume', label: 'Resume', icon: FileText },
    { id: 'section-materials', label: 'Study Materials', icon: FileText }
  ];

  return (
    <>
      {/* Sticky Top Reading Progress Bar */}
      <div
        role="progressbar"
        aria-valuenow={Math.round(readingProgress)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          zIndex: 1000,
          pointerEvents: 'none'
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${readingProgress}%`,
            background: 'linear-gradient(90deg, var(--text-primary) 0%, #10b981 100%)',
            transition: 'width 0.1s ease-out',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)'
          }}
        />
      </div>

      <div className="container animate-fade-in" style={{ paddingTop: '6rem', paddingBottom: '5rem', maxWidth: '880px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        {/* Back button with smooth hover animation */}
        <button 
          onClick={() => navigate('/stories')}
          className="btn btn-text"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '0.45rem 0.85rem',
            borderRadius: '20px',
            backgroundColor: 'transparent',
            border: '1px solid transparent',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateX(-3px)';
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
            e.currentTarget.style.borderColor = 'var(--border-color)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateX(0)';
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Placement Stories</span>
        </button>

        {/* Owner/Admin Options */}
        {canModify && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={startEdit}
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                borderColor: 'var(--border-color)',
                cursor: 'pointer'
              }}
            >
              <Edit size={14} />
              <span>Edit Story</span>
            </button>
            <button
              onClick={handleDelete}
              className="btn btn-secondary"
              style={{
                padding: '0.5rem 1rem',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#ff453a',
                borderColor: 'rgba(255, 69, 58, 0.2)',
                cursor: 'pointer'
              }}
            >
              <Trash2 size={14} />
              <span>{isAdmin ? 'Delete Story' : 'Request Deletion'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Profile Header (Notion Page Cover/Header Style) */}
      <header style={{
        borderBottom: '1px solid var(--border-color)',
        paddingBottom: '2.5rem',
        marginBottom: '3rem'
      }}>
        <div className="story-header-flex" style={{
          display: 'flex',
          gap: '2.5rem',
          alignItems: 'flex-start',
          flexWrap: 'wrap'
        }}>
          {/* Details */}
          <div style={{ flexGrow: 1, minWidth: '220px', maxWidth: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              <span className="badge" style={{ fontSize: '0.7rem' }}>
                {formatDisplayBranch(story)}
              </span>
              <span className="badge" style={{ fontSize: '0.7rem' }}>
                Class of {story.passoutYear}
              </span>
              <span className="badge" style={{ fontSize: '0.7rem', backgroundColor: 'var(--text-primary)', color: 'var(--accent-inverse)' }}>
                Placed
              </span>
            </div>
            
            <h1 style={{
              fontSize: '3rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              marginBottom: '0.75rem',
              fontFamily: 'var(--font-display)',
              lineHeight: 1.1
            }}>
              {story.name}
            </h1>

            <p style={{
              fontSize: '1.25rem',
              color: 'var(--text-secondary)',
              fontWeight: 500
            }}>
              {story.role} at <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{story.company}</span>
            </p>
          </div>
        </div>

        {/* Notion-style Page Properties Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginTop: '2.5rem',
          padding: '1.5rem',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-secondary)'
        }}>
          <div>
            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Company
            </p>
            <p style={{ fontWeight: 600, fontSize: '1rem' }}>{story.company}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              Role
            </p>
            <p style={{ fontWeight: 600, fontSize: '1rem' }}>{story.role}</p>
          </div>
          {story.semester && (
            <div>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Semester Placed
              </p>
              <p style={{ fontWeight: 600, fontSize: '1rem' }}>Semester {story.semester}</p>
            </div>
          )}
          {story.cgpa && story.cgpa !== 'N/A' && story.cgpa !== 'null' && (
            <div>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                CGPA
              </p>
              <p style={{ fontWeight: 600, fontSize: '1rem' }}>{story.cgpa}</p>
            </div>
          )}
          {/* Verified Placement Compensation */}
          {(() => {
            const rawPkg = (story.package || story.ctc || '').trim();
            if (!rawPkg || rawPkg === '0' || rawPkg.toLowerCase() === '0 lpa' || rawPkg.toLowerCase() === 'n/a' || rawPkg.toLowerCase() === 'nil') {
              return null;
            }
            const displayPkg = rawPkg.toLowerCase().includes('lpa') ? rawPkg : `${rawPkg} LPA`;
            return (
              <div>
                <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                  Placement Package (LPA)
                </p>
                <p style={{ fontWeight: 700, fontSize: '1.05rem', color: '#10b981' }}>
                  {displayPkg}
                </p>
              </div>
            );
          })()}
          {story.stipend && (
            <div>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Internship Stipend
              </p>
              <p style={{ fontWeight: 600, fontSize: '1rem', color: '#60a5fa' }}>
                {formatCurrencyText(story.stipend)}
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Sticky Table of Contents & Quick Navigation Pill Bar */}
      {navSections.length > 0 && (
        <nav
          aria-label="Story Quick Navigation"
          style={{
            position: 'sticky',
            top: '0.85rem',
            zIndex: 35,
            marginBottom: '2.25rem',
            padding: '0.45rem',
            borderRadius: '24px',
            backgroundColor: 'var(--glass-surface)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
            display: 'flex',
            gap: '0.35rem',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {navSections.map(sec => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => {
                  const el = document.getElementById(sec.id);
                  if (el) {
                    const yOffset = -90;
                    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                    window.scrollTo({ top: y, behavior: 'smooth' });
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '18px',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  backgroundColor: isActive ? 'var(--text-primary)' : 'transparent',
                  color: isActive ? 'var(--accent-inverse)' : 'var(--text-secondary)'
                }}
              >
                <Icon size={13} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* Main Notion-Style Reading Block */}
      <main style={{ fontFamily: 'var(--font-sans)' }}>

        {/* 1. Compensation & Offer */}
        <section id="section-compensation" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <Briefcase size={13} />
              Verified Placement Offer
            </div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Briefcase size={22} style={{ color: 'var(--text-primary)' }} />
              Compensation & Offer
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
              Official compensation, stipend, and offer breakdown confirmed from college placement records
            </p>
          </div>

          {hasCompensation ? (
            <div className="story-content-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                {(story.package || story.ctc) && (
                  <div style={{ padding: '1.1rem', borderRadius: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' }}>Placement Package (CTC)</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                      {formatCurrencyText(story.ctc || story.package)}
                    </span>
                  </div>
                )}
                {story.stipend && (
                  <div style={{ padding: '1.1rem', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' }}>Internship Stipend</span>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                      {formatCurrencyText(story.stipend)}
                    </span>
                  </div>
                )}
                {story.offerType && (
                  <div style={{ padding: '1.1rem', borderRadius: '12px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '0.35rem' }}>Offer Type / Role</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {story.offerType}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <SectionEmptyState
              icon={Briefcase}
              title="No compensation details provided"
              message="Official CTC, stipend, or offer breakdown details were not included in this submission."
            />
          )}
        </section>

        {/* 2. College Journey */}
        <section id="section-journey" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: '20px', backgroundColor: 'rgba(212, 255, 50, 0.25)', border: '1px solid rgba(212, 255, 50, 0.45)', color: 'var(--text-primary)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                <Sparkles size={12} color="var(--accent-lime-dark)" />
                Academic Milestones
              </div>
              <h2 style={{ fontSize: '2.1rem', fontWeight: 800, margin: '0 0 0.4rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Compass size={22} style={{ color: 'var(--text-primary)' }} />
                College Journey
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
                Chronological academic progression and technical development through engineering years
              </p>
            </div>
          </div>

          {hasJourney ? (
            /* Timeline Track with Vertical Rail */
            <div style={{ position: 'relative', paddingLeft: '2.75rem' }}>
              <div style={{
                position: 'absolute',
                left: '11px',
                top: '24px',
                bottom: '30px',
                width: '2px',
                backgroundColor: 'var(--border-color)',
                zIndex: 0
              }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                {availableMilestones.map((milestone) => {
                  const isActive = activeTimelineYear === milestone.yearNumber;
                  return (
                    <div
                      key={milestone.yearNumber}
                      ref={(el) => (yearCardRefs.current[milestone.yearNumber] = el)}
                      style={{ position: 'relative', zIndex: 1 }}
                      onClick={() => scrollToYear(milestone.yearNumber)}
                    >
                      {isActive ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToYear(milestone.yearNumber);
                          }}
                          style={{
                            position: 'absolute',
                            left: '-2.75rem',
                            top: '1.25rem',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            border: '2.5px solid var(--text-primary)',
                            backgroundColor: 'var(--bg-surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 0 4px var(--bg-primary), 0 2px 10px rgba(0,0,0,0.12)',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                            transform: 'scale(1.08)'
                          }}
                          title={`Year ${milestone.yearNumber} (Active)`}
                        >
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--text-primary)'
                            }}
                          />
                        </div>
                      ) : (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            scrollToYear(milestone.yearNumber);
                          }}
                          style={{
                            position: 'absolute',
                            left: '-2.75rem',
                            top: '1.25rem',
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            border: '2px solid var(--border-hover)',
                            backgroundColor: 'var(--bg-surface)',
                            boxShadow: '0 0 0 4px var(--bg-primary)',
                            cursor: 'pointer',
                            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
                          }}
                          title={`Click to view Year ${milestone.yearNumber}`}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--text-primary)';
                            e.currentTarget.style.transform = 'scale(1.1)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border-hover)';
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        />
                      )}

                      <div
                        className="bento-card"
                        style={{
                          padding: '1.75rem',
                          borderRadius: '20px',
                          border: isActive ? '1.5px solid var(--text-primary)' : '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-surface)',
                          boxShadow: isActive ? '0 12px 36px rgba(0, 0, 0, 0.08)' : 'var(--card-shadow)',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                          cursor: 'pointer',
                          transform: isActive ? 'translateY(-2px)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.2rem 0.6rem',
                                  borderRadius: '12px',
                                  fontSize: '0.72rem',
                                  fontWeight: 800,
                                  letterSpacing: '0.04em',
                                  backgroundColor: isActive ? 'var(--text-primary)' : 'var(--bg-tertiary)',
                                  color: isActive ? 'var(--accent-inverse)' : 'var(--text-primary)'
                                }}
                              >
                                {milestone.phaseBadge}
                              </span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {milestone.subtitle}
                              </span>
                            </div>

                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Year {milestone.yearNumber} of 4
                            </span>
                          </div>

                          <div>
                            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.65rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                              {milestone.yearTitle}
                            </h3>
                            <FormattedText text={milestone.content} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <SectionEmptyState
              icon={Compass}
              title="No college journey timeline provided"
              message="Year-by-year academic progression and milestones were not submitted for this story."
            />
          )}
        </section>

        {/* 3. Placement Journey */}
        <section id="section-rounds" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <Layers size={13} />
              Recruitment Process Flow
            </div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Layers size={22} style={{ color: 'var(--text-primary)' }} />
              Placement Journey
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
              Detailed selection process, stage-by-stage technical rounds, and interview questions directly from the candidate
            </p>
          </div>

          {hasSecured ? (() => {
            const { intro, stages, rawText } = parseHowSecuredStages(story.journey.howSecured);
            return (
              <div className="story-content-layout">
                {intro && (
                  <div className="story-content-card" style={{ borderLeft: '4px solid #3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.03)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <Sparkles size={16} style={{ color: '#3b82f6' }} />
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#3b82f6' }}>
                        Placement Overview & Timeline
                      </h4>
                    </div>
                    <FormattedText text={intro} />
                  </div>
                )}

                {stages.length > 0 ? (
                  stages.map((stg) => (
                    <div key={stg.stageNumber} className="story-content-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            color: '#60a5fa',
                            fontSize: '0.8rem',
                            fontWeight: 800
                          }}>
                            {stg.stageNumber}
                          </span>
                          <h3 style={{ fontSize: '1.18rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            Stage {stg.stageNumber} — {stg.title}
                          </h3>
                          {stg.badge && (
                            <span style={{
                              fontSize: '0.78rem',
                              color: '#10b981',
                              fontWeight: 600,
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              border: '1px solid rgba(16, 185, 129, 0.25)',
                              padding: '0.15rem 0.55rem',
                              borderRadius: '12px'
                            }}>
                              👥 {stg.badge}
                            </span>
                          )}
                        </div>
                        {stg.date && (
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, backgroundColor: 'var(--bg-tertiary)', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                            📅 {stg.date}
                          </span>
                        )}
                      </div>
                      {stg.content && <FormattedText text={stg.content} />}
                    </div>
                  ))
                ) : rawText ? (
                  <div className="story-content-card">
                    <FormattedText text={rawText} />
                  </div>
                ) : null}
              </div>
            );
          })() : (
            <SectionEmptyState
              icon={Layers}
              title="No placement journey details provided"
              message="Detailed selection stages, technical interview rounds, and timeline were not included in this submission."
            />
          )}
        </section>

        {/* 4. Prep Strategy */}
        <section id="section-prep" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <Award size={13} />
              Preparation Blueprint
            </div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Award size={22} style={{ color: 'var(--text-primary)' }} />
              Prep Strategy
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
              Candidate's verified preparation regimen, DSA problem-solving techniques, and subject strategies
            </p>
          </div>

          {hasPrep ? (() => {
            const { intro, topics, rawText } = parsePrepTopics(story.journey?.prep, story.resources);
            return (
              <div className="story-content-layout">
                {intro && (
                  <div className="story-content-card">
                    <FormattedText text={intro} />
                  </div>
                )}

                {topics.length > 0 ? (
                  topics.map((tpc) => (
                    <div key={tpc.topicNumber} className="story-content-card">
                      <h3 style={{ fontSize: '1.18rem', fontWeight: 700, margin: '0 0 0.85rem 0', color: 'var(--text-primary)', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border-color)' }}>
                        {tpc.topicNumber}. {tpc.title}
                      </h3>
                      {tpc.content && <FormattedText text={tpc.content} />}
                      {tpc.resources && tpc.resources.length > 0 && (
                        <div style={{ marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border-color)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Resources:</span>
                          {tpc.resources.map((r, rIdx) => {
                            const link = getResourceLink(r);
                            if (!link) return null;
                            return (
                              <a
                                key={rIdx}
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="story-inline-link"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.35rem',
                                  padding: '0.3rem 0.75rem',
                                  borderRadius: '8px',
                                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                                  fontSize: '0.85rem',
                                  fontWeight: 600,
                                  textDecoration: 'none'
                                }}
                              >
                                <span>{r.name || 'Open Resource'}</span>
                                <ExternalLink size={12} />
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))
                ) : rawText ? (
                  <div className="story-content-card">
                    <FormattedText text={rawText} />
                  </div>
                ) : null}
              </div>
            );
          })() : (
            <SectionEmptyState
              icon={Award}
              title="No preparation strategy provided"
              message="Specific preparation regimen, DSA problem lists, and study routine were not included in this submission."
            />
          )}
        </section>

        {/* 5. Projects */}
        <section id="section-projects" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', color: '#c084fc', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <Code size={13} />
              Technical Portfolio
            </div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Code size={22} style={{ color: 'var(--text-primary)' }} />
              Projects
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
              Practical systems, open-source repositories, and portfolio work showcased in interviews
            </p>
          </div>
          {hasProjects ? (
            formatProjects(story.journey?.projects)
          ) : (
            <SectionEmptyState
              icon={Code}
              title="No projects listed"
              message="Technical portfolio systems, GitHub repositories, and capstone projects were not specified in this submission."
            />
          )}
        </section>

        {/* 6. Advice to Juniors */}
        <section id="section-advice" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <Lightbulb size={13} />
              Guidance For Juniors
            </div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Lightbulb size={22} style={{ color: 'var(--text-primary)' }} />
              Advice to Juniors
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
              Genuine advice, practical habits, and mindset recommendations directly from {story.name}
            </p>
          </div>

          {hasAdvice ? (() => {
            const adviceSec = story.customSections?.find(s => s.title && s.title.toLowerCase().includes('advice'));
            const adviceText = (adviceSec?.content || story.advice || '').trim();
            const { quote, raw } = parseAdviceContent(adviceText);
            return (
              <div className="story-content-layout">
                {quote && (
                  <div className="story-content-card" style={{ borderLeft: '4px solid #10b981', backgroundColor: 'rgba(16, 185, 129, 0.04)' }}>
                    <p style={{ margin: 0, fontSize: '1.08rem', fontStyle: 'italic', lineHeight: 1.7, color: 'var(--text-primary)' }}>
                      "{quote}"
                    </p>
                    <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      — {story.name}, {story.role} at {story.company}
                    </span>
                  </div>
                )}
                {raw && (
                  <div className="story-content-card">
                    <FormattedText text={raw} />
                  </div>
                )}
              </div>
            );
          })() : (
            <SectionEmptyState
              icon={Lightbulb}
              title="No advice provided"
              message="Specific mindset tips, habit suggestions, or guidance for juniors were not included in this submission."
            />
          )}
        </section>

        {/* 7. Resources */}
        <section id="section-resources" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', color: '#818cf8', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <BookOpen size={13} />
              Curated Preparation Links
            </div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <BookOpen size={22} style={{ color: 'var(--text-primary)' }} />
              Resources
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
              Direct links to study sheets, practice repositories, and documentation used during placement preparation
            </p>
          </div>

          {hasResources ? (
            <div className="story-content-layout">
              {story.resources.map((res, index) => {
                const targetUrl = getResourceLink(res) || `https://www.google.com/search?q=${encodeURIComponent((res.name || 'study material') + ' preparation')}`;
                return (
                  <div
                    key={index}
                    className="story-content-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      padding: '1.1rem 1.4rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <ExternalLink size={16} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {res.name}
                        </h4>
                        {res.type && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Type: {res.type}
                          </span>
                        )}
                      </div>
                    </div>

                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        textDecoration: 'none',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    >
                      <span>Open Resource</span>
                      <ExternalLink size={14} />
                    </a>
                  </div>
                );
              })}
            </div>
          ) : (
            <SectionEmptyState
              icon={BookOpen}
              title="No resources linked"
              message="No preparation sheets, YouTube playlists, or documentation links were attached to this submission."
            />
          )}
        </section>

        {/* 8. Resume */}
        <section id="section-resume" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: 0, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <FileText size={22} style={{ color: 'var(--text-primary)' }} />
              Resume
            </h2>
            {hasResumeActual && (
              <span style={{ backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.28)', padding: '0.25rem 0.65rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 600 }}>
                {isDriveOrDocs ? 'Google Drive Verified Document' : 'Standard Tech Resume (PDF)'}
              </span>
            )}
          </div>

          {hasResumeActual ? (
            <div className="story-content-card" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1.5rem 1.8rem',
              flexWrap: 'wrap',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '260px' }}>
                <div style={{
                  padding: '0.85rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '14px',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <FileText size={28} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                    {displayResumeTitle}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                    {isDriveOrDocs ? 'Official candidate placement resume hosted on Google Drive' : 'Approved standard format tech resume (PDF)'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {isDriveOrDocs || isExternal ? (
                  <a
                    href={resumeRawUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="btn btn-primary"
                    style={{ padding: '0.65rem 1.35rem', fontSize: '0.88rem', gap: '0.5rem', display: 'inline-flex', alignItems: 'center', textDecoration: 'none', fontWeight: 600 }}
                    title="Open Verified Resume"
                  >
                    <ExternalLink size={16} />
                    <span>{isDriveOrDocs ? 'Open in Google Drive ↗' : 'View Resume ↗'}</span>
                  </a>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        const allFiles = getStoryFiles();
                        const resumeDoc = allFiles[0] || {
                          id: `resume-${story.id}`,
                          title: `${story.name}'s Resume`,
                          fileName: displayResumeTitle,
                          type: 'PDF',
                          url: resumeRawUrl
                        };
                        navigate(`/preview/${resumeDoc.id}?storyId=${story.id}`, {
                          state: {
                            file: resumeDoc,
                            files: allFiles,
                            storyTitle: story.name
                          }
                        });
                      }}
                      className="btn btn-secondary"
                      style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', gap: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', fontWeight: 600 }}
                      title="View Resume"
                    >
                      <FileText size={14} />
                      <span>View Resume ↗</span>
                    </button>
                    {resumeRawUrl && (
                      <button 
                        onClick={() => {
                          if (resumeRawUrl.startsWith('data:')) {
                            const blob = dataURItoBlob(resumeRawUrl);
                            if (blob) {
                              const blobUrl = URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = blobUrl;
                              link.download = displayResumeTitle;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                            }
                          } else {
                            const link = document.createElement('a');
                            link.href = resumeRawUrl;
                            link.download = displayResumeTitle;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        className="btn btn-primary"
                        style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', gap: '0.4rem', fontWeight: 600 }}
                      >
                        <Download size={14} />
                        <span>Download Resume</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <SectionEmptyState
              icon={FileText}
              title="No resume attached"
              message="The candidate's verified tech resume was not uploaded for this story."
            />
          )}
        </section>

        {/* 9. Study Materials */}
        <section id="section-materials" className="story-section" style={{ scrollMarginTop: '110px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', color: '#f87171', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                <FileText size={13} />
                Candidate Study Materials
              </div>
              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <FileText size={22} style={{ color: 'var(--text-primary)' }} />
                Study Materials
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
                Genuine handwritten notes, PDFs, and technical question sets shared by the candidate
              </p>
            </div>
            {hasStudyMaterials && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {story.studyMaterials.length} verified {story.studyMaterials.length === 1 ? 'file' : 'files'}
              </span>
            )}
          </div>

          {hasStudyMaterials ? (
            <div className="story-content-layout">
              {story.studyMaterials.map((mat, index) => {
                const matUrl = mat.url || '';
                const isExternalMat = matUrl && (matUrl.startsWith('http://') || matUrl.startsWith('https://'));
                const isDriveMat = matUrl.includes('drive.google.com') || matUrl.includes('docs.google.com');
                const isPdf = mat.type === 'PDF' || (mat.fileName && mat.fileName.toLowerCase().endsWith('.pdf'));

                return (
                  <div
                    key={index}
                    className="story-content-card"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      padding: '1.15rem 1.4rem'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexWrap: 'wrap' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: isPdf ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: isPdf ? '#ef4444' : '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={20} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: '6px', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                            {mat.category || (isPdf ? 'PDF Document' : 'Study Notes')}
                          </span>
                          {mat.fileSize && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              • {mat.fileSize}
                            </span>
                          )}
                        </div>
                        <h4 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {mat.title || mat.fileName}
                        </h4>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {isExternalMat || isDriveMat ? (
                        <a
                          href={matUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="btn btn-secondary"
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'var(--bg-surface)'
                          }}
                        >
                          <span>{isDriveMat ? 'Open in Drive ↗' : (isPdf ? 'View PDF ↗' : 'Open Material ↗')}</span>
                          <ExternalLink size={14} />
                        </a>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              const allFiles = getStoryFiles();
                              const matDoc = allFiles[index + 1] || { ...mat, id: `mat-${story.id}-${index}` };
                              navigate(`/preview/${matDoc.id}?storyId=${story.id}`, {
                                state: {
                                  file: matDoc,
                                  files: allFiles,
                                  storyTitle: story.name
                                }
                              });
                            }}
                            className="btn btn-secondary"
                            style={{
                              padding: '0.5rem 1rem',
                              borderRadius: '10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.45rem',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            <FileText size={14} />
                            <span>View File</span>
                          </button>
                          {mat.url && mat.url !== '#' && (
                            <button
                              onClick={() => handleDownloadFile(mat.fileName || mat.title + (isPdf ? '.pdf' : '.txt'), mat.url)}
                              className="btn btn-secondary"
                              style={{ padding: '0.45rem', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '36px', height: '36px' }}
                              title="Download File"
                            >
                              <Download size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <SectionEmptyState
              icon={FileText}
              title="No study materials attached"
              message="No handwritten notes, technical PDFs, or question sets were attached to this submission."
            />
          )}
        </section>

        {/* 10. Additional Custom Sections */}
        {story.customSections && story.customSections.map((sec, index) => {
          const lowerTitle = (sec.title || '').toLowerCase();
          const isAdvice = lowerTitle.includes('advice');
          const isComp = lowerTitle.includes('compensation') || lowerTitle.includes('offer breakdown');
          if (isAdvice || isComp) return null;

          return (
            <section key={index} id={`section-custom-${index}`} className="story-section" style={{ scrollMarginTop: '110px' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Star size={22} style={{ color: 'var(--text-primary)' }} />
                  {sec.title}
                </h2>
              </div>
              <div className="story-content-card">
                <FormattedText text={sec.content} />
              </div>
            </section>
          );
        })}


        {/* Bottom Back to Stories & Quick Return Footer */}
        <div style={{
          marginTop: '3.5rem',
          paddingTop: '2rem',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <button 
            onClick={() => navigate('/stories')}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '0.75rem 1.4rem',
              borderRadius: '30px',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(-4px)';
              e.currentTarget.style.borderColor = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
          >
            <ArrowLeft size={16} />
            <span>Back to All Placement Stories</span>
          </button>

          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="btn btn-text"
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              cursor: 'pointer',
              padding: '0.5rem 0.9rem',
              borderRadius: '20px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-surface)'
            }}
          >
            <span>Back to Top</span>
            <ArrowRight size={14} style={{ transform: 'rotate(-90deg)' }} />
          </button>
        </div>

      </main>
    </div>



      {/* Edit Story Details Overlay Modal */}
      {isEditing && createPortal(
        <div 
          onClick={() => setIsEditing(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            zIndex: 100000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2.5rem 1rem',
            overflowY: 'auto',
            overscrollBehavior: 'contain'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="glass-panel animate-fade-in custom-scrollbar" 
            style={{
              margin: 'auto',
              width: '100%',
              maxWidth: '650px',
              borderRadius: '24px',
              backgroundColor: 'var(--bg-primary)',
              border: '1px solid var(--border-color)',
              position: 'relative',
              padding: '2rem',
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4), 0 0 1px 1px rgba(255, 255, 255, 0.1) inset'
            }}
          >
            <button 
              onClick={() => setIsEditing(false)}
              style={{
                position: 'absolute',
                top: '1.5rem',
                right: '1.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)'
              }}
            >
              <X size={20} />
            </button>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '2rem', textAlign: 'left' }}>
              Edit Story Details {!isAdmin && '(Requires Admin Approval)'}
            </h2>

            <form onSubmit={handleSave}>
              <div className="form-grid-2col" style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Name</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.name} 
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Company</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.company} 
                    onChange={e => setEditForm({ ...editForm, company: e.target.value })} 
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2col" style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Role</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.role} 
                    onChange={e => setEditForm({ ...editForm, role: e.target.value })} 
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Branch</label>
                  <select 
                    className="input-field" 
                    value={editForm.branch} 
                    onChange={e => setEditForm({ ...editForm, branch: e.target.value })}
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <option value="CSE">CSE</option>
                    <option value="CE">CE</option>
                    <option value="EXTC">EXTC</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-4col" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Passout Year</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.passoutYear} 
                    onChange={e => setEditForm({ ...editForm, passoutYear: e.target.value })} 
                    required
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Semester</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.semester} 
                    onChange={e => setEditForm({ ...editForm, semester: e.target.value })} 
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">CGPA</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={editForm.cgpa} 
                    onChange={e => setEditForm({ ...editForm, cgpa: e.target.value })} 
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">Package (LPA)</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. 14.5 LPA"
                    value={editForm.package} 
                    onChange={e => setEditForm({ ...editForm, package: e.target.value })} 
                  />
                </div>
              </div>

              <div className="form-grid-2col" style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">1st Year Strategy</label>
                  <textarea 
                    className="input-field" 
                    rows={2} 
                    value={editForm.journey.firstYear} 
                    onChange={e => setEditForm({
                      ...editForm,
                      journey: { ...editForm.journey, firstYear: e.target.value }
                    })}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">2nd Year Strategy</label>
                  <textarea 
                    className="input-field" 
                    rows={2} 
                    value={editForm.journey.secondYear} 
                    onChange={e => setEditForm({
                      ...editForm,
                      journey: { ...editForm.journey, secondYear: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="form-grid-2col" style={{ marginBottom: '1rem', textAlign: 'left' }}>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">3rd Year Strategy</label>
                  <textarea 
                    className="input-field" 
                    rows={2} 
                    value={editForm.journey.thirdYear} 
                    onChange={e => setEditForm({
                      ...editForm,
                      journey: { ...editForm.journey, thirdYear: e.target.value }
                    })}
                  />
                </div>
                <div className="input-group" style={{ marginBottom: 0 }}>
                  <label className="input-label">4th Year Strategy</label>
                  <textarea 
                    className="input-field" 
                    rows={2} 
                    value={editForm.journey.fourthYear} 
                    onChange={e => setEditForm({
                      ...editForm,
                      journey: { ...editForm.journey, fourthYear: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="input-group" style={{ textAlign: 'left' }}>
                <label className="input-label">Preparation Strategy & Tips *</label>
                <textarea 
                  className="input-field" 
                  rows={3} 
                  value={editForm.journey.prep} 
                  onChange={e => setEditForm({
                    ...editForm,
                    journey: { ...editForm.journey, prep: e.target.value }
                  })}
                  required
                />
              </div>

              {/* Resume Section in Edit Modal */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Senior Resume
                  </h4>
                  <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: 'var(--bg-primary)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => setResumeMode('upload')}
                      style={{
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: resumeMode === 'upload' ? 700 : 500,
                        backgroundColor: resumeMode === 'upload' ? 'var(--text-primary)' : 'transparent',
                        color: resumeMode === 'upload' ? 'var(--bg-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      Upload PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeMode('link')}
                      style={{
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: resumeMode === 'link' ? 700 : 500,
                        backgroundColor: resumeMode === 'link' ? 'var(--text-primary)' : 'transparent',
                        color: resumeMode === 'link' ? 'var(--bg-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      Google Drive Link
                    </button>
                  </div>
                </div>

                {resumeMode === 'upload' ? (
                  <div 
                    onClick={() => document.getElementById('story-detail-resume-upload')?.click()}
                    style={{
                      border: editForm.resume ? '2px solid var(--border-dropzone, #000000)' : '2px dashed var(--border-dropzone, #000000)',
                      borderRadius: '16px',
                      padding: '1rem',
                      textAlign: 'center',
                      backgroundColor: 'var(--bg-dropzone, rgba(0, 0, 0, 0.02))',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '100px',
                      color: 'var(--text-primary)'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary, #0071e3)'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-dropzone, #000000)'}
                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) processResumeFile(file);
                    }}
                  >
                    <input 
                      type="file" 
                      id="story-detail-resume-upload" 
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        
                        fileToBase64(file).then(base64Url => {
                          setEditForm({
                            ...editForm,
                            resume: {
                              fileName: file.name,
                              fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
                              url: base64Url
                            }
                          });
                        }).catch(err => {
                          console.error("Error reading file:", err);
                          alert("Failed to read file.");
                        });
                      }} 
                      style={{ display: 'none' }}
                      accept=".pdf"
                    />
                    {editForm.resume ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                          <span style={{
                            padding: '0.4rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ff3b30'
                          }}>
                            <FileText size={18} />
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {typeof editForm.resume === 'object' ? editForm.resume.fileName : editForm.resume}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {typeof editForm.resume === 'object' ? editForm.resume.fileSize : 'Uploaded File'}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditForm({ ...editForm, resume: '' });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem', color: '#ff453a', border: 'none', background: 'transparent', cursor: 'pointer' }}
                            title="Remove Resume"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <FileText size={22} style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }} />
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>
                          Click to upload Resume PDF
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: '1.25rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Google Drive Document or Public URL
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="url"
                        className="input-field"
                        placeholder="https://drive.google.com/file/d/.../view?usp=sharing"
                        value={resumeLinkUrl}
                        onChange={(e) => {
                          setResumeLinkUrl(e.target.value);
                          setResumeLinkError('');
                        }}
                        style={{ flexGrow: 1, fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                      />
                      {resumeLinkUrl && isValidUrl(resumeLinkUrl) && (
                        <a 
                          href={resumeLinkUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                          style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
                        >
                          <ExternalLink size={14} />
                          <span>Test Link ↗</span>
                        </a>
                      )}
                    </div>
                    {resumeLinkError && (
                      <span style={{ fontSize: '0.75rem', color: '#ff3b30' }}>{resumeLinkError}</span>
                    )}
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                      Enter a publicly accessible Google Drive or Docs link. LOOP will format it as: <code>[Student Name] — [Company] — Resume — 2026.pdf</code>
                    </span>
                  </div>
                )}
              </div>

              {/* Study Materials Section in Edit Modal */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Study Materials &amp; Resources
                  </h4>
                  <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: 'var(--bg-primary)', padding: '0.2rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <button
                      type="button"
                      onClick={() => setMaterialMode('upload')}
                      style={{
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: materialMode === 'upload' ? 700 : 500,
                        backgroundColor: materialMode === 'upload' ? 'var(--text-primary)' : 'transparent',
                        color: materialMode === 'upload' ? 'var(--bg-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      Upload File
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaterialMode('link')}
                      style={{
                        padding: '0.25rem 0.65rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: materialMode === 'link' ? 700 : 500,
                        backgroundColor: materialMode === 'link' ? 'var(--text-primary)' : 'transparent',
                        color: materialMode === 'link' ? 'var(--bg-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      Google Drive / External Link
                    </button>
                  </div>
                </div>
                
                {editForm.studyMaterials && editForm.studyMaterials.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    {editForm.studyMaterials.map((material, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        backgroundColor: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                          <span style={{
                            padding: '0.4rem',
                            backgroundColor: 'var(--bg-primary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-primary)'
                          }}>
                            <FileText size={18} />
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{material.title}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {material.category ? `${material.category} • ` : ''}{material.type} {material.fileName ? `• ${material.fileName}` : ''}
                            </span>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedMaterials = editForm.studyMaterials.filter((_, i) => i !== idx);
                              setEditForm({ ...editForm, studyMaterials: updatedMaterials });
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem', color: '#ff453a', border: 'none', background: 'transparent', cursor: 'pointer' }}
                            title="Remove File"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '1.5rem', textAlign: 'left' }}>
                    No study materials attached.
                  </p>
                )}

                {/* Add Study Material block */}
                <div style={{
                  padding: '1.25rem',
                  border: '1px dashed var(--border-color)',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-secondary)',
                  textAlign: 'left'
                }}>
                  <h5 style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
                    Add Study Material ({materialMode === 'upload' ? 'Upload File' : 'Google Drive / External Link'})
                  </h5>
                  
                  {materialMode === 'upload' ? (
                    <>
                      <div 
                        onClick={() => document.getElementById('story-detail-material-upload')?.click()}
                        style={{
                          border: editMaterialInput.previewUrl ? '2px solid var(--border-dropzone, #000000)' : '2px dashed var(--border-dropzone, #000000)',
                          borderRadius: '16px',
                          padding: editMaterialInput.previewUrl ? '1rem' : '1.5rem',
                          textAlign: 'center',
                          backgroundColor: 'var(--bg-dropzone, rgba(0, 0, 0, 0.02))',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          minHeight: '110px',
                          marginBottom: '1rem',
                          color: 'var(--text-primary)'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary, #0071e3)'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-dropzone, #000000)'}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) processMaterialFile(file);
                        }}
                      >
                        <input 
                          type="file" 
                          id="story-detail-material-upload" 
                          onChange={handleEditFileChange} 
                          style={{ display: 'none' }}
                          accept=".pdf,.png,.jpg,.jpeg"
                        />
                        
                        {editMaterialInput.previewUrl ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem', width: '100%' }}>
                            {editMaterialInput.type === 'Image' ? (
                              <div style={{ position: 'relative', width: '100%', height: '80px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <img 
                                  src={editMaterialInput.previewUrl} 
                                  alt="Selected preview" 
                                  style={{ maxHeight: '100%', maxWidth: '100px', objectFit: 'contain', borderRadius: '6px' }}
                                />
                              </div>
                            ) : (
                              <FileText size={36} style={{ color: 'var(--text-primary)' }} />
                            )}
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                              {editMaterialInput.fileName}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {editMaterialInput.fileSize}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                            <Plus size={24} style={{ color: 'var(--text-secondary)' }} />
                            <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>
                              Drag & drop file here, or click to browse
                            </span>
                          </div>
                        )}
                      </div>

                      {editMaterialInput.previewUrl && (
                        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                          <div className="form-grid-2col" style={{ gap: '0.75rem' }}>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label className="input-label" style={{ fontSize: '0.7rem' }}>Material Title *</label>
                              <input 
                                type="text" 
                                value={editMaterialInput.title}
                                onChange={(e) => setEditMaterialInput({ ...editMaterialInput, title: e.target.value })}
                                className="input-field" 
                                placeholder="Material Title"
                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                              />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                              <label className="input-label" style={{ fontSize: '0.7rem' }}>Category *</label>
                              <select 
                                value={editMaterialInput.category || 'DSA Preparation'}
                                onChange={(e) => setEditMaterialInput({ ...editMaterialInput, category: e.target.value })}
                                className="input-field"
                                style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                              >
                                <option value="DSA Preparation">DSA Preparation</option>
                                <option value="Coding Questions">Coding Questions</option>
                                <option value="Technical Interview Preparation">Technical Interview Preparation</option>
                                <option value="Aptitude Preparation">Aptitude Preparation</option>
                                <option value="Company-Specific Preparation">Company-Specific Preparation</option>
                                <option value="Subject Notes">Subject Notes</option>
                                <option value="Interview Preparation PDFs">Interview Preparation PDFs</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                            <button
                              type="button"
                              onClick={() => setEditMaterialInput({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' })}
                              className="btn btn-secondary"
                              style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', borderRadius: '8px' }}
                            >
                              Clear File
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (editMaterialInput.title.trim()) {
                                  const newMaterial = {
                                    title: editMaterialInput.title.trim(),
                                    type: editMaterialInput.type,
                                    category: editMaterialInput.category || 'DSA Preparation',
                                    previewUrl: editMaterialInput.previewUrl,
                                    url: editMaterialInput.previewUrl,
                                    fileName: editMaterialInput.fileName || 'file.pdf',
                                    fileSize: editMaterialInput.fileSize || '1.0 MB'
                                  };
                                  setEditForm({ ...editForm, studyMaterials: [...editForm.studyMaterials, newMaterial] });
                                  setEditMaterialInput({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' });
                                } else {
                                  alert('Please provide a title');
                                }
                              }}
                              className="btn btn-primary"
                              style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem', borderRadius: '8px' }}
                            >
                              Add Material
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div className="form-grid-2col" style={{ gap: '0.75rem' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label" style={{ fontSize: '0.7rem' }}>Title *</label>
                          <input 
                            type="text"
                            className="input-field"
                            placeholder="e.g. Complete DSA Cheat Sheet"
                            value={materialLinkTitle}
                            onChange={(e) => setMaterialLinkTitle(e.target.value)}
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                          />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label" style={{ fontSize: '0.7rem' }}>Category *</label>
                          <select 
                            value={materialLinkCategory}
                            onChange={(e) => setMaterialLinkCategory(e.target.value)}
                            className="input-field"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                          >
                            <option value="DSA Preparation">DSA Preparation</option>
                            <option value="Coding Questions">Coding Questions</option>
                            <option value="Technical Interview Preparation">Technical Interview Preparation</option>
                            <option value="Aptitude Preparation">Aptitude Preparation</option>
                            <option value="Company-Specific Preparation">Company-Specific Preparation</option>
                            <option value="Subject Notes">Subject Notes</option>
                            <option value="Interview Preparation PDFs">Interview Preparation PDFs</option>
                          </select>
                        </div>
                      </div>

                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontSize: '0.7rem' }}>Google Drive Link / URL *</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <input 
                            type="url"
                            className="input-field"
                            placeholder="https://drive.google.com/... or https://..."
                            value={materialLinkUrl}
                            onChange={(e) => {
                              setMaterialLinkUrl(e.target.value);
                              setMaterialLinkError('');
                            }}
                            style={{ flexGrow: 1, padding: '0.5rem 0.75rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                          />
                          {materialLinkUrl && isValidUrl(materialLinkUrl) && (
                            <a 
                              href={materialLinkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-secondary"
                              style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
                            >
                              <ExternalLink size={13} />
                              <span>Test Link ↗</span>
                            </a>
                          )}
                        </div>
                        {materialLinkError && (
                          <span style={{ fontSize: '0.72rem', color: '#ff3b30', marginTop: '0.2rem' }}>{materialLinkError}</span>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!materialLinkTitle.trim()) {
                              setMaterialLinkError('Please enter a title for the material');
                              return;
                            }
                            if (!materialLinkUrl.trim() || !isValidUrl(materialLinkUrl.trim())) {
                              setMaterialLinkError('Please enter a valid HTTP or HTTPS link');
                              return;
                            }
                            const isDrive = materialLinkUrl.includes('drive.google.com') || materialLinkUrl.includes('docs.google.com');
                            const isPdf = materialLinkUrl.toLowerCase().endsWith('.pdf');
                            const newMat = {
                              title: materialLinkTitle.trim(),
                              type: isDrive ? 'Google Drive' : (isPdf ? 'PDF' : 'Link'),
                              category: materialLinkCategory,
                              fileName: materialLinkTitle.trim(),
                              fileSize: isDrive ? 'Google Drive Resource' : 'External Link',
                              url: materialLinkUrl.trim()
                            };
                            setEditForm({ ...editForm, studyMaterials: [...editForm.studyMaterials, newMat] });
                            setMaterialLinkTitle('');
                            setMaterialLinkUrl('');
                            setMaterialLinkError('');
                          }}
                          className="btn btn-primary"
                          style={{ padding: '0.45rem 1.25rem', fontSize: '0.8rem', borderRadius: '8px' }}
                        >
                          Add Material
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="btn btn-primary" 
                style={{ 
                  width: '100%', 
                  marginTop: '1rem', 
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1
                }}
              >
                {submitting ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <div style={{ position: 'relative', width: '24px', height: '24px' }}>
                      <svg width="24" height="24" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="rgba(255, 255, 255, 0.2)"
                          strokeWidth="3"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="15"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray="94.2"
                          strokeDashoffset={94.2 - (94.2 * uploadProgress) / 100}
                          strokeLinecap="round"
                          style={{ transition: 'stroke-dashoffset 0.1s ease-out' }}
                        />
                      </svg>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        fontWeight: 'bold',
                        color: 'currentColor'
                      }}>
                        {uploadProgress}%
                      </div>
                    </div>
                    <span>{uploadProgress === 100 ? 'Saving...' : 'Submitting...'}</span>
                  </div>
                ) : `Save Story Changes ${!isAdmin ? '(Submit for Approval)' : ''}`}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}



      {/* Media styling adjustments */}
      <style>{`
        .material-preview-img:hover {
          transform: scale(1.02);
        }
        @media (max-width: 768px) {
          header h1 {
            font-size: 2.25rem !important;
          }
          .story-header-flex {
            gap: 1.25rem !important;
            flex-direction: column;
            align-items: center;
            text-align: center;
          }
          main section {
            margin-bottom: 2.5rem !important;
          }
          main h2 {
            font-size: 1.5rem !important;
          }
        }
      `}</style>
    </>
  );
}
