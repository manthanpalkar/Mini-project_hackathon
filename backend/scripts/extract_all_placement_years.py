import os
import re
import json
import hashlib
import subprocess
from urllib.parse import urlparse
import pypdf
import docx

PROJECT_ROOT = "/Users/swapnil/Base Zero /Placement/PROJECT FILE"
REPORTS_DIR = os.path.join(PROJECT_ROOT, "reports")
SWIFT_OCR_PATH = os.path.join(PROJECT_ROOT, "backend/scripts/ocr_pdf.swift")

YEAR_CONFIGS = {
    "2024": {
        "dir": "/Users/swapnil/Documents/Interview/Interview Experience 2024",
        "output_file": os.path.join(REPORTS_DIR, "extracted_placement_2024_stories.json"),
        "audit_file": os.path.join(REPORTS_DIR, "audit_inventory_2024.json")
    },
    "2025": {
        "dir": "/Users/swapnil/Documents/Interview/Interview Experience 2025",
        "output_file": os.path.join(REPORTS_DIR, "extracted_placement_2025_stories.json"),
        "audit_file": os.path.join(REPORTS_DIR, "audit_inventory_2025.json")
    },
    "2027": {
        "dir": "/Users/swapnil/Documents/Interview/Interview_Experience_2027",
        "output_file": os.path.join(REPORTS_DIR, "extracted_placement_2027_stories.json"),
        "audit_file": os.path.join(REPORTS_DIR, "audit_inventory_2027.json")
    }
}

BRANCH_TOKENS = {
    'EXTC', 'COMPS', 'CSE', 'CSE-AIML', 'CSE-DS', 'IT', 'MCA', 'DEPARTMENT', 
    'BRANCH', ':', 'COMPUTER', 'ENGINEERING', 'CLASS', 'OF', '2024',
    '2025', '2026', '2027', 'B', 'A', 'SEMESTER', 'CGPA', 'DIV', 'DIVISION',
    'INTERVIEW', 'EXPERIENCE', 'EXPERIENCES', 'PLACEMENT', 'REPORT',
    'MY', 'RESUME', 'CV', 'CANDIDATE', 'DEPT', 'BATCH', 'SCIENCE', 'ENGINNERING',
    'DATA', 'TECH', 'TECHNOLOGY', 'ELECTRONICS', 'TELECOMMUNICATION', 'ETRX', 'INFORMATION',
    'AI', 'ML', 'AIML', 'DS', 'COMP', 'CE', 'FE', 'SE', 'TE', 'BE'
}

COMPANY_CANONICAL_MAP = {
    "BARCLAYS": "Barclays",
    "BLACKROCK": "BlackRock",
    "BROWSERSTACK": "BrowserStack",
    "PHONEPE": "PhonePe",
    "JPMC": "J.P. Morgan",
    "JP MORGAN": "J.P. Morgan",
    "BAKER": "Baker Hughes",
    "DOLAT": "Dolat Capital",
    "IDFC": "IDFC FIRST Bank",
    "NOMURA": "Nomura",
    "ORACLE": "Oracle Financial Services (OFSS)",
    "OFSS": "Oracle Financial Services (OFSS)",
    "QUANTIPHI": "Quantiphi",
    "UBS": "UBS",
    "WORKINDIA": "WorkIndia",
    "TRANSUNION": "TransUnion",
    "KPMG": "KPMG",
    "MASTER": "Mastercard",
    "AUXO": "AuxoAI",
    "GENERAL MILLS": "General Mills",
    "INCRED": "InCred Financial Services",
    "INTERACTIVE": "Interactive Brokers",
    "ISS": "ISS STOXX",
    "ICICI": "ICICI Lombard",
    "MSCI": "MSCI",
    "MAHINDRA": "Mahindra Finance",
    "RUSSELL": "Russell Investments",
    "SMOWCODE": "Smowcode",
    "TRANSBNK": "TransBnk",
    "EDELWEISS": "Edelweiss Life Insurance",
    "EDS": "Equity Data Science (EDS)",
    "EQUITY DATA": "Equity Data Science (EDS)",
    "HYPERVERGE": "HyperVerge",
    "IDFY": "IDfy",
    "ARCON": "Arcon",
    "ACCOLITE": "Accolite Digital",
    "CARTRADE": "CarTrade Tech",
    "DEUTSCHE": "Deutsche Bank",
    "GEP": "GEP Worldwide",
    "GODREJ": "Godrej Capital",
    "INDUS": "Indus Towers",
    "REVVITY": "Revvity",
    "WISSEN": "Wissen Technology",
    "PFIZER": "Pfizer",
    "COLGATE": "Colgate-Palmolive",
    "DELOITTE": "Deloitte",
    "INFOSYS": "Infosys",
    "BNP": "BNP Paribas",
    "BNY": "BNY Mellon",
    "AXIS": "Axis Mutual Fund",
    "ASPECT": "AspectRatio"
}

def canonicalize_company(raw_name, folder_name=""):
    combined = f"{raw_name or ''} {folder_name or ''}".upper()
    for key, val in COMPANY_CANONICAL_MAP.items():
        if key in combined:
            return val
    # Fallback to cleaned folder or raw name
    c = raw_name or folder_name or "Company"
    c = re.sub(r'(_202[0-9]|_Summer_Interns|_CADP|_CR|_CTC|_CIB|_FTE|_Hackathon).*', '', c)
    c = c.replace('_', ' ').replace('-', ' ').strip().title()
    return c or "Company"

