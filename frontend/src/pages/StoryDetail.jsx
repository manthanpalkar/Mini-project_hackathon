import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Download, FileText, Award, Code, BookOpen, Layers, X, Edit, Trash2, Plus, 
  ExternalLink, Sparkles, CheckCircle2, Trophy, Medal, Lightbulb, Quote, Target, Cpu, 
  Users, MessageSquare, GraduationCap, 
  Rocket, Compass, Star, ArrowRight, UserCheck
} from 'lucide-react';
import { getStoryById, updateStory, deleteStory, addPendingStory, fileToBase64, resolveUrl, getResourceFileUrl } from '../utils/db';


// Intelligent parser for preparation strategy
function parsePrepContent(prepText) {
  if (!prepText || typeof prepText !== 'string') return { intro: '', items: [], takeaway: '' };

  let text = prepText.trim();
  text = text.replace(/^[📚📖🎯💡📌]\s*/u, '');

  let rawItems = [];
  let intro = '';
  let takeaway = '';

  if (text.includes('•')) {
    const parts = text.split('•').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const first = parts[0];
      const lastPeriodIdx = first.lastIndexOf('.');
      if (lastPeriodIdx !== -1 && lastPeriodIdx < first.length - 1) {
        intro = first.substring(0, lastPeriodIdx + 1).trim();
        const firstItem = first.substring(lastPeriodIdx + 1).trim();
        if (firstItem) rawItems.push(firstItem);
      } else if (first.length > 80 && (first.includes('strategy was') || first.includes('focused on') || first.includes('based on'))) {
        intro = first;
      } else {
        rawItems.push(first);
      }

      for (let i = 1; i < parts.length; i++) {
        const item = parts[i];
        if (i === parts.length - 1) {
          const sentences = item.match(/[^.!?]+[.!?]+/g) || [item];
          if (sentences.length > 1) {
            rawItems.push(sentences[0].trim());
            takeaway = sentences.slice(1).join(' ').trim();
          } else {
            rawItems.push(item);
          }
        } else {
          rawItems.push(item);
        }
      }
    } else {
      rawItems = parts;
    }
  } else if (text.includes('\n')) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    lines.forEach(line => {
      const cleaned = line.replace(/^[-*•\d.)\s]+/, '').trim();
      if (cleaned) rawItems.push(cleaned);
    });
  } else {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    if (sentences.length >= 3) {
      intro = sentences[0].trim();
      rawItems = sentences.slice(1, -1).map(s => s.trim());
      takeaway = sentences[sentences.length - 1].trim();
    } else {
      rawItems = sentences.map(s => s.trim());
    }
  }

  if (!takeaway && intro && (intro.includes('1%') || intro.includes('Small daily') || intro.includes('difference') || intro.includes('consistency'))) {
    takeaway = intro;
    intro = '';
  }

  const categorized = rawItems.map((item, idx) => {
    const lower = item.toLowerCase();
    let category = 'Study Discipline';
    let icon = CheckCircle2;
    let badgeColor = 'rgba(255, 255, 255, 0.08)';
    let textColor = 'var(--text-secondary)';
    let accentBorder = 'rgba(255, 255, 255, 0.12)';

    if (lower.includes('dsa') || lower.includes('leetcode') || lower.includes('algorithm') || lower.includes('striver') || lower.includes('tree') || lower.includes('graph') || lower.includes('dp') || lower.includes('neetcode')) {
      category = 'DSA & Problem Solving';
      icon = Code;
      badgeColor = 'rgba(16, 185, 129, 0.12)';
      textColor = '#10b981';
      accentBorder = 'rgba(16, 185, 129, 0.28)';
    } else if (lower.includes('dbms') || lower.includes('os') || lower.includes('cn') || lower.includes('oop') || lower.includes('sql') || lower.includes('operating system') || lower.includes('network') || lower.includes('core')) {
      category = 'Core CS Subjects';
      icon = Cpu;
      badgeColor = 'rgba(59, 130, 246, 0.12)';
      textColor = '#60a5fa';
      accentBorder = 'rgba(59, 130, 246, 0.28)';
    } else if (lower.includes('project') || lower.includes('resume') || lower.includes('full-stack') || lower.includes('built') || lower.includes('app') || lower.includes('portfolio') || lower.includes('crdt')) {
      category = 'Projects & Portfolio';
      icon = Layers;
      badgeColor = 'rgba(168, 85, 247, 0.12)';
      textColor = '#c084fc';
      accentBorder = 'rgba(168, 85, 247, 0.28)';
    } else if (lower.includes('mock') || lower.includes('interview') || lower.includes('round') || lower.includes('peer') || lower.includes('system design') || lower.includes('simulation')) {
      category = 'Mock Interviews';
      icon = UserCheck;
      badgeColor = 'rgba(245, 158, 11, 0.12)';
      textColor = '#fbbf24';
      accentBorder = 'rgba(245, 158, 11, 0.28)';
    } else if (lower.includes('communication') || lower.includes('presentation') || lower.includes('soft skill') || lower.includes('articulate') || lower.includes('english')) {
      category = 'Communication & Soft Skills';
      icon = MessageSquare;
      badgeColor = 'rgba(244, 63, 94, 0.12)';
      textColor = '#fb7185';
      accentBorder = 'rgba(244, 63, 94, 0.28)';
    } else if (lower.includes('senior') || lower.includes('mentor') || lower.includes('guidance') || lower.includes('learned from')) {
      category = 'Mentorship & Guidance';
      icon = GraduationCap;
      badgeColor = 'rgba(20, 184, 166, 0.12)';
      textColor = '#2dd4bf';
      accentBorder = 'rgba(20, 184, 166, 0.28)';
    }

    return {
      id: idx,
      text: item,
      category,
      icon,
      badgeColor,
      textColor,
      accentBorder
    };
  });

  return { intro, items: categorized, takeaway };
}

