import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Filter, Upload, X, ArrowRight, Plus, Briefcase, CheckCircle, FileText, Search, Calendar,
  Compass, Award, Code, Layers, Sparkles, BookOpen, Trophy, Lightbulb
} from 'lucide-react';
import { getStories, addPendingStory, fileToBase64 } from '../utils/db';
import { useCachedData } from '../hooks/useCachedData';

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

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -4.5;
    const rotateY = ((x - centerX) / centerX) * 4.5;
    setTilt({ x: rotateX, y: rotateY, active: true });
  };

  const handleMouseLeave = () => {
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
    const template = `💡 Don't wait until placement season to start preparing.\n• Start DSA early and maintain a daily habit.\n• Focus on 2 deeply understood projects instead of 10 surface-level tutorial clones.\n• Practice articulating your thought process aloud while coding.\n• Avoid comparing your journey with peers; everyone progresses at a different pace.`;
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
      setUploadProgress(0);
      await addPendingStory(submission, (progress) => {
        setUploadProgress(progress);
      });
      setUploadSuccess(true);
    } catch (err) {
      console.error('Error submitting story:', err);
      alert(err.message);
      setSubmitting(false);
      return;
    }
    
    // Reset form
    setTimeout(() => {
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
    }, 2500);
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
          style={{ padding: '0.75rem 1.5rem' }}
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
          width: '260px',
          flexShrink: 0,
          padding: '1.75rem',
          borderRadius: '24px',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.75rem',
          position: 'sticky',
          top: '6rem'
        }}>
          <div>
            <h3 style={{
              fontSize: '0.9rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              color: 'var(--text-primary)',
              marginBottom: '1.25rem',
              letterSpacing: '0.05em',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <Filter size={16} />
              Filters
            </h3>

            {/* Branch Checkboxes */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Branch
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {['CSE', 'CE', 'EXTC'].map((branch) => (
                  <div key={branch} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500, color: 'var(--text-primary)' }}>
                      <input 
                        type="checkbox" 
                        checked={selectedBranches.includes(branch)}
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
                          cursor: 'pointer'
                        }}
                      />
                      <span>{branch}</span>
                    </label>

                    {/* Sub-Branch Checkboxes (For CSE only, visible when CSE is checked) */}
                    {branch === 'CSE' && selectedBranches.includes('CSE') && (
                      <div style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', borderLeft: '1px solid var(--border-color)', marginLeft: '0.4rem', marginTop: '0.25rem', marginBottom: '0.25rem' }}>
                        {['CSE', 'AI', 'DS'].map((sub) => (
                          <label key={sub} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                            <input 
                              type="checkbox" 
                              checked={selectedSubBranches.includes(sub)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedSubBranches([...selectedSubBranches, sub]);
                                } else {
                                  setSelectedSubBranches(selectedSubBranches.filter(s => s !== sub));
                                }
                              }}
                              style={{
                                accentColor: 'var(--text-primary)',
                                width: '13px',
                                height: '13px',
                                cursor: 'pointer'
                              }}
                            />
                            <span>{sub}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Passout Year Filter */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Passout Year
              </h4>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <select 
                  className="input-field" 
                  value={minYear}
                  onChange={(e) => setMinYear(e.target.value)}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', flexGrow: 1, height: 'auto', backgroundColor: 'var(--bg-primary)' }}
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>to</span>
                <select 
                  className="input-field" 
                  value={maxYear}
                  onChange={(e) => setMaxYear(e.target.value)}
                  style={{ padding: '0.4rem 0.5rem', fontSize: '0.8rem', flexGrow: 1, height: 'auto', backgroundColor: 'var(--bg-primary)' }}
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* CGPA Threshold */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  CGPA Range
                </h4>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
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
                style={{
                  width: '100%',
                  accentColor: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                <span>4.0</span>
                <span>7.0</span>
                <span>10.0</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => {
              setSelectedBranches(['CSE', 'CE', 'EXTC']);
              setSelectedSubBranches(['CSE', 'AI', 'DS']);
              setMinYear('ALL');
              setMaxYear('ALL');
              setMaxCGPA(10.0);
              setInputValue('');
              setSearchQuery('');
            }}
            className="btn btn-secondary"
            style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem', borderRadius: '10px' }}
          >
            Reset Filters
          </button>
        </div>

        {/* Stories List (on the right) */}
        <div style={{ flexGrow: 1, minWidth: '320px' }}>
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
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.2rem', display: 'flex', alignItems: 'center' }}
              >
                <X size={14} />
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
                setMinCGPA(6.0);
              }} className="btn btn-secondary">
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Upload Story Modal - Apple OS Liquid Glass Redesign */}
      {isModalOpen && (
        <div 
          onClick={() => setIsModalOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(30px) saturate(190%)',
            WebkitBackdropFilter: 'blur(30px) saturate(190%)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem 1.5rem',
            overflow: 'hidden',
            overscrollBehavior: 'contain'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="animate-fade-in custom-scrollbar" 
            style={{
              width: '100%',
              maxWidth: '820px',
              borderRadius: '28px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              boxShadow: '0 30px 80px rgba(0, 0, 0, 0.22), 0 4px 20px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
              maxHeight: '90vh',
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
                <div style={{ marginBottom: '1.75rem' }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(212, 255, 50, 0.22)',
                    border: '1px solid rgba(212, 255, 50, 0.45)',
                    color: 'var(--text-primary)',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    marginBottom: '0.75rem'
                  }}>
                    Senior Archive Contribution
                  </div>
                  <h2 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                    Share Your Story
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, lineHeight: 1.5 }}>
                    Help juniors prepare by sharing your interview prep, milestones, projects, and study materials.
                  </p>
                </div>

                {/* Section 1: Profile Details */}
                <div 
                  id="sec-profile" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800
                      }}>1</div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Briefcase size={18} />
                          Profile Details
                        </h3>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Candidate credentials and placement offer overview
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff3b30' }}>* Required</span>
                  </div>

                  <div className="input-group">
                    <label className="input-label">Full Name *</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="e.g. John Doe"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className={formData.branch === 'CSE' ? 'form-grid-3col' : 'form-grid-2col'} style={{ marginBottom: '1.25rem' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Branch *</label>
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
                        <label className="input-label">Sub-Category *</label>
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
                      <label className="input-label">Passout Year *</label>
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
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '1rem'
                  }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Company *</label>
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
                      <label className="input-label">Role *</label>
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
                      <label className="input-label">Semester Placed *</label>
                      <select 
                        className="input-field"
                        value={formData.semester}
                        onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                      >
                        {['1','2','3','4','5','6','7','8'].map(n => <option key={n} value={n}>Semester {n}</option>)}
                      </select>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">CGPA</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. 9.4"
                        value={formData.cgpa}
                        onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: 4-Year Journey */}
                <div 
                  id="sec-journey" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 800
                    }}>2</div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Compass size={18} />
                        4-Year Journey (Year by Year)
                      </h3>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Your evolution across engineering phases from orientation to campus offers
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* First Year */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <label className="input-label" style={{ margin: 0, fontWeight: 700 }}>
                          First Year Journey (FE)
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Foundations & Mindset</span>
                      </div>
                      <textarea 
                        className="input-field" 
                        rows={3} 
                        placeholder="Exploration, foundational math & coding, clubs joined (e.g. CSI, IEEE, ACM), mindset, initial GPA focus..."
                        value={formData.journey.firstYear}
                        onChange={(e) => setFormData({
                          ...formData,
                          journey: { ...formData.journey, firstYear: e.target.value }
                        })}
                        style={{ resize: 'vertical', lineHeight: 1.6 }}
                      />
                    </div>

                    {/* Second Year */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <label className="input-label" style={{ margin: 0, fontWeight: 700 }}>
                          Second Year Journey (SE)
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DSA & Tech Exploration</span>
                      </div>
                      <textarea 
                        className="input-field" 
                        rows={3} 
                        placeholder="DSA commencement (LeetCode/GFG), choosing your tech stack, hackathons, initial core projects, subjects..."
                        value={formData.journey.secondYear}
                        onChange={(e) => setFormData({
                          ...formData,
                          journey: { ...formData.journey, secondYear: e.target.value }
                        })}
                        style={{ resize: 'vertical', lineHeight: 1.6 }}
                      />
                    </div>

                    {/* Third Year */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <label className="input-label" style={{ margin: 0, fontWeight: 700 }}>
                          Third Year Journey (TE)
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Internships & Assessments</span>
                      </div>
                      <textarea 
                        className="input-field" 
                        rows={3} 
                        placeholder="Internship preparation, online coding assessments, clearing campus drives, resume building, mock interviews..."
                        value={formData.journey.thirdYear}
                        onChange={(e) => setFormData({
                          ...formData,
                          journey: { ...formData.journey, thirdYear: e.target.value }
                        })}
                        style={{ resize: 'vertical', lineHeight: 1.6 }}
                      />
                    </div>

                    {/* Fourth Year */}
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                        <label className="input-label" style={{ margin: 0, fontWeight: 700 }}>
                          Fourth Year Journey (BE)
                        </label>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Placements & Career Launch</span>
                      </div>
                      <textarea 
                        className="input-field" 
                        rows={3} 
                        placeholder="Final placement season, PPO conversion, capstone engineering project, higher studies/work plans, mentoring juniors..."
                        value={formData.journey.fourthYear}
                        onChange={(e) => setFormData({
                          ...formData,
                          journey: { ...formData.journey, fourthYear: e.target.value }
                        })}
                        style={{ resize: 'vertical', lineHeight: 1.6 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Prep Strategy */}
                <div 
                  id="sec-prep" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 800
                    }}>3</div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Award size={18} />
                        Preparation Strategy & Roadmaps
                      </h3>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        DSA routines, core computer science subjects, and interview readiness
                      </p>
                    </div>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Preparation Strategy & Tips</label>
                    <textarea 
                      className="input-field" 
                      rows={4} 
                      placeholder="e.g. Started DSA with Striver SDE sheet (solved 350+ questions). Dedicated 2 hours daily on LeetCode. Revised OS (threads, locks, paging), DBMS (indexes, transactions), and Computer Networks. Did 5 peer mock interviews before the on-campus drive..."
                      value={formData.journey.prep}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, prep: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>
                </div>

                {/* Section 4: Key Projects */}
                <div 
                  id="sec-projects" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800
                      }}>4</div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Code size={18} />
                          Key Projects & Technical Proof of Work
                        </h3>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Practical systems, GitHub repositories, and portfolio work discussed in interviews
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleInsertProjectsTemplate}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      + Insert Project Template
                    </button>
                  </div>

                  <div className="input-group" style={{ marginBottom: '0.5rem' }}>
                    <label className="input-label">Projects & Tech Stack</label>
                    <textarea 
                      className="input-field" 
                      rows={4} 
                      placeholder="Describe your technical projects, tech stack, and systems, or tap '+ Insert Project Template' above..."
                      value={formData.journey.projects}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, projects: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    💡 Pro-Tip: Format as <strong>1. &quot;Project Name&quot;: Description &amp; Tech Stack</strong> so it renders into beautiful interactive cards on your public story page.
                  </p>
                </div>

                {/* Section 5: How Secured */}
                <div 
                  id="sec-secured" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800
                      }}>5</div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Layers size={18} />
                          How Secured (Recruitment Process & Rounds)
                        </h3>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Step-by-step breakdown: OA, technical rounds, questions asked, and HR
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleInsertRoundsTemplate}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      + Insert Rounds Template
                    </button>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Recruitment Process & Interview Rounds</label>
                    <textarea 
                      className="input-field" 
                      rows={4} 
                      placeholder="Details on OA questions, interview rounds, and HR discussion, or tap '+ Insert Rounds Template' above..."
                      value={formData.journey.howSecured}
                      onChange={(e) => setFormData({
                        ...formData,
                        journey: { ...formData.journey, howSecured: e.target.value }
                      })}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>
                </div>

                {/* Section 6: Key Takeaways & Advice */}
                <div 
                  id="sec-takeaways" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800
                      }}>6</div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Sparkles size={18} />
                          Key Takeaways & Advice to Juniors
                        </h3>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Your golden rule, mindset guidance, and lessons learned from the placement journey
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleInsertAdviceTemplate}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      + Insert Advice Template
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Senior's Golden Rule / Core Takeaway</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. Consistency beats intensity every single day. Trust your personal timeline."
                        value={adviceQuote}
                        onChange={(e) => setAdviceQuote(e.target.value)}
                      />
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'block' }}>
                        ✨ Displayed prominently as a quote badge on your public story page.
                      </span>
                    </div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                      <label className="input-label">Actionable Advice & Principles for Juniors</label>
                      <textarea 
                        className="input-field" 
                        rows={4} 
                        placeholder="Key advice, habits, and mindset shifts for juniors, or tap '+ Insert Advice Template' above..."
                        value={adviceTips}
                        onChange={(e) => setAdviceTips(e.target.value)}
                        style={{ resize: 'vertical', lineHeight: 1.6 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 7: Hackathons (Optional) */}
                <div 
                  id="sec-hackathons" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 800
                    }}>7</div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Trophy size={18} />
                        Hackathons & Competitions (Optional)
                      </h3>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        High-intensity hackathons, awards won, competitive building, and open-source sprints
                      </p>
                    </div>
                  </div>

                  <div className="input-group" style={{ marginBottom: 0 }}>
                    <label className="input-label">Hackathons Participated & Achievements</label>
                    <textarea 
                      className="input-field" 
                      rows={3} 
                      placeholder="Details on hackathons, coding contests, and projects built under deadlines..."
                      value={hackathons}
                      onChange={(e) => setHackathons(e.target.value)}
                      style={{ resize: 'vertical', lineHeight: 1.6 }}
                    />
                  </div>
                </div>

                {/* Section 8: Resources Used */}
                <div 
                  id="sec-resources" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 800
                    }}>8</div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <BookOpen size={18} />
                        Resources & Study Materials Used
                      </h3>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Sheets, platforms, YouTube channels, and books that helped you prepare
                      </p>
                    </div>
                  </div>

                  {/* Custom Resource Input */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label className="input-label">Add Resource</label>
                    <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.25rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Resource Name (e.g. Striver SDE Sheet, NeetCode 150, Gate Smashers)"
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
                        style={{ width: '150px' }}
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
                        className="btn btn-secondary"
                        style={{ padding: '0.6rem 1.1rem', borderRadius: '12px' }}
                        title="Add Resource"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>


                  {/* Resources Preview Tag List */}
                  {formData.resources.length > 0 && (
                    <div style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '14px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      gap: '0.5rem',
                      flexWrap: 'wrap',
                      alignItems: 'center'
                    }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Added ({formData.resources.length}):</span>
                      {formData.resources.map((res, index) => (
                        <span key={index} className="badge" style={{
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.7rem',
                          borderRadius: '999px',
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          color: 'var(--text-primary)'
                        }}>
                          <strong>{res.name}</strong>
                          <span style={{ opacity: 0.6, fontSize: '0.7rem' }}>({res.type})</span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, resources: prev.resources.filter((_, i) => i !== index) }))}
                            style={{
                              background: 'none',
                              border: 'none',
                              padding: 0,
                              cursor: 'pointer',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              alignItems: 'center'
                            }}
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section 9: Senior Resume Upload */}
                <div 
                  id="sec-resume" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800
                      }}>9</div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileText size={18} />
                          Senior Resume (PDF) *
                        </h3>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Upload your resume PDF so juniors can study your formatting and project presentation
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ff3b30' }}>* Required</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div 
                      onClick={() => document.getElementById('resume-file-upload')?.click()}
                      style={{
                        border: '1.5px dashed var(--border-color)',
                        borderRadius: '16px',
                        padding: resumeUploadFile ? '1rem 1.25rem' : '1.75rem 1.25rem',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-secondary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100px',
                        color: 'var(--text-primary)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--text-primary)';
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                      }}
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
                        id="resume-file-upload" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
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
                        }} 
                        style={{ display: 'none' }}
                        accept=".pdf"
                      />
                      {resumeUploadFile ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', textAlign: 'left' }}>
                            <span style={{
                              padding: '0.6rem',
                              backgroundColor: 'rgba(255, 59, 48, 0.12)',
                              border: '1px solid rgba(255, 59, 48, 0.25)',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ff3b30'
                            }}>
                              <FileText size={20} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{resumeUploadFile.fileName}</span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{resumeUploadFile.fileSize} • Click to replace</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (resumeUploadFile.url && resumeUploadFile.url.startsWith('blob:')) {
                                URL.revokeObjectURL(resumeUploadFile.url);
                              }
                              setResumeUploadFile(null);
                            }}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ff453a',
                              border: 'none',
                              background: 'rgba(255, 69, 58, 0.1)',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title="Remove Resume"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '0.6rem'
                          }}>
                            <FileText size={22} style={{ color: 'var(--text-primary)' }} />
                          </div>
                          <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 0.25rem 0' }}>
                            Choose Resume PDF or drag &amp; drop here
                          </p>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            PDF up to 10MB
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 10: Study Materials Upload */}
                <div 
                  id="sec-materials" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--text-primary)',
                      color: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 800
                    }}>10</div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Upload size={18} />
                        Study Materials, Cheat Sheets &amp; Notes (Optional)
                      </h3>
                      <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Share personal roadmaps, handwritten notes, or formula cheat sheets
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Dropzone File Selector */}
                    <div 
                      onClick={() => document.getElementById('material-file-upload')?.click()}
                      style={{
                        border: '1.5px dashed var(--border-color)',
                        borderRadius: '16px',
                        padding: materialInput.previewUrl ? '1rem 1.25rem' : '1.75rem 1.25rem',
                        textAlign: 'center',
                        backgroundColor: 'var(--bg-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '110px'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = 'var(--text-primary)';
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      }}
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
                        id="material-file-upload" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }}
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                      {materialInput.previewUrl ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.6rem', width: '100%' }}>
                          {materialInput.type === 'Image' ? (
                            <div style={{ position: 'relative', width: '100%', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                              <img 
                                src={materialInput.previewUrl} 
                                alt="Preview" 
                                style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: '8px' }} 
                              />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                              <div style={{
                                width: '44px',
                                height: '54px',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                backgroundColor: materialInput.type === 'PDF' ? 'rgba(255, 59, 48, 0.15)' : 'rgba(0, 122, 255, 0.15)',
                                color: materialInput.type === 'PDF' ? '#ff3b30' : '#007aff',
                                fontWeight: 'bold',
                                fontSize: '0.75rem'
                              }}>
                                {materialInput.type}
                              </div>
                            </div>
                          )}
                          <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                            {materialInput.fileName}
                          </p>
                          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
                            {materialInput.fileSize} • Click to replace file
                          </p>
                        </div>
                      ) : (
                        <>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid var(--border-color)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: '0.5rem'
                          }}>
                            <Upload size={18} style={{ color: 'var(--text-primary)' }} />
                          </div>
                          <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 0.2rem 0' }}>
                            Choose Material or drop file here
                          </p>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                            Supports PDF, PNG, JPG (Max 1 file)
                          </span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.6rem' }}>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Material Title (e.g. Handwritten Notes, DSA Roadmap)"
                        value={materialInput.title}
                        onChange={(e) => setMaterialInput({ ...materialInput, title: e.target.value })}
                        style={{ flexGrow: 1 }}
                      />
                      <select 
                        className="input-field"
                        value={materialInput.type}
                        onChange={(e) => setMaterialInput({ ...materialInput, type: e.target.value })}
                        style={{ width: '150px' }}
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
                        className="btn btn-secondary"
                        style={{ padding: '0.6rem 1.1rem', borderRadius: '12px' }}
                        title="Add Material"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Materials Preview List */}
                    {formData.studyMaterials.length > 0 && (
                      <div style={{ 
                        marginTop: '0.75rem', 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                        gap: '0.75rem' 
                      }}>
                        {formData.studyMaterials.map((mat, index) => (
                          <div 
                            key={index} 
                            style={{
                              border: '1px solid var(--border-color)',
                              borderRadius: '14px',
                              padding: '0.85rem 0.6rem',
                              position: 'relative',
                              backgroundColor: 'var(--bg-primary)',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.5rem',
                              textAlign: 'center'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (mat.url && mat.url.startsWith('blob:')) {
                                  URL.revokeObjectURL(mat.url);
                                }
                                setFormData({
                                  ...formData,
                                  studyMaterials: formData.studyMaterials.filter((_, i) => i !== index)
                                });
                              }}
                              style={{
                                position: 'absolute',
                                top: '0.35rem',
                                right: '0.35rem',
                                background: 'rgba(0,0,0,0.5)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: '50%',
                                width: '20px',
                                height: '20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                fontSize: '0.7rem'
                              }}
                            >
                              ✕
                            </button>
                            
                            {mat.type === 'Image' && mat.url && mat.url !== '#' ? (
                              <div style={{ width: '100%', height: '60px', display: 'flex', justifyContent: 'center', alignItems: 'center', borderRadius: '6px', overflow: 'hidden' }}>
                                <img 
                                  src={mat.url} 
                                  alt={mat.title} 
                                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} 
                                />
                              </div>
                            ) : (
                              <div style={{ 
                                width: '38px', 
                                height: '48px', 
                                border: '1px solid var(--border-color)', 
                                borderRadius: '6px', 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                backgroundColor: mat.type === 'PDF' ? 'rgba(255, 59, 48, 0.15)' : 'rgba(0, 122, 255, 0.15)', 
                                color: mat.type === 'PDF' ? '#ff3b30' : '#007aff', 
                                fontWeight: 'bold', 
                                fontSize: '0.65rem' 
                              }}>
                                {mat.type}
                              </div>
                            )}
                            <span style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 0.25rem' }}>
                              {mat.title}
                            </span>
                            {mat.fileSize && (
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                {mat.fileSize}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 11: Custom Prompts / Extra Sections */}
                <div 
                  id="sec-custom" 
                  style={{
                    padding: '1.75rem',
                    borderRadius: '20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-color)',
                    marginBottom: '2rem',
                    scrollMarginTop: '80px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--text-primary)',
                        color: 'var(--bg-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 800
                      }}>11</div>
                      <div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Plus size={18} />
                          Custom Sections &amp; Prompts (Optional)
                        </h3>
                        <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Add custom sections like Work Culture, Salary Negotiation, or Open Source
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddCustomSection}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        border: '1px dashed var(--border-color)',
                        backgroundColor: 'transparent',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem'
                      }}
                    >
                      <Plus size={14} />
                      <span>Add Section</span>
                    </button>
                  </div>

                  {customSections.map((sec, index) => (
                    <div key={index} style={{
                      padding: '1.25rem',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      backgroundColor: 'var(--bg-primary)',
                      marginBottom: '1rem',
                      position: 'relative'
                    }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomSection(index)}
                        style={{
                          position: 'absolute',
                          top: '0.75rem',
                          right: '0.75rem',
                          background: 'rgba(255, 59, 48, 0.1)',
                          border: 'none',
                          color: '#ff3b30',
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title="Remove Section"
                      >
                        <X size={14} />
                      </button>
                      
                      <div className="input-group" style={{ marginBottom: '0.75rem', paddingRight: '2rem' }}>
                        <label className="input-label">Section Headline *</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. Work Culture & Team Dynamics, Open Source Contributions..."
                          value={sec.title}
                          onChange={(e) => handleUpdateCustomSection(index, 'title', e.target.value)}
                          required
                        />
                      </div>
                      
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label className="input-label">Section Details *</label>
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

                  {customSections.length === 0 && (
                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '0.75rem' }}>
                      No additional custom sections added yet. Click &quot;Add Section&quot; above to include extra topics.
                    </p>
                  )}
                </div>

                {/* Modal Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid var(--border-color)'
                }}>
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)} 
                    className="btn btn-secondary"
                    style={{
                      padding: '0.85rem 1.75rem',
                      borderRadius: '14px',
                      fontSize: '0.95rem',
                      fontWeight: 600
                    }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="btn btn-primary"
                    style={{ 
                      padding: '0.85rem 2.5rem',
                      borderRadius: '14px',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      opacity: submitting ? 0.7 : 1,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 18px rgba(0, 0, 0, 0.25)'
                    }}
                  >
                    {submitting ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                        <div style={{ position: 'relative', width: '22px', height: '22px' }}>
                          <svg width="22" height="22" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                            <circle
                              cx="18"
                              cy="18"
                              r="15"
                              fill="none"
                              stroke="rgba(255, 255, 255, 0.25)"
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
                            fontSize: '7px',
                            fontWeight: 'bold',
                            color: 'currentColor'
                          }}>
                            {uploadProgress}%
                          </div>
                        </div>
                        <span>{uploadProgress === 100 ? 'Saving...' : 'Submitting...'}</span>
                      </div>
                    ) : 'Submit Journey'}
                  </button>
                </div>
                {submitting && (
                  <p style={{
                    fontSize: '0.78rem',
                    color: '#ff4d4d',
                    margin: '0.6rem 0 0 0',
                    opacity: 0.9,
                    textAlign: 'right',
                    fontWeight: '500'
                  }}>
                    ⚠️ Keep this tab active. Switching or minimizing tabs will pause the upload.
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
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