def clean_and_format_compensation(ctc_str):
    if not ctc_str: return None, None
    s = str(ctc_str).strip()
    if not s or s.lower() in ["na", "n/a", "none", "nil", "-", "—", "not disclosed"]: return None, None

    # OCR Rupee clean
    s_cleaned = re.sub(r"(?:^|[\s\+\(])[7<]\s*([6-9]\d?,\d{2},\d{3})\b", r" ₹\1", s)
    s_cleaned = re.sub(r"(?:^|[\s\+\(])[72<]\s*(1,00,000)\b", r" ₹\1", s_cleaned)
    s_cleaned = re.sub(r"(?:^|[\s\+\(])7\s*(\d{5,})\b", r" ₹\1", s_cleaned)
    s_cleaned = re.sub(r"€\s*(\d+)", r"₹\1", s_cleaned)
    s_cleaned = re.sub(r"\s+", " ", s_cleaned).strip()

    # TransUnion specific: 8,50,000 + 1,00,000 joining bonus
    if ("8,50,000" in s_cleaned or "78,50" in s_cleaned) and ("1,00,000" in s_cleaned or "71,00" in s_cleaned):
        return "8.5 + 1 (Joining Bonus) LPA", "₹8,50,000 + ₹1,00,000 joining bonus"

    # If already mentions LPA:
    if re.search(r"\b(LPA|Lakhs?\s*per\s*annum)\b", s_cleaned, re.I):
        pkg = re.sub(r"Lakhs?\s*per\s*annum", "LPA", s_cleaned, flags=re.I).strip()
        return pkg, s_cleaned

    # Quantiphi Rahul Chalwadi: (Base- ₹ 850000 per Annum) + Variables
    if "850000" in s_cleaned and "variable" in s_cleaned.lower():
        return "8.5 LPA (Base) + Variables", "₹8,50,000 (Base) + Variables"

    # ₹ 11,00,000 -> 11 LPA
    m_rupee = re.search(r"₹?\s*(\d{1,2}),(\d{2}),000\b", s_cleaned)
    if m_rupee:
        lakhs = f"{m_rupee.group(1)}.{m_rupee.group(2)}" if m_rupee.group(2) != "00" else m_rupee.group(1)
        extra = re.sub(r"₹?\s*\d{1,2},\d{2},000\s*(?:per\s*annum)?", "", s_cleaned, flags=re.I).strip()
        extra = re.sub(r"^[\+\-\s]+", "", extra).strip()
        pkg = f"{lakhs} LPA" if not extra else f"{lakhs} LPA + {extra}"
        return pkg, s_cleaned

    # Raw numbers: 900000 per Annum -> 9 LPA, 1523000 -> 15.23 LPA
    m_raw = re.search(r"₹?\s*(\d{6,7})\b", s_cleaned)
    if m_raw:
        val = int(m_raw.group(1))
        lakhs = round(val / 100000, 2)
        lakhs_str = f"{lakhs:g}"
        extra = s_cleaned.replace(m_raw.group(0), "").strip()
        extra = re.sub(r"(?:per\s*annum)", "", extra, flags=re.I).strip()
        extra = re.sub(r"^[\+\-\s]+", "", extra).strip()
        pkg = f"{lakhs_str} LPA" if not extra else f"{lakhs_str} LPA + {extra}"
        return pkg, s_cleaned

    m2 = re.match(r"^([\d\.]+)\s*L\b", s_cleaned, re.I)
    if m2: return f"{m2.group(1)} LPA", s_cleaned
    m = re.match(r"^([\d\.]+(?:\s*\+\s*[\d\.]+(?:\s*\([^\)]+\))?)?)\s*L?$", s_cleaned, re.I)
    if m: return f"{m.group(1).strip()} LPA", s_cleaned

    return s_cleaned, s_cleaned

def format_package(ctc_str):
    pkg, _ = clean_and_format_compensation(ctc_str)
    return pkg

def clean_document_text(text):
    if not text:
        return ""
    try:
        text = text.encode("utf-16", "surrogatepass").decode("utf-16", "replace")
    except Exception:
        text = text.encode("utf-8", "replace").decode("utf-8", "replace")
    text = text.replace('\xa0', ' ').replace('\u2013', '-').replace('\u2014', '--')
    text = text.replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"')
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    # Normalize punctuation spacing
    text = re.sub(r'([a-z0-9\)])\.([A-Z])', r'\1. \2', text)
    text = re.sub(r'([a-z0-9\)])\?([A-Z])', r'\1? \2', text)
    text = re.sub(r'([a-z0-9\)])\!([A-Z])', r'\1! \2', text)

    # Separate inline numbered list items that were on the same line
    text = re.sub(r'([.:!?])\s+([0-9]+[\.\)])\s+', r'\1\n\n\2 ', text)

    lines = [l.strip() for l in text.split('\n')]
    blocks = []
    current_block = []

    for l in lines:
        if not l:
            if current_block:
                blocks.append('\n'.join(current_block))
                current_block = []
            continue

        is_list = bool(re.match(r'^(?:[0-9]+[\.\)]|[\-•\*\u25cf\u25cb]|\([0-9a-zA-Z]+\))\s+', l))
        is_hdr = bool(re.match(r'^(?:Company|Job Profile|Offer Type|Internship Stipend|CTC|Location|Process Date|Placement Process|Round\s*[0-9]+|Technical Interview|HR Round|Online Aptitude|Aptitude Test|Preparation Strategy|Useful Tips|Tips|Advice)\s*[:\-]', l, re.I))

        if is_list or is_hdr:
            if current_block:
                blocks.append('\n'.join(current_block))
                current_block = []
            blocks.append(l)
        else:
            current_block.append(l)

    if current_block:
        blocks.append('\n'.join(current_block))

    return '\n\n'.join(blocks)