// 5-Stage Recruitment Roadmap Parser
function parseHowSecuredStages(howSecuredText, story) {
  const rawText = (howSecuredText || '').replace(/^[🏆🎉💼]\s*/u, '').trim();

  const stages = [
    {
      stageNumber: '01',
      title: 'Resume & Profile Preparation',
      subtitle: 'ATS-Friendly Formatting & Project Highlights',
      icon: FileText,
      accent: '#60a5fa',
      badgeBg: 'rgba(59, 130, 246, 0.12)',
      description: 'Carefully formatted standard tech resume, emphasized core projects with measurable impact, highlighted academic CGPA, and tailored skills specifically to the targeted job description.'
    },
    {
      stageNumber: '02',
      title: 'Company-Specific Technical Prep',
      subtitle: 'Core Concept Revision & Targeted Question Sets',
      icon: Cpu,
      accent: '#c084fc',
      badgeBg: 'rgba(168, 85, 247, 0.12)',
      description: 'Researched company culture, typical question styles, revised Operating Systems, DBMS indexing, Computer Networks, and practiced company-tagged DSA problems.'
    },
    {
      stageNumber: '03',
      title: 'Application & Online Screening',
      subtitle: 'Campus Drive Shortlisting & Timed Assessment',
      icon: Target,
      accent: '#fbbf24',
      badgeBg: 'rgba(245, 158, 11, 0.12)',
      description: 'Applied through college placement drive or verified referral. Cleared the initial CGPA cutoff and cracked the timed online assessment covering coding and analytical aptitude.'
    },
    {
      stageNumber: '04',
      title: 'Technical & Behavioral Interviews',
      subtitle: 'Live Problem-Solving & Thinking Aloud',
      icon: UserCheck,
      accent: '#10b981',
      badgeBg: 'rgba(16, 185, 129, 0.12)',
      description: 'Engaged with interviewers by explaining thought processes aloud, constructing clean algorithmic solutions, discussing system trade-offs, and demonstrating cultural alignment.'
    },
    {
      stageNumber: '05',
      title: 'Final Selection & Offer Rollout',
      subtitle: 'Evaluation, Verification & Full-Time Conversion',
      icon: Trophy,
      accent: '#D4FF32',
      badgeBg: 'rgba(212, 255, 50, 0.15)',
      description: 'Converted the recruitment process into a confirmed placement offer. Demonstrates how consistent daily effort over semesters produces exceptional career milestones.'
    }
  ];

  if (rawText) {
    const sentences = rawText.match(/[^.!?]+[.!?]+/g) || [rawText];
    sentences.forEach(s => {
      const sentence = s.trim();
      const lower = sentence.toLowerCase();
      if (lower.includes('resume') || lower.includes('portfolio') || lower.includes('highlighted my projects') || lower.includes('tailored')) {
        stages[0].description = sentence;
      } else if (lower.includes('before every interview') || lower.includes('researched the company') || lower.includes('revised important concepts') || lower.includes('practiced frequently')) {
        stages[1].description = sentence;
      } else if (lower.includes('applied') || lower.includes('shortlisted') || lower.includes('drive') || lower.includes('screening') || lower.includes('campus selection')) {
        stages[2].description = sentence;
      } else if (lower.includes('during interviews') || lower.includes('explained my thought process') || lower.includes('clear communication') || lower.includes('honesty') || lower.includes('interviews')) {
        stages[3].description = sentence;
      } else if (lower.includes('ultimately helped') || lower.includes('convert') || lower.includes('successful placement') || lower.includes('offer') || lower.includes('ppo')) {
        stages[4].description = sentence;
      }
    });
  }

  const rounds = story?.interviewRounds || null;
  return { stages, rawText, rounds };
}

