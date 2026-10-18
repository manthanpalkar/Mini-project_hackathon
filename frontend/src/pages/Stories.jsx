import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Filter, Upload, X, ArrowRight, Plus, Briefcase, CheckCircle, FileText, Search, Calendar,
  Compass, Award, Code, Layers, Sparkles, BookOpen, Trophy, Lightbulb, RotateCcw
} from 'lucide-react';
import { getStories, addPendingStory, fileToBase64 } from '../utils/db';
import { useCachedData } from '../hooks/useCachedData';
import { useUpload } from '../context/UploadContext';

function formatStoryDate(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  } catch (e) {}
  return null;
}

function Story3DCard({ story, index, navigate }) {
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0, active: false });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const animFrameRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    if (animFrameRef.current) return;

    const clientX = e.clientX;
    const clientY = e.clientY;

    animFrameRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) {
        animFrameRef.current = null;
        return;
      }
      const rect = cardRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -4.5;
      const rotateY = ((x - centerX) / centerX) * 4.5;
      setTilt({ x: rotateX, y: rotateY, active: true });
      animFrameRef.current = null;
    });
  };

  const handleMouseLeave = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setTilt({ x: 0, y: 0, active: false });
  };

  const formattedDate = formatStoryDate(story.createdAt || story.date);
  const isRecent = (() => {
    if (!story.createdAt && !story.date) return false;
    const time = new Date(story.createdAt || story.date).getTime();
    return Date.now() - time < 14 * 24 * 60 * 60 * 1000;
  })();

  const transformStyle = isVisible
    ? tilt.active
      ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-6px) scale(1.015)`
      : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)'
    : 'perspective(1000px) rotateX(12deg) translateY(45px) scale(0.96)';

  return (
    <div
      ref={cardRef}
      className="bento-card loop-card"
      onClick={() => navigate(`/stories/${story.id}`)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        padding: '1.75rem 2rem',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        minHeight: '140px',
        position: 'relative',
        border: '1px solid var(--border-color)',
        borderRadius: '24px',
        backgroundColor: 'var(--bg-surface)',
        boxShadow: tilt.active
          ? '0 24px 50px -10px rgba(0, 0, 0, 0.35), 0 0 1px 1px rgba(255, 255, 255, 0.15) inset'
          : 'var(--card-shadow)',
        gap: '2rem',
        flexWrap: 'wrap',
        cursor: 'pointer',
        transform: transformStyle,
        opacity: isVisible ? 1 : 0,
        transition: tilt.active
          ? 'transform 0.12s ease-out, box-shadow 0.25s ease, border-color 0.25s ease'
          : 'transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.65s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.35s ease, border-color 0.25s ease',
        transformStyle: 'preserve-3d',
        willChange: 'transform, opacity'
      }}
    >
      <div style={{ flexGrow: 1, minWidth: '260px' }}>
        {/* Top Chips Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
          <span
            style={{
              backgroundColor: 'rgba(212, 255, 50, 0.22)',
              border: '1px solid rgba(212, 255, 50, 0.45)',
              color: 'var(--text-primary)',
              padding: '0.2rem 0.65rem',
              borderRadius: '12px',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}
          >
            {story.company}
          </span>
          <span className="badge" style={{ fontSize: '0.68rem', borderRadius: '10px' }}>
            {story.branch} {story.subBranch && `(${story.subBranch})`}
          </span>
          <span className="badge" style={{ fontSize: '0.68rem', borderRadius: '10px' }}>
            Class of {story.passoutYear}
          </span>
          {formattedDate && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              fontSize: '0.7rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.2rem 0.6rem'
            }}>
              <Calendar size={12} style={{ color: 'var(--text-secondary)' }} />
              <span>{formattedDate}</span>
            </span>
          )}
          {isRecent && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
              fontSize: '0.68rem',
              fontWeight: 800,
              color: '#30d158',
              backgroundColor: 'rgba(48, 209, 88, 0.12)',
              border: '1px solid rgba(48, 209, 88, 0.3)',
              borderRadius: '10px',
              padding: '0.15rem 0.55rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#30d158', display: 'inline-block' }} />
              New
            </span>
          )}
        </div>

        {/* Candidate Name */}
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', lineHeight: 1.15, letterSpacing: '-0.02em', margin: '0 0 0.4rem 0' }}>
          {story.name}
        </h2>

        {/* Role & Company */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Briefcase size={14} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {story.role}
          </span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>•</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Semester {story.semester} Placed
          </span>
          {story.cgpa && (
            <>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>•</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                CGPA {story.cgpa}
              </span>
            </>
          )}
        </div>

        {/* Metric Bar */}
        <div style={{ maxWidth: '380px', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
            <span>4-Year Roadmap & Preparation</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Complete</span>
          </div>
          <div style={{ height: '5px', width: '100%', backgroundColor: 'var(--bg-tertiary)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '100%', backgroundColor: 'var(--text-primary)', borderRadius: '999px' }} />
          </div>
        </div>
      </div>

      {/* Action button */}
      <div style={{ flexShrink: 0 }}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/stories/${story.id}`);
          }}
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1.4rem',
            borderRadius: '999px',
            border: '1px solid var(--border-color)',
            fontSize: '0.88rem',
            fontWeight: 700,
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
          }}
        >
          <span>Read Journey</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