def extract_raw_text(file_path):
    text = ""
    page_count = 1
    ocr_used = False

    if file_path.endswith('.pdf'):
        try:
            reader = pypdf.PdfReader(file_path)
            page_count = len(reader.pages)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        except Exception:
            pass

        # Check if text is severely fragmented (e.g. Canva PDF export where avg words per line < 2.0)
        raw_lines = [l.strip() for l in text.split('\n') if l.strip()]
        avg_words = (sum(len(l.split()) for l in raw_lines) / len(raw_lines)) if raw_lines else 0
        needs_ocr = (len(text.strip()) < 50) or (len(raw_lines) > 25 and avg_words < 2.0)

        if needs_ocr and os.path.exists(SWIFT_OCR_PATH):
            try:
                proc = subprocess.run(["swift", SWIFT_OCR_PATH, file_path], capture_output=True, text=True, timeout=45)
                if proc.returncode == 0 and len(proc.stdout.strip()) > 50:
                    text = proc.stdout
                    ocr_used = True
                    pages_in_ocr = len(re.findall(r'---\s*PAGE\s*\d+\s*---', text))
                    if pages_in_ocr > 0:
                        page_count = pages_in_ocr
            except Exception:
                pass

    elif file_path.endswith('.docx'):
        try:
            doc = docx.Document(file_path)
            for p in doc.paragraphs:
                text += p.text + "\n"
            for t in doc.tables:
                for row in t.rows:
                    for c in row.cells:
                        text += c.text + "\n"
        except Exception as e:
            return "", 0, False, f"DOCX Error: {str(e)}"

    return text, page_count, ocr_used, None