// Advice to Juniors Parser
function parseAdviceContent(adviceText) {
  if (!adviceText || typeof adviceText !== 'string') return { tips: [], quote: '', raw: '' };

  let text = adviceText.trim().replace(/^💡\s*/, '');
  let quote = '';
  let tips = [];

  const quoteIndicators = ['most importantly', 'avoid comparing', 'trust the process', 'small efforts', 'compounding'];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const regularLines = [];
  const quoteLines = [];

  lines.forEach(line => {
    const lower = line.toLowerCase();
    const isQuoteLike = quoteIndicators.some(qi => lower.includes(qi));
    if (isQuoteLike || quoteLines.length > 0) {
      quoteLines.push(line);
    } else {
      regularLines.push(line);
    }
  });

  if (quoteLines.length > 0) {
    quote = quoteLines.join(' ');
  }

  const tipIcons = [
    { icon: Target, title: 'Start Preparation Early', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' },
    { icon: Compass, title: 'Consistency Over Intensity', color: '#60a5fa', bg: 'rgba(59, 130, 246, 0.12)' },
    { icon: Code, title: 'Build Meaningful Projects', color: '#c084fc', bg: 'rgba(168, 85, 247, 0.12)' },
    { icon: Cpu, title: 'Master Core CS & DSA', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)' },
    { icon: Trophy, title: 'Participate in Hackathons', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.12)' },
    { icon: Users, title: 'Network with SPIT Seniors', color: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.12)' },
    { icon: FileText, title: 'Maintain ATS-Ready Resume', color: '#f43f5e', bg: 'rgba(244, 63, 94, 0.12)' },
    { icon: MessageSquare, title: 'Hone Articulate Communication', color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.12)' }
  ];

  regularLines.forEach((line, idx) => {
    const cleaned = line.replace(/^[-*•\d.)\s]+/, '').trim();
    if (!cleaned) return;

    const lower = cleaned.toLowerCase();
    let matchedIcon = tipIcons[idx % tipIcons.length];

    if (lower.includes('early') || lower.includes("don't wait") || lower.includes('wait until')) {
      matchedIcon = tipIcons[0];
    } else if (lower.includes('consistent') || lower.includes('daily')) {
      matchedIcon = tipIcons[1];
    } else if (lower.includes('project') || lower.includes('build')) {
      matchedIcon = tipIcons[2];
    } else if (lower.includes('dsa') || lower.includes('code') || lower.includes('practice')) {
      matchedIcon = tipIcons[3];
    } else if (lower.includes('hackathon') || lower.includes('competition')) {
      matchedIcon = tipIcons[4];
    } else if (lower.includes('senior') || lower.includes('network') || lower.includes('alumni')) {
      matchedIcon = tipIcons[5];
    } else if (lower.includes('resume') || lower.includes('ats')) {
      matchedIcon = tipIcons[6];
    } else if (lower.includes('communication') || lower.includes('presentation') || lower.includes('speak')) {
      matchedIcon = tipIcons[7];
    }

    tips.push({
      number: String(idx + 1).padStart(2, '0'),
      text: cleaned,
      title: matchedIcon.title,
      icon: matchedIcon.icon,
      color: matchedIcon.color,
      bg: matchedIcon.bg
    });
  });

  if (!quote && tips.length === 0 && text) {
    quote = text;
  } else if (!quote) {
    quote = "Most importantly, avoid comparing your journey with others. Everyone progresses at a different pace. Focus on learning, improving, and staying disciplined. Small efforts repeated daily can create extraordinary results over four years.";
  }

  return { tips, quote, raw: text };
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

export default function StoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTimelineYear, setActiveTimelineYear] = useState(1);
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeSection, setActiveSection] = useState('section-journey');
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

      // 2. Quick navigation section spy
      const sections = [
        'section-journey',
        'section-prep',
        'section-projects',
        'section-secured',
        'section-advice',
        'section-hackathons',
        'section-takeaways',
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

      // 3. 4-Year Journey milestone spy
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
    setLoading(true);
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
  const currentUser = userSession ? JSON.parse(userSession) : null;
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

  const startEdit = () => {
    setEditForm({
      name: story.name || '',
      company: story.company || '',
      role: story.role || '',
      branch: story.branch || 'CSE',
      passoutYear: story.passoutYear || '',
      semester: story.semester || '',
      cgpa: story.cgpa || '',
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
      resume: story.resumeFile || story.resume || ''
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

  // Format multi-line projects list into modern visual cards
  const formatProjects = (projectsString) => {
    if (!projectsString) return null;
    const lines = projectsString.split('\n').map(l => l.trim()).filter(Boolean);
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
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
              className="editorial-card"
              style={{
                padding: '1.25rem 1.4rem',
                borderRadius: '14px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                  <h4 style={{ fontSize: '1.02rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {title}
                  </h4>
                </div>
                <span className="badge" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  Highlight
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {desc}
              </p>
            </div>
          );
        })}
      </div>
    );
  };

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
                {story.branch} {story.subBranch && `(${story.subBranch})`}
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
              Semester Placed
            </p>
            <p style={{ fontWeight: 600, fontSize: '1rem' }}>Semester {story.semester}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              CGPA
            </p>
            <p style={{ fontWeight: 600, fontSize: '1rem' }}>{story.cgpa || 'N/A'}</p>
          </div>
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
        </div>
      </header>

      {/* Sticky Table of Contents & Quick Navigation Pill Bar */}
      {(() => {
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

        const navSections = [
          ...(availableMilestones.length > 0 ? [{ id: 'section-journey', label: 'College Journey', icon: Compass }] : []),
          { id: 'section-prep', label: 'Prep Strategy', icon: Award },
          ...(story?.journey?.projects ? [{ id: 'section-projects', label: 'Projects', icon: Code }] : []),
          { id: 'section-secured', label: 'How Secured', icon: Layers },
          ...(story?.customSections?.some(s => s.title && s.title.toLowerCase().includes('advice')) ? [{ id: 'section-advice', label: 'Advice', icon: Lightbulb }] : []),
          ...(story?.customSections?.some(s => s.title && (s.title.toLowerCase().includes('hackathon') || s.title.toLowerCase().includes('competition'))) ? [{ id: 'section-hackathons', label: 'Hackathons', icon: Trophy }] : []),
          { id: 'section-takeaways', label: 'Key Takeaways', icon: Sparkles },
          ...(story?.resources && story.resources.length > 0 ? [{ id: 'section-resources', label: 'Resources', icon: BookOpen }] : []),
          { id: 'section-resume', label: 'Resume', icon: FileText }
        ];

        return (
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
        );
      })()}

      {/* Main Notion-Style Reading Block */}
      <main style={{ fontFamily: 'var(--font-sans)' }}>
        
        {/* Intro Highlight (Notion Callout) */}
        <div className="glass-panel" style={{
          padding: '1.25rem 1.75rem',
          borderRadius: '16px',
          marginBottom: '2.25rem',
          borderLeft: '4px solid var(--text-primary)',
          fontSize: '1.05rem',
          lineHeight: '1.7',
          color: 'var(--text-secondary)',
          fontStyle: 'italic'
        }}>
          "My biggest advice to SPIT juniors is to stay consistent. Don't wait for companies to arrive. Start building projects in your second year and begin coding practice daily. Your hard work will compounding."
        </div>

        {/* 4-Year Journey Timeline - Only rendered when genuine academic year milestones exist */}
        {(() => {
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

          if (availableMilestones.length === 0) return null;

          return (
            <section id="section-journey" style={{ marginBottom: '2.75rem', scrollMarginTop: '110px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2.5rem' }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.25rem 0.75rem', borderRadius: '20px', backgroundColor: 'rgba(212, 255, 50, 0.25)', border: '1px solid rgba(212, 255, 50, 0.45)', color: 'var(--text-primary)', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                    <Sparkles size={12} color="var(--accent-lime-dark)" />
                    Curated Roadmaps
                  </div>
                  <h2 style={{ fontSize: '2.1rem', fontWeight: 800, margin: '0 0 0.4rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                    College Academic Milestones
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
                    Chronological academic milestones and technical progression through college
                  </p>
                </div>
              </div>

              {/* Timeline Track with Vertical Rail Matching Image 4 */}
              <div style={{ position: 'relative', paddingLeft: '2.75rem' }}>
                {/* The vertical line running down the rail */}
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
                        {/* Node on the rail matching Image 4 */}
                        {isActive ? (
                          /* Active Node: ◉ double concentric ring / solid center */
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
                          /* Inactive Node: ○ clean hollow ring with border */
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

                        {/* Bento Card for the milestone (Matching Image 3 & 4) */}
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
                            {/* Top Header Row */}
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

                            {/* Middle Content Row: Full Width Editorial Text */}
                            <div>
                              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.65rem', color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                                {milestone.yearTitle}
                              </h3>
                              <p style={{ color: 'var(--text-secondary)', fontSize: '1.02rem', lineHeight: '1.75', margin: 0 }}>
                                {milestone.content}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })()}

        {/* Preparation Strategy & Study Routine */}
        <section id="section-prep" style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', color: '#10b981', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                <Award size={13} />
                Daily Regimen & Milestones
              </div>
              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Award size={22} style={{ color: 'var(--text-primary)' }} />
                Preparation Strategy & Study Routine
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
                Structured study hours, DSA problem-solving techniques, and core subjects revision
              </p>
            </div>
          </div>

          {(() => {
            const { intro, items, takeaway } = parsePrepContent(story.journey?.prep);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {intro && (
                  <p style={{ fontSize: '1.02rem', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                    {intro}
                  </p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  {items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="editorial-card"
                        style={{
                          padding: '1.25rem',
                          borderRadius: '14px',
                          border: `1px solid ${item.accentBorder || 'var(--border-color)'}`,
                          backgroundColor: 'var(--bg-surface)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.75rem',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              padding: '0.2rem 0.55rem',
                              borderRadius: '8px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              backgroundColor: item.badgeColor,
                              color: item.textColor
                            }}
                          >
                            <ItemIcon size={12} />
                            {item.category}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            #{String(item.id + 1).padStart(2, '0')}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.96rem', color: 'var(--text-primary)', lineHeight: 1.6, fontWeight: 500 }}>
                          {item.text}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {takeaway && (
                  <div
                    style={{
                      marginTop: '0.5rem',
                      padding: '1.25rem 1.5rem',
                      borderRadius: '14px',
                      backgroundColor: 'rgba(16, 185, 129, 0.05)',
                      border: '1px solid rgba(16, 185, 129, 0.28)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '1rem'
                    }}
                  >
                    <div
                      style={{
                        padding: '0.5rem',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        flexShrink: 0
                      }}
                    >
                      <Lightbulb size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#10b981', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                        Key Takeaway
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-secondary)', lineHeight: 1.65, fontStyle: 'italic' }}>
                        "{takeaway}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </section>

        {/* Projects Built */}
        {story.journey?.projects && (
          <section id="section-projects" style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.25)', color: '#c084fc', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                <Code size={13} />
                Technical Proof of Work
              </div>
              <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Code size={22} style={{ color: 'var(--text-primary)' }} />
                Key Projects Built
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
                Practical systems, open-source repositories, and portfolio work showcased in interviews
              </p>
            </div>
            {formatProjects(story.journey?.projects)}
          </section>
        )}

        {/* The Recruitment Process */}
        <section id="section-secured" style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', color: '#60a5fa', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <Layers size={13} />
              Recruitment Process Flow
            </div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Layers size={22} style={{ color: 'var(--text-primary)' }} />
              How I Secured the Role
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
              End-to-end placement journey broken into a 5-stage visual recruitment roadmap
            </p>
          </div>

          {(() => {
            const { stages, rounds } = parseHowSecuredStages(story.journey?.howSecured, story);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* 5-Stage Visual Roadmap */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {stages.map((stg, sIdx) => {
                    const StageIcon = stg.icon;
                    return (
                      <div
                        key={sIdx}
                        className="editorial-card"
                        style={{
                          padding: '1.35rem 1.5rem',
                          borderRadius: '16px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-surface)',
                          position: 'relative',
                          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.1rem' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '12px',
                              backgroundColor: stg.badgeBg,
                              color: stg.accent,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.95rem',
                              flexShrink: 0,
                              border: `1px solid ${stg.accent}33`
                            }}
                          >
                            <StageIcon size={20} />
                          </div>

                          <div style={{ flexGrow: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: stg.accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                  Stage {stg.stageNumber}
                                </span>
                                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                                  {stg.title}
                                </h3>
                              </div>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                {stg.subtitle}
                              </span>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.98rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                              {stg.description}
                            </p>

                            {stg.stageNumber === '04' && rounds && (
                              <div style={{ marginTop: '0.9rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)' }}>
                                {rounds.onlineAssessment && (
                                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '85px' }}>Round 1 (OA):</span>
                                    <span>{rounds.onlineAssessment}</span>
                                  </div>
                                )}
                                {rounds.technicalRounds && (
                                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '85px' }}>Technical:</span>
                                    <span>{rounds.technicalRounds}</span>
                                  </div>
                                )}
                                {rounds.hrRound && (
                                  <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', gap: '0.5rem' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', minWidth: '85px' }}>HR / Fitment:</span>
                                    <span>{rounds.hrRound}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(212, 255, 50, 0.05)',
                    border: '1px solid rgba(212, 255, 50, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}
                >
                  <Sparkles size={22} color="var(--accent-lime-dark)" style={{ flexShrink: 0 }} />
                  <div>
                    <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Senior's Interview Strategy
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.94rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      "Even when I did not know an exact answer immediately, I explained my thought process aloud with structured honesty. Interviewers evaluate how you navigate ambiguity."
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Custom Prompts / Sections: Advice, Hackathons & Others */}
        {story.customSections && story.customSections.map((sec, index) => {
          const lowerTitle = (sec.title || '').toLowerCase();
          const isAdvice = lowerTitle.includes('advice');
          const isHackathon = lowerTitle.includes('hackathon') || lowerTitle.includes('competition');

          if (isAdvice) {
            const { tips, quote } = parseAdviceContent(sec.content);
            return (
              <section key={index} id="section-advice" style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', color: '#fbbf24', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                    <Lightbulb size={13} />
                    Guidance For SPIT Juniors
                  </div>
                  <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Lightbulb size={22} style={{ color: 'var(--text-primary)' }} />
                    Advice to Juniors
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
                    Practical tips, habits, and mindset shifts to maximize your 4 engineering years
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {tips.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
                      {tips.map((tip, tIdx) => {
                        const TipIcon = tip.icon;
                        return (
                          <div
                            key={tIdx}
                            className="editorial-card"
                            style={{
                              padding: '1.25rem',
                              borderRadius: '14px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.65rem',
                              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                                <div style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '8px',
                                  backgroundColor: tip.bg,
                                  color: tip.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  <TipIcon size={14} />
                                </div>
                                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: tip.color, letterSpacing: '0.04em' }}>
                                  TIP {tip.number}
                                </span>
                              </div>
                            </div>
                            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                              {tip.text}
                            </h4>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {quote && (
                    <div
                      className="editorial-card"
                      style={{
                        padding: '1.75rem 2rem',
                        borderRadius: '18px',
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08)',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '15px',
                        fontSize: '6rem',
                        color: 'rgba(16, 185, 129, 0.06)',
                        fontFamily: 'var(--font-serif)',
                        pointerEvents: 'none',
                        lineHeight: 1
                      }}>
                        “
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '20px',
                          backgroundColor: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em'
                        }}>
                          <Quote size={12} />
                          Senior's Golden Rule
                        </span>
                      </div>

                      <p style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.12rem',
                        color: 'var(--text-primary)',
                        lineHeight: 1.75,
                        fontWeight: 500,
                        fontStyle: 'italic'
                      }}>
                        "{quote}"
                      </p>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>— {story.name}</span>
                        <span>•</span>
                        <span>{story.role} at {story.company}</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            );
          }

          if (isHackathon) {
            const { intro, achievements, skills, impact } = parseHackathonContent(sec.content);
            return (
              <section key={index} id="section-hackathons" style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(212, 255, 50, 0.15)', border: '1px solid rgba(212, 255, 50, 0.35)', color: 'var(--accent-lime-dark)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
                    <Trophy size={13} />
                    Competitive Building
                  </div>
                  <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <Trophy size={22} style={{ color: 'var(--text-primary)' }} />
                    Hackathons & Competitions
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
                    Real-world prototyping, high-intensity hackathons, and verifiable technical achievements
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {intro && (
                    <p style={{ margin: 0, fontSize: '1.02rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                      {intro}
                    </p>
                  )}

                  {achievements.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                      {achievements.map((ach) => {
                        const AchIcon = ach.icon;
                        return (
                          <div
                            key={ach.id}
                            className="editorial-card"
                            style={{
                              padding: '1.25rem',
                              borderRadius: '14px',
                              border: '1px solid var(--border-color)',
                              backgroundColor: 'var(--bg-surface)',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.9rem',
                              transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
                            }}
                          >
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              backgroundColor: ach.badgeColor,
                              color: ach.textColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              <AchIcon size={18} />
                            </div>
                            <div style={{ flexGrow: 1 }}>
                              <span style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 700, color: ach.textColor, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                                {ach.badgeText}
                              </span>
                              <p style={{ margin: 0, fontSize: '0.96rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                {ach.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {skills.length > 0 && (
                    <div
                      className="editorial-card"
                      style={{
                        padding: '1.25rem 1.5rem',
                        borderRadius: '14px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-surface)'
                      }}
                    >
                      <h4 style={{ margin: '0 0 0.85rem 0', fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                        Core Skills Gained Under Tight Deadlines
                      </h4>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                        {skills.map((sk, skIdx) => {
                          const SkIcon = sk.icon;
                          return (
                            <div
                              key={skIdx}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.45rem',
                                padding: '0.45rem 0.85rem',
                                borderRadius: '10px',
                                backgroundColor: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.85rem',
                                fontWeight: 600,
                                color: 'var(--text-primary)'
                              }}
                              title={sk.desc}
                            >
                              <SkIcon size={14} style={{ color: 'var(--text-secondary)' }} />
                              <span>{sk.name}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {impact && (
                    <div
                      style={{
                        padding: '1.2rem 1.5rem',
                        borderRadius: '14px',
                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem'
                      }}
                    >
                      <Medal size={20} color="#fbbf24" style={{ flexShrink: 0 }} />
                      <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {impact}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            );
          }

          return (
            <section key={index} style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
              <div style={{ marginBottom: '1.25rem' }}>
                <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <Award size={22} style={{ color: 'var(--text-primary)' }} />
                  {sec.title}
                </h2>
              </div>
              <div
                className="editorial-card"
                style={{
                  padding: '1.5rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.02rem', lineHeight: '1.75', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {sec.content}
                </p>
              </div>
            </section>
          );
        })}

        {/* Key Takeaways Summary Section */}
        <section id="section-takeaways" style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0.65rem', borderRadius: '16px', backgroundColor: 'rgba(212, 255, 50, 0.15)', border: '1px solid rgba(212, 255, 50, 0.35)', color: 'var(--accent-lime-dark)', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
              <Sparkles size={13} />
              Executive Summary
            </div>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, margin: '0 0 0.35rem 0', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <Sparkles size={22} style={{ color: 'var(--text-primary)' }} />
              Key Takeaways
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.98rem', margin: 0 }}>
              The essential principles behind {story.name}'s placement success at {story.company}
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div
              className="editorial-card"
              style={{
                padding: '1.35rem',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.12)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Target size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Preparation Formula
              </h4>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Daily compounding over last-minute cramming. Prioritize Striver SDE sheets, core OS/DBMS fundamentals, and continuous mock interview practice.
              </p>
            </div>

            <div
              className="editorial-card"
              style={{
                padding: '1.35rem',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#60a5fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Interview Execution
              </h4>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Articulate thought processes aloud before coding. Interviewers look for structured problem-solving, honesty on unknowns, and robust communication.
              </p>
            </div>

            <div
              className="editorial-card"
              style={{
                padding: '1.35rem',
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(212, 255, 50, 0.15)', color: 'var(--accent-lime-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Compass size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Growth Mindset
              </h4>
              <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Avoid comparing yourself to peers. Focus on your unique engineering progression, build real projects, and trust the 4-year journey.
              </p>
            </div>
          </div>
        </section>

        {/* Resources Used List */}
        {story.resources && story.resources.length > 0 && (
          <section id="section-resources" style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, marginBottom: '1.25rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <BookOpen size={22} style={{ color: 'var(--text-primary)' }} />
              Resources Used
            </h2>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {story.resources.map((res, index) => {
                const targetUrl = getResourceLink(res) || `https://www.google.com/search?q=${encodeURIComponent((res.name || 'study material') + ' preparation')}`;
                return (
                  <a
                    key={index}
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-panel"
                    title={`Open ${res.name} in a new tab`}
                    style={{
                      padding: '0.75rem 1.25rem',
                      borderRadius: '12px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.55rem',
                      fontSize: '0.9rem',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      textDecoration: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      maxWidth: '100%',
                      overflowWrap: 'anywhere',
                      boxShadow: 'var(--card-shadow)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--text-primary)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{res.name}</span>
                    {res.type && (
                      <span className="badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: '6px' }}>
                        {res.type}
                      </span>
                    )}
                    <ExternalLink size={13} style={{ color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '0.2rem' }} />
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Resume Preview & Download Section */}
        <section id="section-resume" style={{ marginBottom: '2.75rem', paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
          <h2 style={{ fontSize: '1.9rem', fontWeight: 800, marginBottom: '1.25rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <FileText size={22} style={{ color: 'var(--text-primary)' }} />
            Resume
          </h2>

          <div className="loop-card" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1.5rem 2rem',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                padding: '0.75rem',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                color: 'var(--text-primary)'
              }}>
                <FileText size={28} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  {typeof story.resume === 'object' ? story.resume.fileName : story.resume}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Approved standard format resume (PDF)</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button 
                onClick={() => {
                  const allFiles = getStoryFiles();
                  const resumeDoc = allFiles[0];
                  navigate(`/preview/${resumeDoc.id}?storyId=${story.id}`, {
                    state: {
                      file: resumeDoc,
                      files: allFiles,
                      storyTitle: story.name
                    }
                  });
                }}
                className="btn btn-secondary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', gap: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="View Resume"
              >
                <FileText size={14} />
                <span>View Resume</span>
              </button>
              <button 
                onClick={() => {
                  const rf = story.resumeFile;
                  if (rf?.url && rf.url !== '#') {
                    if (rf.url.startsWith('data:')) {
                      const blob = dataURItoBlob(rf.url);
                      if (blob) {
                        const blobUrl = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = blobUrl;
                        link.download = rf.fileName || 'resume.pdf';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
                      } else {
                        alert('Failed to process resume file.');
                      }
                    } else {
                      const link = document.createElement('a');
                      link.href = rf.url;
                      link.download = rf.fileName || 'resume.pdf';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }
                  } else {
                    alert('No resume file was uploaded for this story.');
                  }
                }}
                className="btn btn-primary"
                style={{ padding: '0.6rem 1.2rem', fontSize: '0.85rem', gap: '0.4rem' }}
              >
                <Download size={14} />
                <span>Download Resume</span>
              </button>
            </div>
          </div>

        </section>

        {/* Study Materials Uploaded Section */}
        {story.studyMaterials && story.studyMaterials.length > 0 && (
          <section id="section-materials" style={{ paddingTop: '1.75rem', borderTop: '1px solid var(--border-color)', scrollMarginTop: '110px' }}>
            <h2 style={{ fontSize: '1.9rem', fontWeight: 800, marginBottom: '1.25rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <BookOpen size={22} style={{ color: 'var(--text-primary)' }} />
              Study Materials Uploaded
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.25rem'
            }}>
              {story.studyMaterials.map((mat, index) => {
                const isImage = mat.type === 'Image' && mat.url && mat.url !== '#';
                if (isImage) {
                  return (
                    <div key={index} className="glass-panel" style={{
                      padding: '1.25rem',
                      borderRadius: '16px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                            {mat.title}
                          </h4>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span className="badge" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>
                              {mat.type}
                            </span>
                            {mat.fileSize && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                {mat.fileSize}
                              </span>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            if (mat.url && mat.url !== '#') {
                              handleDownloadFile(mat.fileName || mat.title + '.png', mat.url);
                            } else {
                              alert('No image file available.');
                            }
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                          title="Download Image"
                        >
                          <Download size={12} />
                        </button>
                      </div>
 
                      <div 
                        onClick={() => {
                          const allFiles = getStoryFiles();
                          const matDoc = allFiles[index + 1] || { ...mat, id: `mat-${story.id}-${index}`, type: 'Image' };
                          navigate(`/preview/${matDoc.id}?storyId=${story.id}`, {
                            state: {
                              file: matDoc,
                              files: allFiles,
                              storyTitle: story.name
                            }
                          });
                        }}
                        style={{ 
                          width: '100%', 
                          height: '160px', 
                          borderRadius: '8px', 
                          overflow: 'hidden', 
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          backgroundColor: 'var(--bg-primary)',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          position: 'relative'
                        }}
                      >
                        <img 
                          src={mat.url} 
                          alt={mat.title} 
                          style={{ height: '100%', width: '100%', objectFit: 'contain', transition: 'transform 0.2s' }}
                          className="material-preview-img"
                        />
                        <div style={{
                          position: 'absolute',
                          bottom: '0.5rem',
                          right: '0.5rem',
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.65rem',
                          fontWeight: 500
                        }}>
                          Click to Expand
                        </div>
                      </div>
                    </div>
                  );
                }
 
                return (
                  <div key={index} className="glass-panel" style={{
                    padding: '1.25rem',
                    borderRadius: '16px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ 
                        width: '40px', 
                        height: '50px', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '6px', 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        backgroundColor: mat.type === 'PDF' ? '#ffe5e5' : '#e5f1ff', 
                        color: mat.type === 'PDF' ? '#ff3b30' : '#007aff', 
                        fontWeight: 'bold', 
                        fontSize: '0.7rem' 
                      }}>
                        {mat.type}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: '1.3', marginBottom: '0.25rem' }}>
                          {mat.title}
                        </h4>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span className="badge" style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                            {mat.type}
                          </span>
                          {mat.fileSize && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              {mat.fileSize}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
 
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                        style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                        title="View File"
                      >
                        <FileText size={14} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>View File</span>
                      </button>
                      {mat.url && mat.url !== '#' && (
                        <button 
                          onClick={() => {
                            handleDownloadFile(mat.fileName || mat.title + (mat.type === 'PDF' ? '.pdf' : '.txt'), mat.url);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', width: '32px', height: '32px' }}
                          title="Download File"
                        >
                          <Download size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
                    <option value="IT">IT</option>
                    <option value="EXTC">EXTC</option>
                    <option value="AI & DS">AI & DS</option>
                  </select>
                </div>
              </div>

              <div className="form-grid-3col" style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
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
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  Senior Resume File
                </h4>
                
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
                            {typeof editForm.resume === 'object' ? editForm.resume.fileSize : '1.2 MB'}
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
              </div>

              {/* Study Materials Section in Edit Modal */}
              <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginBottom: '1.5rem', textAlign: 'left' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                  Study Materials / Files
                </h4>
                
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
                              {material.type} {material.fileName ? `• ${material.fileName}` : ''}
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
                    Add Study Material
                  </h5>
                  
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
                          <label className="input-label" style={{ fontSize: '0.7rem' }}>File Type *</label>
                          <select 
                            value={editMaterialInput.type}
                            onChange={(e) => setEditMaterialInput({ ...editMaterialInput, type: e.target.value })}
                            className="input-field"
                            style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', backgroundColor: 'var(--bg-primary)' }}
                          >
                            <option value="PDF">PDF Document</option>
                            <option value="Image">Image Roadmap</option>
                            <option value="Notes">Notes File</option>
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