export default function Stories() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Load initial branch filter from URL or location state
  const paramBranch = searchParams.get('branch');
  const initialBranch = paramBranch || location.state?.initialBranch || 'ALL';

  const userSession = localStorage.getItem('loop_current_user');
  const currentUser = userSession ? JSON.parse(userSession) : null;

  const { data: cachedStories, loading } = useCachedData('stories', getStories);
  const stories = cachedStories || [];
  const [selectedBranches, setSelectedBranchesState] = useState(
    initialBranch === 'ALL' ? ['CSE', 'CE', 'EXTC'] : [initialBranch]
  );

  const setSelectedBranches = (branches) => {
    setSelectedBranchesState(branches);
    setSearchParams(prev => {
      const n = new URLSearchParams(prev);
      if (branches.length === 1) n.set('branch', branches[0]);
      else n.delete('branch');
      return n;
    });
  };

  const [selectedSubBranches, setSelectedSubBranches] = useState(['CSE', 'AI', 'DS']);
  const [minYear, setMinYear] = useState('ALL');
  const [maxYear, setMaxYear] = useState('ALL');
  const [maxCGPA, setMaxCGPA] = useState(10.0);
  const yearOptions = ['ALL', ...Array.from({ length: 36 }, (_, i) => 2000 + i)];
  const [inputValue, setInputValue] = useState(searchParams.get('q') || '');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { startStoryUpload } = useUpload();

  useEffect(() => {
    const handleStorySubmitted = () => {
      if (typeof mutate === 'function') mutate();
    };
    window.addEventListener('loop_story_submitted', handleStorySubmitted);
    return () => window.removeEventListener('loop_story_submitted', handleStorySubmitted);
  }, [mutate]);
  
  // Modal states synced with URL & location.state
  const [isModalOpen, setIsModalOpenState] = useState(
    searchParams.get('upload') === 'true' || !!location.state?.openUploadModal
  );

  const setIsModalOpen = (open) => {
    setIsModalOpenState(open);
    if (!open) {
      if (location.state?.openUploadModal) {
        navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} });
      }
      setSearchParams(prev => {
        const n = new URLSearchParams(prev);
        n.delete('upload');
        return n;
      }, { replace: true });
    } else {
      setSearchParams(prev => {
        const n = new URLSearchParams(prev);
        n.set('upload', 'true');
        return n;
      }, { replace: true });
    }
  };

  useEffect(() => {
    if (searchParams.get('upload') === 'true') {
      setIsModalOpenState(true);
    }
  }, [searchParams]);

  useEffect(() => {
    document.title = 'LOOP | Senior Placement Stories';
  }, []);

  // Handle Escape key and lock background scroll when Share Your Story modal is active
  useEffect(() => {
    if (isModalOpen) {
      const prevBodyOverflow = document.body.style.overflow;
      const prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';

      const handleKeyDown = (e) => {
        if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
          e.preventDefault();
          e.stopPropagation();
          setIsModalOpen(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown, true);

      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
        window.removeEventListener('keydown', handleKeyDown, true);
      };
    }
  }, [isModalOpen]);

  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    branch: 'CSE',
    subBranch: 'CSE',
    passoutYear: '2026',
    company: '',
    role: '',
    semester: '7',
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
    resources: [],
    studyMaterials: []
  });

  // Resource input state
  const [resourceInput, setResourceInput] = useState({ name: '', type: 'DSA' });
  // Study material input state
  const [materialInput, setMaterialInput] = useState({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' });
  const [resumeUploadFile, setResumeUploadFile] = useState(null);
  // Custom journey sections state
  const [customSections, setCustomSections] = useState([]);

  // Additional structured inputs for senior advice and hackathons
  const [adviceQuote, setAdviceQuote] = useState('');
  const [adviceTips, setAdviceTips] = useState('');
  const [hackathons, setHackathons] = useState('');

  const handleInsertProjectsTemplate = () => {
    const template = `1. "High-Throughput Task Queue": Distributed job processor in Go and Redis with exponential backoff and worker pools.\n2. "Campus Placement Portal": Full-stack MERN application with role-based JWT auth, real-time notifications, and ATS resume parsing.\n3. "AI Code Reviewer": Python FastAPI microservice using LangChain to review pull requests.`;
    setFormData(prev => ({
      ...prev,
      journey: {
        ...prev.journey,
        projects: prev.journey.projects ? prev.journey.projects + '\n\n' + template : template
      }
    }));
  };

  const handleInsertRoundsTemplate = () => {
    const template = `Round 1 (Online Assessment): 3 coding problems on arrays/graphs + 20 CS fundamentals MCQs.\nRound 2 (Technical Interview 1): In-depth resume discussion, live coding on Binary Search Trees, and OS virtual memory.\nRound 3 (Technical Interview 2): System design of a URL shortener, SQL query optimization, and concurrency handling.\nRound 4 (HR / Behavioral): Situation-based questions (STAR method), culture fit, and college experiences.`;
    setFormData(prev => ({
      ...prev,
      journey: {
        ...prev.journey,
        howSecured: prev.journey.howSecured ? prev.journey.howSecured + '\n\n' + template : template
      }
    }));
  };

  const handleInsertAdviceTemplate = () => {
    const template = `Don't wait until placement season to start preparing.\n• Start DSA early and maintain a daily habit.\n• Focus on 2 deeply understood projects instead of 10 surface-level tutorial clones.\n• Practice articulating your thought process aloud while coding.\n• Avoid comparing your journey with peers; everyone progresses at a different pace.`;
    setAdviceTips(prev => (prev ? prev + '\n\n' + template : template));
    if (!adviceQuote.trim()) {
      setAdviceQuote('Consistency beats intensity every single day. Trust your personal timeline and avoid comparing yourself to others.');
    }
  };

  // File upload change handler
  const processMaterialFile = (file) => {
    const extension = file.name.split('.').pop().toLowerCase();
    let determinedType = 'Notes';
    if (extension === 'pdf') {
      determinedType = 'PDF';
    } else if (['png', 'jpg', 'jpeg'].includes(extension)) {
      determinedType = 'Image';
    } else if (file.name.toLowerCase().includes('roadmap')) {
      determinedType = 'Roadmap';
    }
    
    fileToBase64(file).then(base64Url => {
      setMaterialInput({
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processMaterialFile(file);
  };

  const processResumeFile = (file) => {
    fileToBase64(file).then(base64Url => {
      setResumeUploadFile({
        fileName: file.name,
        fileSize: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        url: base64Url
      });
    }).catch(err => {
      console.error("Error reading file:", err);
      alert("Failed to read file.");
    });
  };

  const handleAddCustomSection = () => {
    setCustomSections([...customSections, { title: '', content: '' }]);
  };

  const handleUpdateCustomSection = (index, field, value) => {
    const nextSections = [...customSections];
    nextSections[index][field] = value;
    setCustomSections(nextSections);
  };

  const handleRemoveCustomSection = (index) => {
    setCustomSections(customSections.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (location.state?.openUploadModal) {
      // Clear location state to prevent modal reopening on page reloads
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(inputValue);
    }, 250);
    return () => clearTimeout(handler);
  }, [inputValue]);

  // Filtered stories based on sidebar selections + search query
  const filteredStories = stories.filter(story => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inName = (story.name || '').toLowerCase().includes(q);
      const inCompany = (story.company || '').toLowerCase().includes(q);
      const inRole = (story.role || '').toLowerCase().includes(q);
      const inBranch = (story.branch || '').toLowerCase().includes(q);
      const inSubBranch = (story.subBranch || '').toLowerCase().includes(q);
      const inResources = (story.resources || []).some(r =>
        (r.name || '').toLowerCase().includes(q) || (r.type || '').toLowerCase().includes(q)
      );
      const inPrep = (story.journey?.prep || '').toLowerCase().includes(q);
      const inHowSecured = (story.journey?.howSecured || '').toLowerCase().includes(q);
      if (!inName && !inCompany && !inRole && !inBranch && !inSubBranch && !inResources && !inPrep && !inHowSecured) return false;
    }

    // Branch Match
    const branchMatch = selectedBranches.includes(story.branch);
    if (!branchMatch) return false;
    
    // If the story is CSE, also check if its subBranch is in selectedSubBranches
    if (story.branch === 'CSE' && story.subBranch) {
      const subMatch = selectedSubBranches.includes(story.subBranch);
      if (!subMatch) return false;
    }
    
    // Year Match
    const year = parseInt(story.passoutYear);
    const minMatch = minYear === 'ALL' || isNaN(year) || year >= parseInt(minYear);
    const maxMatch = maxYear === 'ALL' || isNaN(year) || year <= parseInt(maxYear);
    const yearMatch = minMatch && maxMatch;
    if (!yearMatch) return false;
    
    // CGPA Match (Opposite: filters up to selected maxCGPA, e.g. 4.0 to 9.0)
    const cgpaVal = parseFloat(story.cgpa);
    const cgpaMatch = (!isNaN(cgpaVal)) ? (cgpaVal >= 4.0 && cgpaVal <= maxCGPA) : true;
    if (!cgpaMatch) return false;
    
    return true;
  });

  // Sort stories so newest additions appear on top (recent first, oldest at bottom)
  const sortedStories = [...filteredStories].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(a.date).getTime() : 0);
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(b.date).getTime() : 0);
    if (timeA && timeB && timeA !== timeB) return timeB - timeA;
    if (timeB && !timeA) return 1;
    if (timeA && !timeB) return -1;
    const numA = Number(a.id);
    const numB = Number(b.id);
    if (!isNaN(numA) && !isNaN(numB)) return numB - numA;
    return 0;
  });

  // Form submission handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.company || !formData.role) {
      alert('Please fill in the required fields (Name, Company, Role)');
      return;
    }
    if (!resumeUploadFile) {
      alert('Please upload your Resume (PDF is required).');
      return;
    }

    setSubmitting(true);
    const photoUrl = '/images/file-1.jpg';

    // Auto-add staged material if user selected a file but forgot to click '+' (max 1 file allowed)
    let finalStudyMaterials = [...formData.studyMaterials];
    if (materialInput.title.trim() && materialInput.previewUrl) {
      finalStudyMaterials = [{
        title: materialInput.title.trim(),
        type: materialInput.type,
        fileName: materialInput.fileName,
        fileSize: materialInput.fileSize,
        url: materialInput.previewUrl,
        previewUrl: materialInput.previewUrl
      }];
    }
    if (finalStudyMaterials.length > 1) {
      finalStudyMaterials = finalStudyMaterials.slice(0, 1);
    }

    const nowIso = new Date().toISOString();

    // Package advice and hackathons into customSections if provided
    const baseCustomSections = customSections.filter(sec => sec.title.trim() && sec.content.trim());
    const finalCustomSections = [...baseCustomSections];

    const adviceParts = [];
    if (adviceQuote.trim()) {
      adviceParts.push(`"${adviceQuote.trim()}"`);
    }
    if (adviceTips.trim()) {
      adviceParts.push(adviceTips.trim());
    }
    if (adviceParts.length > 0) {
      const existingAdviceIndex = finalCustomSections.findIndex(s => s.title.toLowerCase().includes('advice'));
      if (existingAdviceIndex === -1) {
        finalCustomSections.unshift({
          title: 'Advice To Juniors',
          content: adviceParts.join('\n\n')
        });
      }
    }

    if (hackathons.trim()) {
      const existingHackIndex = finalCustomSections.findIndex(s => s.title.toLowerCase().includes('hackathon') || s.title.toLowerCase().includes('competition'));
      if (existingHackIndex === -1) {
        finalCustomSections.push({
          title: 'Hackathons & Competitions',
          content: hackathons.trim()
        });
      }
    }

    const submission = {
      ...formData,
      createdAt: nowIso,
      date: nowIso,
      studyMaterials: finalStudyMaterials.map(m => ({
        title: m.title,
        type: m.type,
        fileName: m.fileName,
        fileSize: m.fileSize,
        url: m.url || m.previewUrl || ''
      })),
      photo: photoUrl,
      requestType: 'add',
      customSections: finalCustomSections,
      resume: resumeUploadFile.fileName,
      resumeFile: resumeUploadFile,
      uploadedByEmail: currentUser ? currentUser.email : ''
    };
    
    try {
      await startStoryUpload(submission);
      setIsModalOpen(false);
      setUploadSuccess(false);
      setSubmitting(false);
      setCustomSections([]);
      setResumeUploadFile(null);
      setAdviceQuote('');
      setAdviceTips('');
      setHackathons('');
      setFormData({
        name: '',
        branch: 'CSE',
        subBranch: 'CSE',
        passoutYear: '2026',
        company: '',
        role: '',
        semester: '7',
        cgpa: '',
        journey: { firstYear: '', secondYear: '', thirdYear: '', fourthYear: '', prep: '', projects: '', howSecured: '' },
        resources: [],
        studyMaterials: []
      });
      setMaterialInput({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' });
    } catch (err) {
      console.error('Error submitting story:', err);
      alert(err.message);
      setSubmitting(false);
      return;
    }
  };

  const handleAddResource = () => {
    if (!resourceInput.name.trim()) return;
    setFormData({
      ...formData,
      resources: [...formData.resources, { ...resourceInput }]
    });
    setResourceInput({ name: '', type: 'DSA' });
  };

  const handleAddMaterial = () => {
    if (!materialInput.title.trim()) return;
    setFormData({
      ...formData,
      studyMaterials: [{ ...materialInput, url: materialInput.previewUrl || '#' }]
    });
    setMaterialInput({ title: '', type: 'PDF', fileName: '', fileSize: '', previewUrl: '' });
  };

  return (
    <div className="container" style={{ paddingTop: '6.5rem', paddingBottom: '5rem' }}>
      {/* Header and Filter panel */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '1.5rem',
        marginBottom: '3rem'
      }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>Senior Stories</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Explore authentic placement and internship journeys from SPIT alumni.</p>
        </div>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="btn btn-primary"
          style={{ 
            padding: '0.75rem 1.6rem',
            borderRadius: '999px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            fontWeight: 600,
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)'
          }}
        >
          <Upload size={16} />
          <span>Share Your Journey</span>
        </button>
      </div>

      {/* Sidebar and Stories List Container */}
      <div style={{
        display: 'flex',
        gap: '2.5rem',
        marginTop: '2rem',
        alignItems: 'flex-start',
        flexWrap: 'wrap'
      }}>
        {/* Sidebar Filters */}
        <div className="loop-card" style={{
          width: '270px',
          flexShrink: 0,
          padding: '1.25rem 1.15rem',
          borderRadius: '20px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          position: 'sticky',
          top: '5.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '0.65rem',
            borderBottom: '1px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Filter size={15} style={{ color: 'var(--text-primary)' }} />
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-primary)'
              }}>
                Filters
              </span>
            </div>
            {((selectedBranches.length < 3) ||
              (selectedBranches.includes('CSE') && selectedSubBranches.length < 3) ||
              (minYear !== 'ALL') ||
              (maxYear !== 'ALL') ||
              (maxCGPA < 10.0)) && (
              <span style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '9999px',
                backgroundColor: 'var(--text-primary)',
                color: 'var(--bg-primary)',
                letterSpacing: '0.02em'
              }}>
                {(selectedBranches.length < 3 ? 1 : 0) +
                 (selectedBranches.includes('CSE') && selectedSubBranches.length < 3 ? 1 : 0) +
                 (minYear !== 'ALL' || maxYear !== 'ALL' ? 1 : 0) +
                 (maxCGPA < 10.0 ? 1 : 0)} active
              </span>
            )}
          </div>

          {/* Branch Selector */}
          <div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: '0.55rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Branch
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {['CSE', 'CE', 'EXTC'].map((branch) => {
                const isChecked = selectedBranches.includes(branch);
                return (
                  <div key={branch} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.45rem 0.65rem',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        backgroundColor: isChecked ? 'var(--bg-tertiary)' : 'transparent',
                        border: '1px solid',
                        borderColor: isChecked ? 'var(--border-color)' : 'transparent',
                        transition: 'all 0.15s ease',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedBranches([...selectedBranches, branch]);
                            } else {
                              setSelectedBranches(selectedBranches.filter(b => b !== branch));
                            }
                          }}
                          style={{
                            accentColor: 'var(--text-primary)',
                            width: '15px',
                            height: '15px',
                            cursor: 'pointer',
                            margin: 0
                          }}
                        />
                        <span style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {branch}
                        </span>
                      </div>
                      {branch === 'CSE' && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {selectedBranches.includes('CSE') ? `${selectedSubBranches.length}/3 tracks` : '3 tracks'}
                        </span>
                      )}
                    </label>

                    {/* Sub-Branch Pills (For CSE only, visible when CSE is checked) */}
                    {branch === 'CSE' && isChecked && (
                      <div style={{
                        display: 'flex',
                        gap: '0.35rem',
                        flexWrap: 'wrap',
                        paddingLeft: '1.25rem',
                        marginBottom: '0.2rem'
                      }}>
                        {['CSE', 'AI', 'DS'].map((sub) => {
                          const isSubActive = selectedSubBranches.includes(sub);
                          return (
                            <button
                              key={sub}
                              type="button"
                              onClick={() => {
                                if (isSubActive) {
                                  setSelectedSubBranches(selectedSubBranches.filter(s => s !== sub));
                                } else {
                                  setSelectedSubBranches([...selectedSubBranches, sub]);
                                }
                              }}
                              style={{
                                padding: '0.22rem 0.55rem',
                                borderRadius: '9999px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                border: '1px solid',
                                borderColor: isSubActive ? 'var(--text-primary)' : 'var(--border-color)',
                                backgroundColor: isSubActive ? 'var(--text-primary)' : 'var(--bg-primary)',
                                color: isSubActive ? 'var(--accent-inverse)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {sub}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Passout Year Filter */}
          <div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: '0.55rem',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              Passout Year
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.5rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)'
            }}>
              <select 
                value={minYear}
                onChange={(e) => setMinYear(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '0.2rem 0.25rem'
                }}
              >
                <option value="ALL">From (Any)</option>
                {yearOptions.filter(y => y !== 'ALL').map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>—</span>
              <select 
                value={maxYear}
                onChange={(e) => setMaxYear(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  backgroundColor: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  padding: '0.2rem 0.25rem'
                }}
              >
                <option value="ALL">To (Any)</option>
                {yearOptions.filter(y => y !== 'ALL').map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* CGPA Threshold */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                CGPA Range
              </span>
              <span style={{
                fontSize: '0.8rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums'
              }}>
                4.0 – {maxCGPA.toFixed(1)}
              </span>
            </div>
            <input 
              type="range" 
              min="4.0" 
              max="10.0" 
              step="0.5" 
              value={maxCGPA} 
              onChange={(e) => setMaxCGPA(parseFloat(e.target.value))}
              className="filter-range-slider"
              style={{
                background: `linear-gradient(to right, var(--text-primary) 0%, var(--text-primary) ${Math.max(0, Math.min(100, ((maxCGPA - 4.0) / 6.0) * 100))}%, var(--bg-tertiary) ${Math.max(0, Math.min(100, ((maxCGPA - 4.0) / 6.0) * 100))}%, var(--bg-tertiary) 100%)`
              }}
            />
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.68rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginTop: '0.2rem',
              padding: '0 2px'
            }}>
              <span>4.0</span>
              <span>7.0</span>
              <span>10.0</span>
            </div>
          </div>

          {/* Reset Filters */}
          <button 
            type="button"
            onClick={() => {
              setSelectedBranches(['CSE', 'CE', 'EXTC']);
              setSelectedSubBranches(['CSE', 'AI', 'DS']);
              setMinYear('ALL');
              setMaxYear('ALL');
              setMaxCGPA(10.0);
              setInputValue('');
              setSearchQuery('');
            }}
            style={{ 
              width: '100%', 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              padding: '0.55rem 0.85rem', 
              fontSize: '0.8rem', 
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              fontWeight: 600,
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.18s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--text-primary)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <RotateCcw size={13} />
            <span>Reset Filters</span>
          </button>
        </div>

        {/* Stories List (on the right) */}
        <div style={{ flexGrow: 1, minWidth: '260px', maxWidth: '100%' }}>
          {/* Search Bar */}
          <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search by name, company, role, branch, resource…"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              style={{ paddingLeft: '2.5rem', paddingRight: inputValue ? '2.5rem' : '1rem', borderRadius: '14px', fontSize: '0.9rem' }}
            />
            {inputValue && (
              <button
                onClick={() => {
                  setInputValue('');
                  setSearchQuery('');
                }}
                style={{ 
                  position: 'absolute', 
                  right: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  background: 'rgba(255, 255, 255, 0.08)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '50%', 
                  width: '22px', 
                  height: '22px', 
                  cursor: 'pointer', 
                  color: 'var(--text-secondary)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
                title="Clear Search"
              >
                <X size={12} />
              </button>
            )}
          </div>
          {/* Results count */}
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            {loading ? 'Searching stories...' : `${sortedStories.length} ${sortedStories.length === 1 ? 'story' : 'stories'} found${searchQuery ? ` for "${searchQuery}"` : ''}`}
          </p>
          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}>
              {[1, 2, 3].map((n) => (
                <div 
                  key={n} 
                  className="loop-card skeleton-pulse"
                  style={{
                    padding: '1.75rem 2rem',
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    minHeight: '140px',
                    position: 'relative',
                    border: '1px solid var(--border-color)',
                    borderRadius: '24px',
                    backgroundColor: 'var(--bg-secondary)',
                    gap: '2rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ flexGrow: 1, minWidth: '260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <div style={{ height: '1.75rem', width: '200px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <div style={{ height: '1.2rem', width: '60px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
                        <div style={{ height: '1.2rem', width: '80px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div style={{ height: '1rem', width: '150px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ height: '1.2rem', width: '120px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
                      <div style={{ height: '1.2rem', width: '60px', backgroundColor: 'var(--border-color)', borderRadius: '4px' }} />
                    </div>
                  </div>
                  <div style={{ width: '130px', height: '2.5rem', backgroundColor: 'var(--border-color)', borderRadius: '12px' }} />
                </div>
              ))}
            </div>
          ) : sortedStories.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}>
              {sortedStories.map((story, index) => (
                <Story3DCard key={story.id} story={story} index={index} navigate={navigate} />
              ))}
            </div>
          ) : (
            <div className="glass-panel" style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              borderRadius: '20px',
              color: 'var(--text-secondary)'
            }}>
              <p style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>No student stories found matching the filter.</p>
              <button onClick={() => {
                setSelectedBranches(['CSE', 'CE', 'EXTC']);
                setSelectedSubBranches(['CSE', 'AI', 'DS']);
                setMinYear(2021);
                setMaxYear(2026);
              }} 
                className="btn btn-secondary"
                style={{
                  borderRadius: '999px',
                  border: '1px solid var(--border-color)',
                  padding: '0.65rem 1.5rem',
                  fontWeight: 600
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload Story Modal - Apple OS Liquid Glass Redesign */}
      {isModalOpen && createPortal(
        <div 
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(20px) saturate(190%)',
            WebkitBackdropFilter: 'blur(20px) saturate(190%)',
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
            className="animate-fade-in custom-scrollbar" 
            style={{
              margin: 'auto',
              width: '100%',
              maxWidth: '820px',
              borderRadius: '28px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
              maxHeight: 'calc(100vh - 4rem)',
              overflowY: 'auto',
              overscrollBehavior: 'contain',
              position: 'relative',
              padding: '3rem 3rem 2.5rem 3rem'
            }}
          >
            {/* Close Button - Apple Style Circle Button */}
            <button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsModalOpen(false);
              }}
              style={{
                position: 'absolute',
                top: '1.75rem',
                right: '1.75rem',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                cursor: 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--text-primary)';
                e.currentTarget.style.color = 'var(--bg-surface)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                e.currentTarget.style.color = 'var(--text-secondary)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title="Close"
            >
              <X size={18} />
            </button>

            {uploadSuccess ? (
              <div style={{
                textAlign: 'center',
                padding: '4rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem'
              }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(48, 209, 88, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CheckCircle size={48} style={{ color: '#30d158' }} />
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Submission Sent!</h2>
                <p style={{ color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  Thank you for contributing. Your placement journey has been sent to the SPIT administrators for approval.
                </p>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit}>
                {/* Header Banner */}
                <div style={{ marginBottom: '2rem', position: 'relative' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(212, 255, 50, 0.22)',
                    border: '1px solid rgba(212, 255, 50, 0.45)',
                    color: 'var(--text-primary)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    marginBottom: '0.85rem'
                  }}>
                    <span>SENIOR ARCHIVE CONTRIBUTION</span>
                  </div>
                  <h2 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 0.45rem 0', color: 'var(--text-primary)' }}>
                    Share Your Story
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, lineHeight: 1.5 }}>
                    Help juniors prepare by sharing your interview prep, milestones, and materials.
                  </p>
                </div>

                {/* 1. Profile Details Card */}
                <div style={{
                  padding: '1.75rem',
                  borderRadius: '20px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1.5rem',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.35rem' }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      flexShrink: 0
                    }}>1</div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Profile Details
                    </h3>
                  </div>

                  <div className="input-group" style={{ marginBottom: '1rem' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Full Name *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: formData.branch === 'CSE' ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)',
                    gap: '0.85rem',
                    marginBottom: '1rem'
                  }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Branch *</label>
                      <select 
                        className="input-field"
                        value={formData.branch}
                        onChange={(e) => {
                          const nextBranch = e.target.value;
                          setFormData({ 
                            ...formData, 
                            branch: nextBranch, 
                            subBranch: nextBranch === 'CSE' ? 'CSE' : '' 
                          });
                        }}
                      >
                        <option value="CSE">CSE</option>
                        <option value="CE">CE</option>
                        <option value="EXTC">EXTC</option>
                      </select>
                    </div>

                    {formData.branch === 'CSE' && (
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sub-Category *</label>
                        <select
                          className="input-field"
                          value={formData.subBranch || 'CSE'}
                          onChange={(e) => setFormData({ ...formData, subBranch: e.target.value })}
                        >
                          <option value="CSE">CSE</option>
                          <option value="AI">AI</option>
                          <option value="DS">DS</option>
                        </select>
                      </div>
                    )}

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Passout Year *</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder="2026"
                        value={formData.passoutYear}
                        onChange={(e) => setFormData({ ...formData, passoutYear: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '0.85rem',
                    marginBottom: '1rem'
                  }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Company *</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. Microsoft"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        required
                      />
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Role *</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. Software Engineer"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        required
                      />
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Semester Placed *</label>
                      <select 
                        className="input-field"
                        value={formData.semester}
                        onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      >
                        {['1','2','3','4','5','6','7','8'].map(n => <option key={n} value={n}>Semester {n}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0, maxWidth: '220px' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>CGPA</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. 9.4"
                      value={formData.cgpa}
                      onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                    />
                  </div>
                </div>

                {/* 2. Your Journey (Year by Year) Card */}
                <div style={{
                  padding: '1.75rem',
                  borderRadius: '20px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1.5rem',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.35rem' }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      flexShrink: 0
                    }}>2</div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Your Journey (Year by Year)
                    </h3>
                  </div>

                  {/* First Year Journey */}
                  <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>First Year Journey</label>
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="Exploration, core subjects, clubs joined, mindset..."
                      value={formData.journey.firstYear}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, firstYear: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Second Year Journey */}
                  <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Second Year Journey</label>
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="Diving into DSA, core CS topics, initial projects, hackathons..."
                      value={formData.journey.secondYear}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, secondYear: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Third Year Journey */}
                  <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Third Year Journey</label>
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="Internship prep, online tests, cracking placement drives, interviews..."
                      value={formData.journey.thirdYear}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, thirdYear: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Fourth Year Journey */}
                  <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Fourth Year Journey</label>
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="PPO conversion, capstone project, final plans, tips for juniors..."
                      value={formData.journey.fourthYear}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, fourthYear: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Preparation & Strategy */}
                  <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Preparation &amp; Strategy</label>
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="DSA sheets, systems subjects revised, resume tips, interview prep..."
                      value={formData.journey.prep}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, prep: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Key Projects */}
                  <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label className="input-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>Key Projects &amp; Technical Proof of Work</label>
                      <button
                        type="button"
                        onClick={handleInsertProjectsTemplate}
                        style={{
                          padding: '0.35rem 0.85rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Sparkles size={12} style={{ opacity: 0.8 }} />
                        <span>+ Insert Project Template</span>
                      </button>
                    </div>
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="Describe your technical projects, tech stack, and systems, or tap '+ Insert Project Template' above..."
                      value={formData.journey.projects}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, projects: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* How You Secured the Placement */}
                  <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label className="input-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>How You Secured the Placement</label>
                      <button
                        type="button"
                        onClick={handleInsertRoundsTemplate}
                        style={{
                          padding: '0.35rem 0.85rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Sparkles size={12} style={{ opacity: 0.8 }} />
                        <span>+ Insert Rounds Template</span>
                      </button>
                    </div>
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="Rounds details, interview questions asked, advice..."
                      value={formData.journey.howSecured}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, howSecured: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* Key Takeaways & Advice to Juniors */}
                  <div className="input-group" style={{ marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label className="input-label" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>Senior&apos;s Golden Rule &amp; Advice</label>
                      <button
                        type="button"
                        onClick={handleInsertAdviceTemplate}
                        style={{
                          padding: '0.35rem 0.85rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Sparkles size={12} style={{ opacity: 0.8 }} />
                        <span>+ Insert Advice Template</span>
                      </button>
                    </div>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Golden Rule (e.g. Consistency beats intensity every single day. Trust your personal timeline.)"
                      value={adviceQuote}
                      onChange={(e) => setAdviceQuote(e.target.value)}
                      style={{ marginBottom: '0.65rem' }}
                    />
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="Actionable advice and principles for juniors..."
                      value={adviceTips}
                      onChange={(e) => setAdviceTips(e.target.value)}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>

                  {/* CUSTOM SECTIONS & PROMPTS (from screenshot image 3) */}
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border-color)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.85rem' }}>
                      CUSTOM SECTIONS &amp; PROMPTS
                    </div>

                    <button
                      type="button"
                      onClick={handleAddCustomSection}
                      style={{
                        width: '100%',
                        padding: '0.75rem 1rem',
                        borderRadius: '12px',
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.borderColor = 'var(--text-secondary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                      }}
                    >
                      <Plus size={14} />
                      <span>+ Add Custom Prompts / Sections</span>
                    </button>

                    {customSections.map((sec, index) => (
                      <div key={index} style={{
                        marginTop: '0.85rem',
                        padding: '1.25rem',
                        borderRadius: '14px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        position: 'relative'
                      }}>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomSection(index)}
                          style={{
                            position: 'absolute',
                            top: '0.75rem',
                            right: '0.75rem',
                            width: '26px',
                            height: '26px',
                            borderRadius: '50%',
                            border: '1px solid var(--border-color)',
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Remove"
                        >
                          <X size={13} />
                        </button>
                        <div className="input-group" style={{ marginBottom: '0.65rem', paddingRight: '2rem' }}>
                          <label className="input-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>Section Headline *</label>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="e.g. Work Culture & Team Dynamics, Open Source..."
                            value={sec.title}
                            onChange={(e) => handleUpdateCustomSection(index, 'title', e.target.value)}
                            required
                          />
                        </div>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                          <label className="input-label" style={{ fontWeight: 600, fontSize: '0.82rem' }}>Section Details *</label>
                          <textarea
                            className="input-field"
                            rows={3}
                            placeholder="Write the details for this prompt..."
                            value={sec.content}
                            onChange={(e) => handleUpdateCustomSection(index, 'content', e.target.value)}
                            required
                            style={{ resize: 'vertical', lineHeight: 1.6 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Resources & Materials Used Card */}
                <div style={{
                  padding: '1.75rem',
                  borderRadius: '20px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '1.75rem',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.02)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.35rem' }}>
                    <div style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      flexShrink: 0
                    }}>3</div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                      Resources &amp; Materials Used
                    </h3>
                  </div>

                  {/* Add Resource Used */}
                  <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Add Resource Used</label>
                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Resource Name (e.g. LeetCode, Striver Sheet, NeetCode)"
                        value={resourceInput.name}
                        onChange={(e) => setResourceInput({ ...resourceInput, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddResource();
                          }
                        }}
                        style={{ flexGrow: 1 }}
                      />
                      <select 
                        className="input-field"
                        value={resourceInput.type}
                        onChange={(e) => setResourceInput({ ...resourceInput, type: e.target.value })}
                        style={{ width: '130px' }}
                      >
                        <option value="DSA">DSA</option>
                        <option value="System Design">System Design</option>
                        <option value="Web Dev">Web Dev</option>
                        <option value="AI/ML">AI/ML</option>
                        <option value="Core CS">Core CS</option>
                        <option value="Books">Books</option>
                        <option value="Mock Tests">Mock Tests</option>
                      </select>
                      <button 
                        type="button" 
                        onClick={handleAddResource} 
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Add Resource"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {formData.resources.length > 0 && (
                      <div style={{
                        marginTop: '0.65rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        gap: '0.45rem',
                        flexWrap: 'wrap',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Added ({formData.resources.length}):</span>
                        {formData.resources.map((res, index) => (
                          <span key={index} style={{
                            fontSize: '0.75rem',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '999px',
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid var(--border-color)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            color: 'var(--text-primary)'
                          }}>
                            <strong>{res.name}</strong>
                            <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>({res.type})</span>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, resources: prev.resources.filter((_, i) => i !== index) }))}
                              style={{
                                background: 'rgba(255, 255, 255, 0.1)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '50%',
                                width: '16px',
                                height: '16px',
                                padding: 0,
                                cursor: 'pointer',
                                color: 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Remove"
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upload Senior Resume (PDF) * (from image 2) */}
                  <div className="input-group" style={{ marginBottom: '1.5rem' }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload Senior Resume (PDF) *</label>
                    <div 
                      style={{
                        border: resumeUploadFile ? '2px solid var(--border-dropzone, #000000)' : '2px dashed var(--border-dropzone, #000000)',
                        borderRadius: '16px',
                        padding: '1.6rem 1.25rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-dropzone, rgba(0, 0, 0, 0.02))',
                        transition: 'all 0.15s ease'
                      }}
                      onClick={() => document.getElementById('resumeFileInput')?.click()}
                    >
                      <input 
                        id="resumeFileInput"
                        type="file" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) processResumeFile(file);
                        }} 
                        style={{ display: 'none' }}
                        accept=".pdf"
                      />
                      {resumeUploadFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textAlign: 'left' }}>
                            <span style={{
                              padding: '0.6rem',
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-primary)'
                            }}>
                              <FileText size={20} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{resumeUploadFile.fileName}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{resumeUploadFile.fileSize} • Click to replace</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setResumeUploadFile(null);
                            }}
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-color)',
                              background: 'rgba(255, 255, 255, 0.08)',
                              cursor: 'pointer'
                            }}
                            title="Remove"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                          <FileText size={28} style={{ color: 'var(--text-primary)', opacity: 0.85 }} />
                          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            Choose Resume PDF or drag &amp; drop here
                          </p>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            PDF up to 10MB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload Study Material (from image 2) */}
                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label" style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload Study Material</label>
                    <div 
                      style={{
                        border: materialInput.fileName ? '2px solid var(--border-dropzone, #000000)' : '2px dashed var(--border-dropzone, #000000)',
                        borderRadius: '16px',
                        padding: '1.6rem 1.25rem',
                        textAlign: 'center',
                        cursor: 'pointer',
                        backgroundColor: 'var(--bg-dropzone, rgba(0, 0, 0, 0.02))',
                        transition: 'all 0.15s ease',
                        marginBottom: '0.75rem'
                      }}
                      onClick={() => document.getElementById('studyMaterialFileInput')?.click()}
                    >
                      <input 
                        id="studyMaterialFileInput"
                        type="file" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }}
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                      />
                      {materialInput.fileName ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <FileText size={20} />
                            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{materialInput.fileName} ({materialInput.fileSize})</span>
                          </div>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Click to replace</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                          <Upload size={26} style={{ color: 'var(--text-secondary)', opacity: 0.8 }} />
                          <p style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            Choose Material or drop file here
                          </p>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                            Supports PDF, PNG, JPG
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Material Title (e.g. Cheat Sheet, Handwritten Notes)"
                        value={materialInput.title}
                        onChange={(e) => setMaterialInput({ ...materialInput, title: e.target.value })}
                        style={{ flexGrow: 1 }}
                      />
                      <select 
                        className="input-field"
                        value={materialInput.type}
                        onChange={(e) => setMaterialInput({ ...materialInput, type: e.target.value })}
                        style={{ width: '130px' }}
                      >
                        <option value="PDF">PDF</option>
                        <option value="Image">Image</option>
                        <option value="Roadmap">Roadmap</option>
                        <option value="Notes">Notes</option>
                        <option value="Interview Questions">Interview Qs</option>
                      </select>
                      <button 
                        type="button" 
                        onClick={handleAddMaterial} 
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid var(--border-color)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                        title="Add Material"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {formData.studyMaterials.length > 0 && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                        gap: '0.65rem' 
                      }}>
                        {formData.studyMaterials.map((mat, index) => (
                          <div 
                            key={index} 
                            style={{
                              border: '1px solid var(--border-color)',
                              borderRadius: '12px',
                              padding: '0.65rem',
                              position: 'relative',
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.35rem',
                              textAlign: 'center'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  studyMaterials: formData.studyMaterials.filter((_, i) => i !== index)
                                });
                              }}
                              style={{
                                position: 'absolute',
                                top: '0.3rem',
                                right: '0.3rem',
                                background: 'rgba(0,0,0,0.5)',
                                border: '1px solid var(--border-color)',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer'
                              }}
                              title="Remove"
                            >
                              <X size={10} />
                            </button>
                            <span style={{ fontSize: '0.76rem', fontWeight: 600, display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {mat.title}
                            </span>
                            <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)' }}>
                              {mat.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Modal Footer Actions (from image 2) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.85rem',
                  paddingTop: '1.25rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="btn btn-secondary"
                    style={{
                      padding: '0.75rem 1.85rem',
                      borderRadius: '999px',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.92rem',
                      fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    style={{ 
                      padding: '0.75rem 2.25rem',
                      borderRadius: '999px',
                      fontSize: '0.94rem',
                      fontWeight: 700,
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      opacity: submitting ? 0.7 : 1,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.15s ease',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {submitting ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.65rem' }}>
                        <div style={{ position: 'relative', width: '18px', height: '18px' }}>
                          <svg width="18" height="18" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke="currentColor"
                              strokeOpacity="0.25"
                              strokeWidth="3.5"
                            />
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3.5"
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
                            fontSize: '6px',
                            fontWeight: 'bold',
                            color: 'currentColor'
                          }}>
                            {uploadProgress}%
                          </div>
                        </div>
                        <span>{uploadProgress === 100 ? 'Saving...' : 'Submitting...'}</span>
                      </div>
                    ) : (
                      <span>Submit Journey</span>
                    )}
                  </button>
                </div>
                {submitting && (
                  <p style={{
                    fontSize: '0.78rem',
                    color: 'var(--accent-primary, #0071e3)',
                    margin: '0.6rem 0 0 0',
                    opacity: 0.9,
                    textAlign: 'right',
                    fontWeight: '500'
                  }}>
                    Uploading in background. You can safely continue browsing.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Styled card interactions */}
      <style>{`
        .hinge-card {
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hinge-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 45px rgba(0, 0, 0, 0.7);
          border-color: var(--text-secondary);
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.35; }
        }
        .skeleton-pulse {
          animation: pulse 1.5s infinite ease-in-out;
        }
        @media (max-width: 576px) {
          .hinge-card {
            height: auto !important;
            min-height: 480px;
          }
          div[style*="height: '55%'"] {
            height: 250px !important;
          }
        }
      `}</style>
    </div>
  );
}