def analyze_document_resources_and_links(file_path):
    raw_links = []
    text_lines = []

    if file_path.endswith('.pdf'):
        try:
            reader = pypdf.PdfReader(file_path)
            for p_idx, page in enumerate(reader.pages):
                fragments = []
                def visitor(t, cm, tm, fontDict, fontSize):
                    if t and t.strip():
                        fragments.append((t, cm[4], cm[5], fontSize))
                try:
                    p_text = page.extract_text(visitor_text=visitor) or ""
                except Exception:
                    p_text = page.extract_text() or ""
                text_lines.extend(p_text.split('\n'))

                if '/Annots' in page:
                    for a_ref in page['/Annots']:
                        try:
                            a = a_ref.get_object()
                            if a.get('/Subtype') == '/Link':
                                rect = [float(x) for x in a.get('/Rect', [])]
                                url = None
                                if '/A' in a and '/URI' in a['/A']:
                                    url = str(a['/A']['/URI'])
                                elif '/Dest' in a:
                                    url = str(a['/Dest'])
                                if url:
                                    matched = []
                                    if len(rect) == 4:
                                        x1, y1, x2, y2 = rect[0], rect[1], rect[2], rect[3]
                                        for t_frag, fx, fy, _ in fragments:
                                            if (x1 - 5) <= fx <= (x2 + 5) and (y1 - 5) <= fy <= (y2 + 5):
                                                matched.append(t_frag)
                                    anchor = "".join(matched).strip()
                                    raw_links.append({
                                        'page': p_idx + 1,
                                        'url': url,
                                        'anchor': anchor or url,
                                        'rect': rect
                                    })
                        except Exception:
                            pass
        except Exception:
            pass

    elif file_path.endswith('.docx'):
        try:
            doc = docx.Document(file_path)
            for p in doc.paragraphs:
                text_lines.append(p.text)
                for hl in p._element.xpath('.//w:hyperlink'):
                    r_id = hl.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                    anchor = ''.join(hl.xpath('.//w:t/text()')).strip()
                    url = doc.part.rels[r_id].target_ref if r_id in doc.part.rels else None
                    if url:
                        raw_links.append({'page': 1, 'url': url, 'anchor': anchor or url, 'rect': []})
            for t in doc.tables:
                for row in t.rows:
                    for c in row.cells:
                        text_lines.append(c.text)
                        for hl in c._element.xpath('.//w:hyperlink'):
                            r_id = hl.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                            anchor = ''.join(hl.xpath('.//w:t/text()')).strip()
                            url = doc.part.rels[r_id].target_ref if r_id in doc.part.rels else None
                            if url:
                                raw_links.append({'page': 1, 'url': url, 'anchor': anchor or url, 'rect': []})
        except Exception:
            pass

    url_pattern = re.compile(r'https?://[^\s<>\"\'\)]+', re.I)
    known_urls = set(l['url'] for l in raw_links)
    for line in text_lines:
        for match in url_pattern.finditer(line):
            u = match.group(0).rstrip('.,;:\'\")')
            if len(u) >= 10 and u not in known_urls:
                raw_links.append({'page': 1, 'url': u, 'anchor': u, 'rect': []})
                known_urls.add(u)

    resources = []
    study_materials = []
    resume_file = None
    seen_urls = set()

    deduped_links = []
    for l in raw_links:
        u = l['url'].rstrip('.,;:\'\")')
        if u not in seen_urls and len(u) >= 10:
            seen_urls.add(u)
            deduped_links.append({
                'page': l['page'],
                'url': u,
                'anchor': l['anchor']
            })

    for item in deduped_links:
        u = item['url']
        anchor = item['anchor']
        netloc = urlparse(u).netloc.lower()
        path = urlparse(u).path.lower()

        if 'linkedin.com' in netloc:
            continue
        if u.startswith('mailto:') or 'mailto:' in u.lower():
            continue
        if any(s in u.lower() for s in ['w3.org', 'adobe.com', 'schema.org']):
            continue

        lower_anchor = anchor.lower()

        # 1. Candidate's Verified Resume Link
        is_resume = (
            ('drive.google.com' in netloc or 'docs.google.com' in netloc) and
            (any(k in lower_anchor for k in ['resume', 'cv']) or any(k in path for k in ['resume', 'cv']) or 'resume' in os.path.basename(file_path).lower())
        )
        if is_resume and not resume_file:
            resume_fn = anchor if (anchor.endswith('.pdf') or 'resume' in lower_anchor) else 'Candidate_Verified_Resume.pdf'
            resume_file = {
                'fileName': resume_fn,
                'fileSize': 'Google Drive Document',
                'url': u
            }
            continue

        # 2. Candidate Job Description (JD)
        if any(k in lower_anchor for k in ['role jd', 'role_jd', 'intern jd', 'job description', 'jd-']) or 'jd' in path:
            jd_title = anchor if anchor and len(anchor) > 5 and not anchor.startswith('http') else 'Company Job Description (JD)'
            study_materials.append({
                'title': jd_title,
                'type': 'PDF',
                'category': 'Company Job Description',
                'fileName': anchor if anchor.endswith('.pdf') else f"{jd_title}.pdf",
                'fileSize': 'Google Drive PDF',
                'url': u
            })
            continue

        # 3. Direct PDF Document Link
        if u.endswith('.pdf') or '/pdf' in path or 'cheat-sheet' in path:
            pdf_title = anchor if (anchor and len(anchor) > 4 and not anchor.startswith('http')) else os.path.basename(path).replace('%20', ' ')
            pdf_title = re.sub(r'\.pdf$', '', pdf_title, flags=re.I).strip()
            lower_title = pdf_title.lower()

            pdf_cat = 'Verified Reference Document'
            if 'sql' in lower_title:
                pdf_cat = 'SQL Preparation'
            elif any(k in lower_title for k in ['dsa', 'striver', 'neetcode', 'blind']):
                pdf_cat = 'DSA Preparation'
            elif 'cheat' in lower_title or 'note' in lower_title:
                pdf_cat = 'Subject Notes'
            elif 'aptitude' in lower_title or 'quant' in lower_title:
                pdf_cat = 'Aptitude Preparation'

            study_materials.append({
                'title': pdf_title,
                'type': 'PDF',
                'category': pdf_cat,
                'fileName': f"{pdf_title}.pdf",
                'fileSize': 'Verified PDF Resource',
                'url': u
            })
            resources.append({
                'name': pdf_title,
                'type': 'Study Material (PDF)',
                'url': u
            })
            continue

        # 4. Google Drive folder or study archive
        if 'drive.google.com/drive/folders' in u or ('drive.google.com' in netloc and any(w in lower_anchor for w in ['folder', 'material', 'notes', 'resources', 'guide'])):
            cat = 'Interview Preparation PDFs' if 'pdf' in lower_anchor else 'Company-Specific Preparation'
            study_materials.append({
                'title': anchor if (anchor and len(anchor) > 5 and not anchor.startswith('http')) else 'Placement Preparation & Study Archive',
                'type': 'Google Drive',
                'category': cat,
                'fileName': 'Interview_Preparation_Archive',
                'fileSize': 'Google Drive Archive',
                'url': u
            })

        # 5. Classify Educational Learning Resource
        res_type = 'Study Resource'
        title = anchor if (anchor and len(anchor) > 4 and not anchor.startswith('http') and not anchor.startswith('www.')) else ''
        if 'neetcode.io' in netloc:
            res_type = 'Coding Practice / DSA'
            if not title: title = 'NeetCode DSA & Blind 75'
        elif 'takeuforward.org' in netloc:
            res_type = 'Coding Practice / DSA'
            if not title: title = "Striver's A2Z DSA Sheet"
        elif 'whimsical.com' in netloc:
            res_type = 'Study Resource'
            title = 'Whimsical OOPs Cheat Sheet by Love Babbar'
        elif 'tpointtech.com' in netloc:
            res_type = 'Study Resource'
            title = 'Tpointtech Java Tutorial'
        elif 'leetcode.com' in netloc:
            res_type = 'Coding Practice / DSA'
            if 'studyplan' in path or 'top-sql' in path: title = 'LeetCode Top SQL 50'
            elif 'problems' in path:
                pname = path.split('/')[2].replace('-', ' ').title() if len(path.split('/')) > 2 else 'Problem'
                title = f'LeetCode - {pname}'
            elif not title: title = 'LeetCode Problem Practice'
        elif 'indiabix.com' in netloc:
            res_type = 'Aptitude Preparation'
            if 'hr-interview' in path: title = 'IndiaBix HR Interview Questions'
            elif not title: title = 'IndiaBix Aptitude & Reasoning'
        elif 'geeksforgeeks.org' in netloc:
            res_type = 'Technical Notes / Puzzles'
            if 'puzzles' in path: title = 'GeeksforGeeks Top 100 Interview Puzzles'
            elif not title: title = 'GeeksforGeeks Technical Preparation'
        elif 'youtube.com' in netloc or 'youtu.be' in netloc:
            res_type = 'Video Tutorial'
            title = title or 'Interview Preparation Video Lecture'
        elif 'github.com' in netloc:
            res_type = 'Source Code / GitHub'
            if not title:
                parts = [p for p in path.split('/') if p]
                title = f'GitHub: {parts[-1]}' if parts else 'GitHub Repository'
        elif 'overleaf.com' in netloc:
            res_type = 'Resume & Portfolio'
            title = "Jake's Resume ATS LaTeX Template"
        elif 'resumeworded.com' in netloc:
            res_type = 'Resume Optimization Tool'
            title = 'Resume Worded ATS Score & Optimization'
        elif 'pastebin.com' in netloc:
            res_type = 'Source Code / Code Snippet'
            title = 'Interview Code Solution on Pastebin'
        elif 'drive.google.com' in netloc or 'docs.google.com' in netloc:
            res_type = 'Google Drive Resource'
            title = title or 'Interview Preparation Document'
        else:
            if not title:
                domain = netloc.replace('www.', '').split('.')[0].title()
                title = f'{domain} Learning Resource'

        resources.append({
            'name': title,
            'type': res_type,
            'url': u
        })

    return resources, study_materials, resume_file, deduped_links

def embed_links_in_narrative(text, links):
    if not text:
        return text
    for l in links:
        anchor = l.get('anchor', '').strip()
        url = l.get('url', '').strip()
        if not anchor or not url or len(anchor) < 4:
            continue
        if anchor.startswith('http'):
            continue
        pattern = re.compile(r'(?<!\[)' + re.escape(anchor) + r'(?!\]\()')
        if pattern.search(text):
            text = pattern.sub(f'[{anchor}]({url})', text)
    return text

ROLE_TOKENS = {
    "APPLICATION", "DEVELOPER", "ASSOCIATE", "SOFTWARE", "ENGINEER", "SDE",
    "SPECIALIST", "ANALYST", "SUMMER", "INTERN", "INTERNS", "INTERNSHIP", "TRAINEE", "GRADUATE",
    "PPO", "FTE", "INTERVIEW", "EXPERIENCE", "EXPERIENCES", "EXP", "REPORT",
    "TEMPLATE", "AAD", "GET", "ITD", "GM", "GDO", "CIB", "CR", "CADP", "SUPER",
    "DREAM", "PLACEMENT", "TECH", "DIGITAL", "FULLSTACK", "AI", "MLE", "LEADERSHIP",
    "CYBERSHALA", "CYBERSECURITY", "HACK", "HIRE", "LABS", "FINTECH", "BANKING", "CTC",
    "AGENTIC", "ROLE", "JOB", "PROFILE", "OFFER", "TYPE", "STIPEND", "PAGE"
}

COMPANY_NAMES = {
    "BARCLAYS", "BLACKROCK", "BROWSERSTACK", "PHONEPE", "JPMC", "JP", "MORGAN",
    "BAKER", "HUGHES", "DOLAT", "CAPITAL", "IDFC", "BANK", "NOMURA", "ORACLE", "OFSS",
    "QUANTIPHI", "UBS", "WORKINDIA", "TRANSUNION", "KPMG", "MASTER", "MASTERCARD",
    "AUXO", "AUXOAI", "GENERAL", "MILLS", "INCRED", "INTERACTIVE", "BROKERS", "ISS", "STOXX",
    "ICICI", "LOMBARD", "MSCI", "MAHINDRA", "FINANCE", "RUSSELL", "INVESTMENTS", "SMOWCODE",
    "TRANSBNK", "EDELWEISS", "EDS", "EQUITY", "DATA", "SCIENCE", "HYPERVERGE", "IDFY",
    "ARCON", "ACCOLITE", "CARTRADE", "DEUTSCHE", "GEP", "GODREJ", "INDUS", "TOWERS",
    "REVVITY", "WISSEN", "PFIZER", "COLGATE", "PALMOLIVE", "DELOITTE", "INFOSYS", "BNP",
    "PARIBAS", "BNY", "MELLON", "AXIS", "ASPECT", "ASPECTRATIO", "MMFSL"
}

def clean_candidate_name(raw_name, filename):
    clean_fn = re.sub(r'\.(pdf|docx)$', '', filename, flags=re.I)
    clean_fn = re.sub(r'(\s*\(\d+\)|\s*\d{4}|\b2024\b|\b2025\b|\b2026\b|\b2027\b)', '', clean_fn, flags=re.I)
    
    parts = [p.strip() for p in re.split(r'[_–\-]', clean_fn) if p.strip()]
    candidate_parts = []
    for p in parts:
        pu = p.upper()
        if pu not in ROLE_TOKENS and pu not in COMPANY_NAMES and pu not in BRANCH_TOKENS:
            camel = re.findall(r'[A-Z][a-z]+|[A-Z]+(?=[A-Z][a-z]|\b)', p)
            words = camel if len(camel) >= 2 else p.split()
            c_words = [w for w in words if w.upper() not in ROLE_TOKENS and w.upper() not in COMPANY_NAMES and w.upper() not in BRANCH_TOKENS]
            candidate_parts.extend(c_words)

    fn_name = " ".join(candidate_parts) if candidate_parts else "SPIT Senior"

    if not raw_name or raw_name.lower() in ['spit senior', 'candidate', 'resume', 'experience', 'name']:
        return fn_name

    # Clean raw_name
    n = re.sub(r'---\s*PAGE\s*\d+\s*---', '', raw_name, flags=re.I)
    n = re.sub(r'\S+@\S+', '', n)
    n = re.sub(r'[\[\]\(\)]', '', n)
    n = re.sub(r'\s+(Department|Dept|Science|Data|Enginnering|Engineering|TE|BE|COMPS|CSE|CE|EXTC|MCA|AIML|DS|\(?AIML\)?|\(?DS\)?|\(?COMPS\)?|\(?CE\)?|\(AIML\)).*', '', n, flags=re.I)
    n = re.sub(r'\s+(My\s+Resume|Candidate\s+Dept|202[0-9]\s+Batch).*', '', n, flags=re.I)
    n = re.sub(r'[_–\-]+', ' ', n)
    n = re.sub(r'\s+', ' ', n).strip()

    name_words = [w for w in n.split() if w.upper() not in BRANCH_TOKENS and w.upper() not in ROLE_TOKENS and w.upper() not in COMPANY_NAMES and not w.isdigit()]
    if 2 <= len(name_words) <= 4:
        return ' '.join(name_words)
    return fn_name

def extract_personal_cgpa(text, filename=""):
    """
    Strict Personal CGPA extraction:
    Only populates when the candidate explicitly states their personal CGPA / pointer.
    Never extracts company eligibility cutoffs!
    """
    patterns = [
        r'(?:my\s+cgpa\s+(?:was|is)|mera\s+cgpa|my\s+pointer\s+(?:was|is))\s*(?:[:\-=]\s*)?([6-9]\.\d{1,2}|10(?:\.0)?)',
        r'([A-Z][a-z]+\s+[A-Z][a-z]+)\s*,\s*CGPA\s*[:\-]?\s*([6-9]\.\d{1,2})',
        r'(?:^|\n)\s*CGPA\s*[:\-]\s*([6-9]\.\d{1,2})\s*(?:\n|$|\s+[A-Za-z]+)'
    ]
    for pat in patterns:
        m = re.search(pat, text, re.I)
        if m:
            val = m.group(m.lastindex).strip()
            # If pattern 3 (standalone CGPA: X), verify it is not an eligibility cutoff
            if pat == patterns[2]:
                start = max(0, m.start() - 40)
                end = min(len(text), m.end() + 40)
                ctx = text[start:end].lower()
                if any(w in ctx for w in ['eligibility', 'criteria', 'cutoff', 'cut-off', 'minimum', 'required', 'above', 'at least', 'keep your', 'filter']):
                    continue
            return val
    return None

def parse_experience(raw_text, filename, company_folder, full_path, passout_year):
    clean_text = clean_document_text(raw_text)
    comp_canonical = canonicalize_company("", company_folder)

    # 1. Student Name
    name = None

    # Check for Name: field
    m_name_field = re.search(r'(?:^|\n)\s*Name\s*[:\-]\s*([^\n\r]+)', clean_text, re.IGNORECASE)
    if m_name_field:
        candidate_raw = m_name_field.group(1).strip()
        words = [re.sub(r'[^A-Za-z]', '', w) for w in candidate_raw.split()]
        words = [w for w in words if w.upper() not in BRANCH_TOKENS and len(w) > 1 and not w.isdigit()]
        if 1 <= len(words) <= 4:
            name = ' '.join(words)

    # Check for Candidate, CGPA pattern
    if not name:
        normalized_head = re.sub(r'\s+', ' ', clean_text[:600])
        m_cgpa_head = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s*,\s*CGPA', normalized_head)
        if m_cgpa_head:
            name = m_cgpa_head.group(1).strip()

    # Check before Company: or Company name -
    if not name:
        m_name = re.search(r'([\s\S]*?)Company(?:\s*name)?\s*[:\-]', clean_text, re.IGNORECASE)
        if m_name:
            raw_head = m_name.group(1)
            raw_head = re.sub(r'---\s*PAGE\s*\d+\s*---', '', raw_head, flags=re.I)
            raw_head = re.sub(r'[-–—=]+', ' ', raw_head)
            words = [re.sub(r'[^A-Za-z]', '', w) for w in raw_head.split()]
            name_words = [w for w in words if w.upper() not in BRANCH_TOKENS and w.upper() not in ROLE_TOKENS and w.upper() not in COMPANY_NAMES and len(w) > 1 and not w.isdigit()]
            if 1 <= len(name_words) <= 4:
                name = ' '.join(name_words)

    name = clean_candidate_name(name, filename)

    # 2. Company Name
    m_comp = re.search(r'Company(?:\s*name)?\s*[:\-]\s*([^\n\r•]+)', clean_text, re.IGNORECASE)
    if m_comp:
        raw_c = m_comp.group(1).strip()
        raw_c = re.sub(r'\s+(Job|Profile|Offer|CTC|Location|Date|Placement|Internship).*', '', raw_c, flags=re.IGNORECASE).strip()
        comp_canonical = canonicalize_company(raw_c, company_folder)

    # 3. Role
    role = "Software Engineer"
    m_role = re.search(r'Job\s*Profile\s*:\s*([^\n\r•]+)', clean_text, re.IGNORECASE)
    if m_role:
        role = m_role.group(1).strip()
        role = re.sub(r'\s+(Offer|CTC|Location|Date|Placement|Internship|Stipend).*', '', role, flags=re.IGNORECASE).strip()
    else:
        fn = filename.lower()
        if "sde" in fn: role = "Software Development Engineer (SDE)"
        elif "ai" in fn: role = "AI Engineer"
        elif "agentic" in fn: role = "Agentic AI Specialist"
        elif "quant" in fn: role = "Quant Developer"
        elif "data" in fn and "analyst" in fn: role = "Data Analyst"
        elif "business" in fn and "analyst" in fn: role = "Business Analyst"
        elif "intern" in fn: role = "Technology Intern"
        elif "developer" in fn: role = "Technology Developer"

    # 4. Department / Branch
    branch = "CE"
    sub_branch = "CE"
    m_branch = re.search(r'(EXTC|ETRX|CSE-AIML|CSE-DS|CSE\s*AIML|CSE\s*DS|Comps\s*-\s*[AB]|Computer\s*Engineering|Information\s*Technology|MCA)', clean_text, re.IGNORECASE)
    if m_branch:
        b_raw = m_branch.group(1).upper()
        if "EXTC" in b_raw or "ETRX" in b_raw:
            branch = "EXTC"
            sub_branch = "EXTC"
        elif "AIML" in b_raw:
            branch = "CSE-AIML"
            sub_branch = "AI"
        elif "DS" in b_raw:
            branch = "CSE-DS"
            sub_branch = "DS"
        elif "COMPS" in b_raw or "COMPUTER" in b_raw:
            branch = "CE"
            sub_branch = "CE"
        elif "IT" in b_raw:
            branch = "CSE"
            sub_branch = "CSE"
        elif "MCA" in b_raw:
            branch = "CE"
            sub_branch = "MCA"

    # 5. Offer Type, CTC, Stipend, Package
    offer_type = "Placement"
    m_off = re.search(r'Offer\s*Type\s*:\s*([^\n\r•]+)', clean_text, re.IGNORECASE)
    if m_off:
        offer_type = m_off.group(1).strip()
        offer_type = re.sub(r'\s+(CTC|Location|Date|Stipend|Process)\b.*', '', offer_type, flags=re.IGNORECASE).strip()

    ctc = None
    package = None
    m_ctc = re.search(r'(?:CTC|Full-Time\s*PPO)\s*:\s*([^\n\r•]+)', clean_text, re.IGNORECASE)
    if m_ctc:
        raw_ctc = m_ctc.group(1).strip()
        raw_ctc = re.sub(r'\s+(Location|Process|Date|Placement|Useful|Tips).*', '', raw_ctc, flags=re.IGNORECASE).strip()
        package, ctc = clean_and_format_compensation(raw_ctc)

    stipend = None
    m_stipend = re.search(r'Internship\s*Stipend\s*:\s*([^\n\r•]+)', clean_text, re.IGNORECASE)
    if m_stipend:
        stipend = m_stipend.group(1).strip()
        stipend = re.sub(r'\s+(CTC|Location|Process|Date|Placement).*', '', stipend, flags=re.IGNORECASE).strip()
        stipend = re.sub(r'225,000', '25,000', stipend)
        stipend = re.sub(r'€\s*25,000', '25,000', stipend)

    # 6. Preparation Strategy & Tips for Juniors
    prep_content = ""
    tips_content = ""

    m_tips = re.search(r'(?:Useful\s*Tips|Tips\s*for\s*Juniors|Advice\s*to\s*Juniors|Tips\s*and\s*Suggestions)\s*[:\-]([\s\S]*?)$', clean_text, re.IGNORECASE)
    if not m_tips:
        m_tips = re.search(r'\n(?:Useful\s*)?Tips\s*[:\-]([\s\S]*?)$', clean_text, re.IGNORECASE)
    if m_tips:
        tips_content = m_tips.group(1).strip()

    m_prep = re.search(r'(?:Preparation\s*Strategy|How\s*to\s*Prepare|Preparation\s*and\s*Strategy)\s*[:\-]([\s\S]*?)(?:Placement\s*Process|Useful\s*Tips|Tips\s*for\s*Juniors|$)', clean_text, re.IGNORECASE)
    if m_prep:
        prep_content = m_prep.group(1).strip()

    if not prep_content and tips_content:
        prep_content = tips_content
    elif not prep_content:
        prep_content = None

    # 7. Placement Process (howSecured)
    process_content = ""
    m_proc = re.search(r'(?:Placement\s*Process|Interview\s*Experience|Selection\s*Process)\s*[:\n\r]([\s\S]*?)(?:Useful\s*Tips|Tips\s*for\s*Juniors|Advice\s*to\s*Juniors|$)', clean_text, re.IGNORECASE)
    if m_proc:
        process_content = m_proc.group(1).strip()
    else:
        m_after = re.search(r'(?:Process\s*Date|Location\s*:\s*[^\n]+)\s*[:\n\r]([\s\S]*?)$', clean_text, re.IGNORECASE)
        if m_after:
            process_content = m_after.group(1).strip()
        else:
            process_content = clean_text

    # 8. Resources, Study Materials, and Resumes
    resources, study_materials, resume_file, all_doc_links = analyze_document_resources_and_links(full_path)
    if resume_file:
        resume_file['fileName'] = f"{name} — {comp_canonical} — Resume — {passout_year}.pdf"

    # 9. Embed links into narrative
    process_content = embed_links_in_narrative(process_content, all_doc_links)
    if prep_content:
        prep_content = embed_links_in_narrative(prep_content, all_doc_links)
    if tips_content:
        tips_content = embed_links_in_narrative(tips_content, all_doc_links)

    # 10. Custom Sections
    custom_sections = []

    if tips_content:
        custom_sections.append({
            "title": "Advice & Tips for Juniors",
            "content": tips_content[:3500]
        })

    # 11. Strict Personal CGPA
    cgpa = extract_personal_cgpa(clean_text, filename)

    # 12. Deterministic Story ID
    hash_suffix = hashlib.sha256(f"{name}_{comp_canonical}_{passout_year}".encode()).hexdigest()[:8]
    story_id = f"story_{passout_year}_{hash_suffix}"

    return {
        "id": story_id,
        "name": name,
        "company": comp_canonical,
        "role": role,
        "branch": branch,
        "subBranch": sub_branch,
        "passoutYear": str(passout_year),
        "cgpa": cgpa,
        "package": package,
        "ctc": ctc,
        "stipend": stipend,
        "offerType": offer_type,
        "journey": {
            "firstYear": None,
            "secondYear": None,
            "thirdYear": None,
            "fourthYear": None,
            "prep": prep_content,
            "projects": None,
            "howSecured": process_content
        },
        "resources": resources,
        "resume": resume_file['fileName'] if resume_file else None,
        "resumeFile": resume_file,
        "studyMaterials": study_materials,
        "customSections": custom_sections,
        "source_file": filename,
        "raw_length": len(clean_text)
    }, all_doc_links

def process_year(year):
    cfg = YEAR_CONFIGS[year]
    print(f"\n=======================================================")
    print(f"PROCESSING PLACEMENT YEAR: {year}")
    print(f"Source Directory: {cfg['dir']}")
    print(f"=======================================================\n")

    if not os.path.exists(cfg['dir']):
        print(f"Error: Directory not found for year {year}: {cfg['dir']}")
        return

    all_files = []
    for root, dirs, files in os.walk(cfg['dir']):
        for f in sorted(files):
            if f.startswith('.'): continue
            if f.lower().endswith(('.pdf', '.docx')):
                # Filter out pure template files
                if 'template' in f.lower() and ('copy of' in f.lower() or f.lower().startswith('interview experience template')):
                    print(f"Skipping template file: {f}")
                    continue
                comp_folder = os.path.basename(root)
                full_path = os.path.join(root, f)
                all_files.append((full_path, f, comp_folder))

    print(f"Total candidate source files discovered for {year}: {len(all_files)}")

    extracted_records = []
    audit_records = []
    seen_candidates = {}
    duplicate_count = 0

    for full_path, filename, comp_folder in all_files:
        raw_text, page_count, ocr_used, err = extract_raw_text(full_path)

        audit_entry = {
            "source_file": filename,
            "company_folder": comp_folder,
            "pages": page_count,
            "ocr_required": ocr_used,
            "status": "extracted",
            "error": err,
            "year": year
        }

        if err:
            audit_entry["status"] = "error"
            audit_records.append(audit_entry)
            continue

        record, links = parse_experience(raw_text, filename, comp_folder, full_path, year)
        audit_entry["candidate_name"] = record["name"]
        audit_entry["company"] = record["company"]
        audit_entry["role"] = record["role"]
        audit_entry["package"] = record["package"]
        audit_entry["stipend"] = record["stipend"]
        audit_entry["cgpa"] = record["cgpa"]
        audit_entry["links_discovered"] = len(links)
        audit_entry["resources_count"] = len(record["resources"])
        audit_entry["study_materials_count"] = len(record["studyMaterials"])
        audit_entry["has_resume"] = bool(record["resumeFile"])

        # Check for candidate duplicates across DOCX / PDF
        cand_key = (record["name"].lower().strip(), record["company"].lower().strip())
        if cand_key in seen_candidates:
            prev_idx = seen_candidates[cand_key]
            prev_record = extracted_records[prev_idx]
            duplicate_count += 1
            print(f"[DUPLICATE DETECTED] {record['name']} at {record['company']} (File: {filename} vs Previous: {prev_record['source_file']})")
            
            # Merge if current file has more narrative length or more links
            if record["raw_length"] > prev_record["raw_length"]:
                # Keep current record as primary, merge previous resources
                existing_urls = set(r["url"] for r in record["resources"])
                for r in prev_record["resources"]:
                    if r["url"] not in existing_urls:
                        record["resources"].append(r)
                extracted_records[prev_idx] = record
            else:
                existing_urls = set(r["url"] for r in prev_record["resources"])
                for r in record["resources"]:
                    if r["url"] not in existing_urls:
                        prev_record["resources"].append(r)
            
            audit_entry["status"] = "merged_duplicate"
            audit_records.append(audit_entry)
            continue

        seen_candidates[cand_key] = len(extracted_records)
        extracted_records.append(record)
        audit_records.append(audit_entry)

    # Save extracted records & audit
    os.makedirs(REPORTS_DIR, exist_ok=True)
    with open(cfg['output_file'], 'w', encoding='utf-8', errors='replace') as f:
        json.dump(extracted_records, f, indent=2, ensure_ascii=False)
    with open(cfg['audit_file'], 'w', encoding='utf-8', errors='replace') as f:
        json.dump(audit_records, f, indent=2, ensure_ascii=False)

    print(f"\nCompleted Year {year}:")
    print(f"- Total source files: {len(all_files)}")
    print(f"- Unique student experiences extracted: {len(extracted_records)}")
    print(f"- Duplicates merged: {duplicate_count}")
    print(f"- CGPAs recovered: {sum(1 for r in extracted_records if r['cgpa'])}")
    print(f"- Saved output: {cfg['output_file']}")
    print(f"- Saved audit: {cfg['audit_file']}")

    return extracted_records, audit_records

if __name__ == '__main__':
    import sys
    target_year = sys.argv[1] if len(sys.argv) > 1 else "all"
    if target_year == "all":
        for y in ["2024", "2025", "2027"]:
            process_year(y)
    else:
        process_year(target_year)
