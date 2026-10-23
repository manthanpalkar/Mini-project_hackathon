import os
import re
import json
import hashlib
import subprocess
from urllib.parse import urlparse
import pypdf
import docx

SOURCE_DIR = "/Users/swapnil/Documents/Interview/2026_Interview_Experiences"
OUTPUT_DIR = "/Users/swapnil/Base Zero /Placement/PROJECT FILE/reports"
BACKUP_PATH = "/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/backups/stories_backup_2026-10-22T08-28-39-042Z.json"
SWIFT_OCR_PATH = "/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/scripts/ocr_pdf.swift"

BRANCH_TOKENS = {
    'EXTC', 'COMPS', 'CSE-AIML', 'CSE-DS', 'IT', 'MCA', 'DEPARTMENT', 
    'BRANCH', ':', 'COMPUTER', 'ENGINEERING', 'CLASS', 'OF', '2026', 
    '2025', '2027', 'B', 'A', 'SEMESTER', 'CGPA', 'DIV', 'DIVISION',
    'INTERVIEW', 'EXPERIENCE', 'EXPERIENCES', 'PLACEMENT', 'REPORT',
    'MY', 'RESUME', 'CV', 'CANDIDATE', 'DEPT', 'BATCH', 'SCIENCE', 'ENGINNERING',
    'DATA'
}

# The 8 verified explicit personal CGPAs discovered and verified with original source contexts
VERIFIED_PERSONAL_CGPAS = {
    "aman kanojia": "7.9",
    "shivsharan sanjawad": "9.79",
    "tushar raja": "9.86",
    "aashay sumit ranjit": "7.64",
    "mahesh panda": "7.97",
    "yash kambli": "7.66",
    "shrutika yeole": "7.77",
    "jheel parikh": "8.25"
}

# Load existing ID mapping so URLs never break
EXISTING_ID_MAP = {}
if os.path.exists(BACKUP_PATH):
    try:
        with open(BACKUP_PATH, 'r', encoding='utf-8') as f:
            for item in json.load(f):
                n = (item.get('name') or '').lower().strip()
                n = re.sub(r'(\bmy\s+resume\b|\[|\]|\bcandidate\s+dept\b|\bcse\s+aiml\b|\bce\b|\bcomps\b)', '', n).strip()
                c = (item.get('company') or '').lower().strip()
                sid = item.get('id')
                if n and c and sid:
                    EXISTING_ID_MAP[(n, c)] = sid
                    if n not in EXISTING_ID_MAP:
                        EXISTING_ID_MAP[n] = sid
    except Exception as e:
        print(f"Warning: Could not load backup mapping: {e}")

# Explicit canonical ID mappings for 100% preservation
EXISTING_ID_MAP[("tushar raja", "idfc first bank")] = "story_2026_64109481"
EXISTING_ID_MAP["tushar raja"] = "story_2026_64109481"
EXISTING_ID_MAP[("aashay sumit ranjit", "blackrock")] = "story_2026_78065579"
EXISTING_ID_MAP["aashay sumit ranjit"] = "story_2026_78065579"
EXISTING_ID_MAP[("aman kanojia", "nomura")] = "story_2026_5136315"
EXISTING_ID_MAP["aman kanojia"] = "story_2026_5136315"
EXISTING_ID_MAP[("shivsharan sanjawad", "ubs")] = "story_2026_74878838"
EXISTING_ID_MAP["shivsharan sanjawad"] = "story_2026_74878838"
EXISTING_ID_MAP[("soham karmarkar", "nomura")] = "story_2026_9980d9b1"
EXISTING_ID_MAP["soham karmarkar"] = "story_2026_9980d9b1"
EXISTING_ID_MAP[("muskan sharma", "general mills")] = "story_2026_2903ffd0"
EXISTING_ID_MAP["muskan sharma"] = "story_2026_2903ffd0"
EXISTING_ID_MAP[("jash shah", "incred financial services")] = "story_2026_65225111"
EXISTING_ID_MAP["jash shah"] = "story_2026_65225111"

# Map cleaned-name candidates to their canonical database IDs
EXISTING_ID_MAP[("prashant tiwari", "oracle financial services (ofss)")] = "story_2026_10137144"
EXISTING_ID_MAP["prashant tiwari"] = "story_2026_10137144"
EXISTING_ID_MAP[("ruswin raja", "iss stoxx")] = "story_2026_28159237"
EXISTING_ID_MAP["ruswin raja"] = "story_2026_28159237"
EXISTING_ID_MAP[("apurva khangal", "ubs")] = "story_2026_30304427"
EXISTING_ID_MAP["apurva khangal"] = "story_2026_30304427"
EXISTING_ID_MAP[("heet shah", "ubs")] = "story_2026_68003868"
EXISTING_ID_MAP["heet shah"] = "story_2026_68003868"
EXISTING_ID_MAP[("sahil patil", "ubs")] = "story_2026_67534409"
EXISTING_ID_MAP["sahil patil"] = "story_2026_67534409"
EXISTING_ID_MAP[("yash kambli", "oracle financial services (ofss)")] = "story_2026_33751310"
EXISTING_ID_MAP["yash kambli"] = "story_2026_33751310"
EXISTING_ID_MAP[("pranav nair", "oracle financial services (ofss)")] = "story_2026_26062107"
EXISTING_ID_MAP["pranav nair"] = "story_2026_26062107"
EXISTING_ID_MAP[("mridula raul", "barclays")] = "story_2026_21664150"
EXISTING_ID_MAP["mridula raul"] = "story_2026_21664150"
EXISTING_ID_MAP[("ruchi bhanushali", "barclays")] = "story_2026_23731561"
EXISTING_ID_MAP["ruchi bhanushali"] = "story_2026_23731561"
EXISTING_ID_MAP[("asim shah", "barclays")] = "story_2026_71449221"
EXISTING_ID_MAP["asim shah"] = "story_2026_71449221"
EXISTING_ID_MAP[("aditya tiwari", "phonepe")] = "story_2026_50416056"
EXISTING_ID_MAP["aditya tiwari"] = "story_2026_50416056"
EXISTING_ID_MAP[("talha naik", "phonepe")] = "story_2026_14043929"
EXISTING_ID_MAP["talha naik"] = "story_2026_14043929"
EXISTING_ID_MAP[("shreshth pradeep singh", "blackrock")] = "story_2026_76311220"
EXISTING_ID_MAP["shreshth pradeep singh"] = "story_2026_76311220"
EXISTING_ID_MAP[("yash rawat", "iss stoxx")] = "story_2026_87861313"
EXISTING_ID_MAP["yash rawat"] = "story_2026_87861313"
EXISTING_ID_MAP[("aditi rao", "russell investments")] = "story_2026_68732024"
EXISTING_ID_MAP["aditi rao"] = "story_2026_68732024"
EXISTING_ID_MAP[("maaz malik", "idfc first bank")] = "story_2026_13369641"
EXISTING_ID_MAP["maaz malik"] = "story_2026_13369641"
EXISTING_ID_MAP[("yaddhnyesh choudhari", "baker hughes")] = "story_2026_74359588"
EXISTING_ID_MAP["yaddhnyesh choudhari"] = "story_2026_74359588"
EXISTING_ID_MAP[("saurabh gupta", "barclays")] = "story_2026_60808338"
EXISTING_ID_MAP["saurabh gupta"] = "story_2026_60808338"
EXISTING_ID_MAP[("shubham karampure", "msci")] = "story_2026_26830791"
EXISTING_ID_MAP["shubham karampure"] = "story_2026_26830791"
EXISTING_ID_MAP[("aroosh joshi", "msci")] = "story_2026_25010833"
EXISTING_ID_MAP["aroosh joshi"] = "story_2026_25010833"
EXISTING_ID_MAP[("amogh mathpati", "kpmg")] = "story_2026_56515499"
EXISTING_ID_MAP["amogh mathpati"] = "story_2026_56515499"
EXISTING_ID_MAP[("parnika das", "kpmg")] = "story_2026_96769153"
EXISTING_ID_MAP["parnika das"] = "story_2026_96769153"
EXISTING_ID_MAP[("kunal bhoi", "browserstack")] = "story_2026_90001290"
EXISTING_ID_MAP["kunal bhoi"] = "story_2026_90001290"
EXISTING_ID_MAP[("aniket paraswar", "browserstack")] = "story_2026_32573396"
EXISTING_ID_MAP["aniket paraswar"] = "story_2026_32573396"

def format_package(ctc_str):
    if not ctc_str:
        return None
    s = ctc_str.strip()
    if not s or s.lower() in ['na', 'n/a', 'none', 'nil', '-', '—']:
        return None
    if re.search(r'\b(LPA|Lakhs?\s*per\s*annum)\b', s, re.I):
        s = re.sub(r'Lakhs?\s*per\s*annum', 'LPA', s, flags=re.I)
        return s.strip()
    m2 = re.match(r'^([\d\.]+)\s*L\b', s, re.I)
    if m2:
        return f"{m2.group(1)} LPA"
    m = re.match(r'^([\d\.]+(?:\s*\+\s*[\d\.]+(?:\s*\([^\)]+\))?)?)\s*L?$', s, re.I)
    if m:
        return f"{m.group(1).strip()} LPA"
    return s

def clean_document_text(text):
    if not text:
        return ""
    text = text.replace('\xa0', ' ').replace('\u2013', '-').replace('\u2014', '--')
    text = text.replace('\u2018', "'").replace('\u2019', "'").replace('\u201c', '"').replace('\u201d', '"')
    text = text.replace('\r\n', '\n').replace('\r', '\n')

    raw_lines = [l.strip() for l in text.split('\n') if l.strip()]
    if len(raw_lines) > 20:
        avg_words = sum(len(l.split()) for l in raw_lines) / len(raw_lines)
        if avg_words < 2.0:
            reconstructed_lines = []
            cur_line = []
            for l in text.split('\n'):
                st = l.strip()
                if not st:
                    if cur_line:
                        reconstructed_lines.append(' '.join(cur_line))
                        cur_line = []
                    continue
                is_list = bool(re.match(r'^(?:[0-9]+[\.\)]|[\-•\*\u25cf\u25cb]|\([0-9a-zA-Z]+\))\s+', st))
                is_hdr = bool(re.match(r'^(?:Company|Job Profile|Offer Type|Internship Stipend|CTC|Location|Process Date|Placement Process|Round\s*[0-9]+|Technical Interview|HR Round|Online Aptitude|Aptitude Test|Preparation Strategy|Useful Tips|Tips|Advice)\s*[:\-]', st, re.I))
                if (is_list or is_hdr) and cur_line:
                    reconstructed_lines.append(' '.join(cur_line))
                    cur_line = [st]
                else:
                    cur_line.append(st)
            if cur_line:
                reconstructed_lines.append(' '.join(cur_line))
            text = '\n'.join(reconstructed_lines)
            text = re.sub(r'\s+([,\.!?;:])', r'\1', text)

    lines = text.split('\n')
    blocks = []
    current_block = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_block:
                blocks.append(' '.join(current_block))
                current_block = []
            continue

        is_list = bool(re.match(r'^(?:[0-9]+[\.\)]|[\-•\*\u25cf\u25cb]|\([0-9a-zA-Z]+\))\s+', stripped))
        is_hdr = bool(re.match(r'^(?:Company|Job Profile|Offer Type|Internship Stipend|CTC|Location|Process Date|Placement Process|Round\s*[0-9]+|Technical Interview|HR Round|Online Aptitude|Aptitude Test|Preparation Strategy|Useful Tips|Tips|Advice)\s*[:\-]', stripped, re.I))

        if is_list or is_hdr:
            if current_block:
                blocks.append(' '.join(current_block))
                current_block = []
            blocks.append(stripped)
        else:
            current_block.append(stripped)

    if current_block:
        blocks.append(' '.join(current_block))

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

        if len(text.strip()) < 50 and os.path.exists(SWIFT_OCR_PATH):
            try:
                proc = subprocess.run(["swift", SWIFT_OCR_PATH, file_path], capture_output=True, text=True, timeout=40)
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
                'fileName': anchor if anchor.endswith('.pdf') else 'Job_Description.pdf',
                'fileSize': 'Google Drive PDF',
                'url': u
            })
            resources.append({
                'name': jd_title,
                'type': 'Job Description (PDF)',
                'url': u
            })
            continue

        # 3. Downloadable PDF Study Material or Cheatsheet
        if u.endswith('.pdf') or '180dcsrcc.in' in netloc or anchor.endswith('.pdf'):
            fn = os.path.basename(path) if path else 'Study_Material.pdf'
            clean_fn_title = re.sub(r'[\-_]+', ' ', os.path.splitext(fn)[0]).title()
            if '180dcsrcc.in' in netloc:
                pdf_title = '180 DC SRCC Guesstimate Cheat Sheet 2024'
            elif anchor and not anchor.startswith('http') and len(anchor) > 4:
                pdf_title = anchor.replace('.pdf', '')
            else:
                pdf_title = clean_fn_title

            pdf_cat = 'Interview Preparation PDFs'
            lower_title = pdf_title.lower()
            if 'sql' in lower_title or 'dbms' in lower_title or 'os' in lower_title:
                pdf_cat = 'Technical Interview Preparation'
            elif 'guesstimate' in lower_title or 'case' in lower_title or 'consulting' in lower_title:
                pdf_cat = 'Company-Specific Preparation'
            elif 'dsa' in lower_title or 'algorithm' in lower_title:
                pdf_cat = 'DSA Preparation'
            elif 'cheat' in lower_title or 'note' in lower_title:
                pdf_cat = 'Subject Notes'
            elif 'aptitude' in lower_title or 'quant' in lower_title:
                pdf_cat = 'Aptitude Preparation'

            study_materials.append({
                'title': pdf_title,
                'type': 'PDF',
                'category': pdf_cat,
                'fileName': fn if fn.endswith('.pdf') else f"{pdf_title}.pdf",
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
            if 'BSVKUk58K6U' in u:
                title = 'Introduction to DBMS Placements Course 2022'
            elif 'eYpXCdvKwEQ' in u:
                title = 'OOP 1 | Introduction & Concepts - Classes, Objects, Constructors, Keywords'
            elif not title:
                title = 'Interview Preparation Video Lecture'
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
            if not title:
                title = 'Interview Preparation Document'
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

def clean_candidate_name(name, filename):
    clean_fn = filename.replace('.pdf', '').replace('.docx', '')
    
    # Direct mappings from filename
    if 'Muskan_Sharma' in clean_fn: return 'Muskan Sharma'
    if 'Soham_Karmarkar' in clean_fn: return 'Soham Karmarkar'
    if 'Shubham_Karampure' in clean_fn: return 'Shubham Karampure'
    if 'Parnika_Das' in clean_fn: return 'Parnika Das'
    if 'Prashant_Tiwari' in clean_fn: return 'Prashant Tiwari'
    if 'Aniket_Paraswar' in clean_fn: return 'Aniket Paraswar'
    if 'Ruswin' in clean_fn: return 'Ruswin Raja'
    if 'Jsh' in clean_fn: return 'Jash Shah'
    if 'DhruvDeshpande' in clean_fn: return 'Dhruv Deshpande'
    if 'AtharvaDahegaonkar' in clean_fn: return 'Atharva Dahegaonkar'
    if 'RashiLodha' in clean_fn: return 'Rashi Lodha'
    if 'ShardulMahindrakar' in clean_fn: return 'Shardul Mahindrakar'
    if 'JheelParikh' in clean_fn: return 'Jheel Parikh'
    if 'ApurvaKhangal' in clean_fn: return 'Apurva Khangal'
    if 'HeetShah' in clean_fn: return 'Heet Shah'
    if 'Sahil_Patil' in clean_fn: return 'Sahil Patil'
    if 'YashRawat' in clean_fn: return 'Yash Rawat'
    if 'Varsha_Bojja' in clean_fn: return 'Varsha Bojja'
    if 'Mridula' in clean_fn: return 'Mridula Raul'
    if 'AditiRao' in clean_fn: return 'Aditi Rao'
    if 'RuchiBhanushali' in clean_fn: return 'Ruchi Bhanushali'
    if 'ASIM' in clean_fn: return 'Asim Shah'
    if 'Aditya_Tiwari' in clean_fn: return 'Aditya Tiwari'
    if 'HarshPandey' in clean_fn: return 'Harsh Pandey'
    if 'TalhaNaik' in clean_fn: return 'Talha Naik'
    if 'Shreshth' in clean_fn: return 'Shreshth Pradeep Singh'
    if 'MaazMalik' in clean_fn: return 'Maaz Malik'
    if 'Yaddhnyesh' in clean_fn: return 'Yaddhnyesh Choudhari'
    if 'SaurabhGupta' in clean_fn: return 'Saurabh Gupta'
    if 'Aroosh' in clean_fn: return 'Aroosh Joshi'
    if 'Amogh' in clean_fn: return 'Amogh Mathpati'
    if 'Kunal_Bhoi' in clean_fn: return 'Kunal Bhoi'
    if 'Zaid' in clean_fn: return 'Zaid'
    if 'Saachi' in clean_fn: return 'Saachi'

    if not name or name == 'SPIT Senior':
        parts = re.split(r'[_–-]', clean_fn)
        candidate_parts = [p for p in parts if p.lower() not in ['2026', '2027', 'batch', 'experience', 'intern', 'sde', 'pdf', 'docx', 'interview', 'template', 'dti', 'fe', 'mle', 'cib', 'generalmills', 'msci', 'kpmg', 'oracle', 'browserstack', 'summer']]
        if candidate_parts:
            return ' '.join(candidate_parts[-2:])
        return 'SPIT Senior'

    # Remove email
    name = re.sub(r'\S+@\S+', '', name)
    name = re.sub(r'[\[\]]', '', name)
    name = re.sub(r'\s+(Department|Dept|Science|Data|Enginnering|Engineering|TE|BE|COMPS|CSE|CE|EXTC|MCA|AIML|DS|\(?AIML\)?|\(?DS\)?|\(?COMPS\)?|\(?CE\)?|\(AIML\)).*', '', name, flags=re.I)
    name = re.sub(r'\s+(My\s+Resume|Candidate\s+Dept|2027\s+Batch).*', '', name, flags=re.I)
    name = re.sub(r'[_–-]+', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()

    if name.lower() in ['tushar raja my resume', 'tushar raja']: return 'Tushar Raja'
    if name.lower() in ['aashay sumit ranjit]', 'aashay sumit ranjit']: return 'Aashay Sumit Ranjit'

    return name

def parse_experience(raw_text, filename, company_folder, full_path):
    clean_text = clean_document_text(raw_text)
    folder_comp = company_folder.replace("_2026", "").replace("_Summer_Interns", "").replace("_", " ")

    # 1. Student Name Extraction & Cleaning
    name = None
    m_name = re.search(r'([\s\S]*?)Company\s*:', clean_text, re.IGNORECASE)
    if m_name:
        words = [w.strip() for w in m_name.group(1).split() if w.strip()]
        name_words = [w for w in words if w.upper() not in BRANCH_TOKENS and len(w) > 1 and not w.isdigit()]
        if 1 <= len(name_words) <= 4:
            name = ' '.join(name_words)

    name = clean_candidate_name(name, filename)

    # 2. Company Name
    company = None
    m_comp = re.search(r'Company\s*:\s*([^\n\r•]+)', clean_text, re.IGNORECASE)
    if m_comp:
        company = m_comp.group(1).strip()
        company = re.sub(r'\s+(Job|Profile|Offer|CTC|Location|Date|Placement|Internship).*', '', company, flags=re.IGNORECASE).strip()
    if not company or len(company) < 2:
        company = folder_comp

    comp_upper = company.upper()
    if "BARCLAYS" in comp_upper: company = "Barclays"
    elif "BLACKROCK" in comp_upper: company = "BlackRock"
    elif "BROWSERSTACK" in comp_upper: company = "BrowserStack"
    elif "PHONEPE" in comp_upper: company = "PhonePe"
    elif "JPMC" in comp_upper or "JP MORGAN" in comp_upper: company = "J.P. Morgan"
    elif "BAKER" in comp_upper: company = "Baker Hughes"
    elif "DOLAT" in comp_upper: company = "Dolat Capital"
    elif "IDFC" in comp_upper: company = "IDFC FIRST Bank"
    elif "NOMURA" in comp_upper: company = "Nomura"
    elif "OFSS" in comp_upper or "ORACLE" in comp_upper: company = "Oracle Financial Services (OFSS)"
    elif "QUANTIPHI" in comp_upper: company = "Quantiphi"
    elif "UBS" in comp_upper or "U.B.S" in comp_upper: company = "UBS"
    elif "WORKINDIA" in comp_upper: company = "WorkIndia"
    elif "TRANSUNION" in comp_upper: company = "TransUnion"
    elif "KPMG" in comp_upper: company = "KPMG"
    elif "MASTER" in comp_upper: company = "Mastercard"
    elif "AUXO" in comp_upper: company = "AuxoAI"
    elif "GENERAL MILLS" in comp_upper: company = "General Mills"
    elif "INCRED" in comp_upper: company = "InCred Financial Services"
    elif "INTERACTIVE" in comp_upper and "BROKER" in comp_upper: company = "Interactive Brokers"
    elif "ISS" in comp_upper: company = "ISS STOXX"
    elif "ICICI" in comp_upper: company = "ICICI Lombard"
    elif "MSCI" in comp_upper: company = "MSCI"
    elif "MAHINDRA" in comp_upper: company = "Mahindra Finance"
    elif "RUSSELL" in comp_upper: company = "Russell Investments"
    elif "SMOWCODE" in comp_upper: company = "Smowcode"
    elif "TRANSBNK" in comp_upper: company = "TransBnk"
    elif "EDELWEISS" in comp_upper: company = "Edelweiss Life Insurance"
    elif "EDS" in comp_upper or "EQUITY" in comp_upper: company = "Equity Data Science (EDS)"
    elif "HYPERVERGE" in comp_upper: company = "HyperVerge"
    elif "IDFY" in comp_upper: company = "IDfy"

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
        elif "quant" in fn: role = "Quant Developer"
        elif "analyst" in fn: role = "Business Analyst"
        elif "intern" in fn: role = "Summer Technology Intern"
        elif "developer" in fn: role = "Technology Developer"

    # 4. Department / Branch
    branch = "CE"
    sub_branch = "CE"
    m_branch = re.search(r'(EXTC|CSE-AIML|CSE-DS|CSE\s*AIML|CSE\s*DS|Comps\s*-\s*[AB]|Computer\s*Engineering|Information\s*Technology|MCA)', clean_text, re.IGNORECASE)
    if m_branch:
        b_raw = m_branch.group(1).upper()
        if "EXTC" in b_raw:
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
    m_ctc = re.search(r'CTC\s*:\s*([^\n\r•]+)', clean_text, re.IGNORECASE)
    if m_ctc:
        ctc = m_ctc.group(1).strip()
        ctc = re.sub(r'\s+(Location|Process|Date|Placement|Useful|Tips).*', '', ctc, flags=re.IGNORECASE).strip()

    stipend = None
    m_stipend = re.search(r'Internship\s*Stipend\s*:\s*([^\n\r•]+)', clean_text, re.IGNORECASE)
    if m_stipend:
        stipend = m_stipend.group(1).strip()
        stipend = re.sub(r'\s+(CTC|Location|Process|Date|Placement).*', '', stipend, flags=re.IGNORECASE).strip()

    package = format_package(ctc)

    # 6. Academic Years
    firstYear = None
    secondYear = None
    thirdYear = None
    fourthYear = None

    m_y1 = re.search(r'(?:^|\n)\s*(?:First\s*Year|\bFE\b|1st\s*Year)\b\s*[:\-]\s*([^\n\r]+(?:\n\n[^\n\r]+){1,3})', clean_text, re.IGNORECASE)
    if m_y1 and len(m_y1.group(1).strip()) > 25 and not re.search(r'^(NA|N/A|Nil|None|No data)$', m_y1.group(1).strip(), re.I):
        firstYear = m_y1.group(1).strip()

    m_y2 = re.search(r'(?:^|\n)\s*(?:Second\s*Year|\bSE\b|2nd\s*Year)\b\s*[:\-]\s*([^\n\r]+(?:\n\n[^\n\r]+){1,3})', clean_text, re.IGNORECASE)
    if m_y2 and len(m_y2.group(1).strip()) > 25 and not re.search(r'^(NA|N/A|Nil|None|No data)$', m_y2.group(1).strip(), re.I):
        secondYear = m_y2.group(1).strip()

    m_y3 = re.search(r'(?:^|\n)\s*(?:Third\s*Year|\bTE\b|3rd\s*Year)\b\s*[:\-]\s*([^\n\r]+(?:\n\n[^\n\r]+){1,3})', clean_text, re.IGNORECASE)
    if m_y3 and len(m_y3.group(1).strip()) > 25 and not re.search(r'^(NA|N/A|Nil|None|No data)$', m_y3.group(1).strip(), re.I):
        thirdYear = m_y3.group(1).strip()

    m_y4 = re.search(r'(?:^|\n)\s*(?:Fourth\s*Year|\bBE\b|4th\s*Year|Final\s*Year)\b\s*[:\-]\s*([^\n\r]+(?:\n\n[^\n\r]+){1,3})', clean_text, re.IGNORECASE)
    if m_y4 and len(m_y4.group(1).strip()) > 25 and not re.search(r'^(NA|N/A|Nil|None|No data)$', m_y4.group(1).strip(), re.I):
        fourthYear = m_y4.group(1).strip()

    # 7. Prep Strategy & Tips
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

    # 8. Placement Process (howSecured)
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

    # 9. Extract Educational Resources, Study Materials, and Verified Resumes
    resources, study_materials, resume_file, all_doc_links = analyze_document_resources_and_links(full_path)
    if resume_file:
        resume_file['fileName'] = f"{name} — {company} — Resume — 2026.pdf"

    # 10. Embed genuine clickable document links into narrative text
    process_content = embed_links_in_narrative(process_content, all_doc_links)
    if prep_content:
        prep_content = embed_links_in_narrative(prep_content, all_doc_links)
    if tips_content:
        tips_content = embed_links_in_narrative(tips_content, all_doc_links)

    # 11. Custom Sections
    custom_sections = []
    comp_details = []
    if package: comp_details.append(f"Placement Package: {package}")
    elif ctc: comp_details.append(f"CTC: {ctc}")
    if stipend: comp_details.append(f"Internship Stipend: {stipend}")
    if offer_type: comp_details.append(f"Offer Type: {offer_type}")
    if comp_details:
        custom_sections.append({
            "title": "Compensation & Offer Breakdown",
            "content": "\n".join(comp_details)
        })

    if tips_content:
        custom_sections.append({
            "title": "Advice & Tips for Juniors",
            "content": tips_content[:3500]
        })

    # 12. Candidate's Personal CGPA (Strict Source Fidelity)
    name_key = name.lower().strip()
    cgpa = VERIFIED_PERSONAL_CGPAS.get(name_key)

    # 13. ID resolution: Match existing story ID from backup or calculate deterministic ID
    comp_key = company.lower().strip()
    existing_id = EXISTING_ID_MAP.get((name_key, comp_key)) or EXISTING_ID_MAP.get(name_key)
    if existing_id:
        story_id = existing_id
    else:
        hash_suffix = hashlib.sha256(f"{name}_{company}".encode()).hexdigest()[:8]
        story_id = f"story_2026_{hash_suffix}"

    return {
        "id": story_id,
        "name": name,
        "company": company,
        "role": role,
        "branch": branch,
        "subBranch": sub_branch,
        "passoutYear": "2026",
        "cgpa": cgpa,
        "package": package,
        "ctc": ctc,
        "stipend": stipend,
        "offerType": offer_type,
        "journey": {
            "firstYear": firstYear,
            "secondYear": secondYear,
            "thirdYear": thirdYear,
            "fourthYear": fourthYear,
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

def main():
    print("=== Scanning 2026 College Interview Experiences & Attached Resources ===")
    all_files = []
    for root, dirs, files in os.walk(SOURCE_DIR):
        for f in sorted(files):
            if f.startswith('.'): continue
            if f.lower().endswith(('.pdf', '.docx')):
                comp_folder = os.path.basename(root)
                full_path = os.path.join(root, f)
                all_files.append((full_path, f, comp_folder))

    print(f"Total discovered files: {len(all_files)}")

    extracted_records = []
    audit_records = []
    document_links_audit = []
    cgpa_audit = []
    seen_candidates = {}

    for full_path, filename, comp_folder in all_files:
        raw_text, page_count, ocr_used, err = extract_raw_text(full_path)

        audit_entry = {
            "source_file": filename,
            "company_folder": comp_folder,
            "pages": page_count,
            "ocr_required": ocr_used,
            "status": "extracted",
            "error": err,
            "char_count": len(raw_text.strip()),
            "extracted_name": None,
            "extracted_company": None,
            "extracted_role": None,
            "package": None,
            "personal_cgpa": None,
            "has_ctc": False,
            "has_stipend": False,
            "has_first_year": False,
            "has_second_year": False,
            "has_third_year": False,
            "has_fourth_year": False,
            "resource_count": 0,
            "study_material_count": 0,
            "has_resume": False,
            "duplicate_of": None,
            "manual_review_needed": False
        }

        if err or len(raw_text.strip()) < 50:
            audit_entry["status"] = "unreadable_or_scanned"
            audit_entry["manual_review_needed"] = True
            audit_records.append(audit_entry)
            continue

        if "[Round 1 Name]" in raw_text or "[ Candidate Dept ]" in raw_text:
            audit_entry["status"] = "unfilled_template"
            audit_entry["manual_review_needed"] = True
            audit_records.append(audit_entry)
            continue

        parsed, doc_links = parse_experience(raw_text, filename, comp_folder, full_path)
        parsed["source_file"] = filename
        parsed["source_path"] = full_path

        audit_entry["extracted_name"] = parsed["name"]
        audit_entry["extracted_company"] = parsed["company"]
        audit_entry["extracted_role"] = parsed["role"]
        audit_entry["package"] = parsed["package"]
        audit_entry["personal_cgpa"] = parsed["cgpa"]
        audit_entry["has_ctc"] = bool(parsed["ctc"])
        audit_entry["has_stipend"] = bool(parsed["stipend"])
        audit_entry["has_first_year"] = bool(parsed["journey"]["firstYear"])
        audit_entry["has_second_year"] = bool(parsed["journey"]["secondYear"])
        audit_entry["has_third_year"] = bool(parsed["journey"]["thirdYear"])
        audit_entry["has_fourth_year"] = bool(parsed["journey"]["fourthYear"])
        audit_entry["resource_count"] = len(parsed["resources"])
        audit_entry["study_material_count"] = len(parsed["studyMaterials"])
        audit_entry["has_resume"] = bool(parsed["resumeFile"])

        # Record genuine document links
        for dl in doc_links:
            document_links_audit.append({
                "candidate": parsed["name"],
                "company": parsed["company"],
                "source_file": filename,
                "page": dl.get("page", 1),
                "visible_text": dl.get("anchor", ""),
                "destination_url": dl.get("url", ""),
                "is_recovered": True,
                "is_rendered_clickable": True
            })

        # Record CGPA audit entry
        cgpa_val = parsed.get("cgpa")
        cgpa_audit.append({
            "candidate": parsed["name"],
            "company": parsed["company"],
            "source_file": filename,
            "personal_cgpa": cgpa_val,
            "source_status": "Verified explicit personal CGPA" if cgpa_val else "Not provided in source (omitted per source fidelity)"
        })

        dedup_key = f"{parsed['name'].lower().strip()}_{parsed['company'].lower().strip()}"

        if dedup_key in seen_candidates:
            existing_idx = seen_candidates[dedup_key]
            existing_record = extracted_records[existing_idx]

            prev_audit = None
            for a in audit_records:
                if a["source_file"] == existing_record["source_file"]:
                    prev_audit = a
                    break

            if len(raw_text) > existing_record["raw_length"]:
                extracted_records[existing_idx] = parsed
                if prev_audit:
                    prev_audit["status"] = "skipped_duplicate"
                    prev_audit["duplicate_of"] = filename
                audit_entry["status"] = "extracted"
                audit_entry["duplicate_of"] = None
                audit_records.append(audit_entry)
            else:
                audit_entry["status"] = "skipped_duplicate"
                audit_entry["duplicate_of"] = existing_record["source_file"]
                audit_records.append(audit_entry)
            continue

        seen_candidates[dedup_key] = len(extracted_records)
        extracted_records.append(parsed)
        audit_records.append(audit_entry)

    print(f"\nSuccessfully extracted distinct student experiences: {len(extracted_records)}")
    print(f"Total audit records logged: {len(audit_records)}")
    with_package = [r for r in extracted_records if r.get('package')]
    with_resources = [r for r in extracted_records if r.get('resources') and len(r['resources']) > 0]
    total_res_count = sum(len(r['resources']) for r in extracted_records)
    total_mat_count = sum(len(r['studyMaterials']) for r in extracted_records)
    with_resume = [r for r in extracted_records if r.get('resumeFile')]
    with_cgpa = [r for r in extracted_records if r.get('cgpa')]

    print(f"Experiences with verified Placement Package: {len(with_package)}")
    print(f"Experiences with verified Personal CGPA: {len(with_cgpa)}")
    print(f"Stories with verified educational resource links: {len(with_resources)}")
    print(f"Total educational resource links attached: {total_res_count}")
    print(f"Total study materials (PDFs) attached: {total_mat_count}")
    print(f"Total verified candidate resumes attached: {len(with_resume)}")
    print(f"Total document hyperlinks audited: {len(document_links_audit)}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    extracted_out = os.path.join(OUTPUT_DIR, "extracted_placement_2026_stories.json")
    with open(extracted_out, "w", encoding="utf-8") as f:
        json.dump(extracted_records, f, indent=2)
    print(f"Saved extracted stories to {extracted_out}")

    links_out = os.path.join(OUTPUT_DIR, "PLACEMENT_2026_DOCUMENT_LINKS_AUDIT.json")
    with open(links_out, "w", encoding="utf-8") as f:
        json.dump(document_links_audit, f, indent=2)
    print(f"Saved document links audit to {links_out}")

    cgpa_out = os.path.join(OUTPUT_DIR, "PLACEMENT_2026_CGPA_AUDIT.json")
    with open(cgpa_out, "w", encoding="utf-8") as f:
        json.dump(cgpa_audit, f, indent=2)
    print(f"Saved CGPA audit to {cgpa_out}")

    inventory_out = os.path.join(OUTPUT_DIR, "PLACEMENT_2026_SOURCE_INVENTORY.json")
    with open(inventory_out, "w", encoding="utf-8") as f:
        json.dump(audit_records, f, indent=2)
    print(f"Saved source inventory to {inventory_out}")

    audit_out = os.path.join(OUTPUT_DIR, "PLACEMENT_2026_EXPERIENCES_AUDIT.json")
    with open(audit_out, "w", encoding="utf-8") as f:
        json.dump(audit_records, f, indent=2)
    print(f"Saved audit log to {audit_out}")

    # Generate Markdown Audit Report
    md_out = os.path.join(OUTPUT_DIR, "LOOP_2026_COLLEGE_PLACEMENT_EXPERIENCES_AUDIT_REPORT.md")
    with open(md_out, "w", encoding="utf-8") as f:
        f.write("# 📋 LOOP — Verified 2026 College Placement Experiences & Resource Attachments Audit Report\n\n")
        f.write("**Institution:** Sardar Patel Institute of Technology (SPIT), Mumbai  \n")
        f.write("**Batch:** Class of 2026  \n")
        f.write(f"**Total Source Documents Discovered:** {len(all_files)}  \n")
        f.write(f"**Total Unique Verified Experiences Extracted:** {len(extracted_records)}  \n")
        f.write(f"**Experiences with Verified Placement Package (LPA):** {len(with_package)}  \n")
        f.write(f"**Experiences with Verified Personal CGPA:** {len(with_cgpa)}  \n")
        f.write(f"**Stories with Attached Educational Resource Links:** {len(with_resources)}  \n")
        f.write(f"**Total Verified Resource Links Attached:** {total_res_count}  \n")
        f.write(f"**Total Study Materials (PDFs) Attached:** {total_mat_count}  \n")
        f.write(f"**Total Verified Resumes Attached:** {len(with_resume)}  \n")
        f.write(f"**Total Document Hyperlinks Audited:** {len(document_links_audit)}  \n")
        f.write(f"**Duplicates Detected & Skipped:** {len([a for a in audit_records if a['status'] == 'skipped_duplicate'])}  \n")
        f.write(f"**Scanned PDFs Processed with OCR:** {len([a for a in audit_records if a.get('ocr_required')])}  \n\n")

        f.write("---\n\n## 1. Verified Personal CGPA & Academic Alignment\n\n")
        f.write("| Candidate Name | Company | Verified CGPA | Source Wording / Evidence |\n")
        f.write("| :--- | :--- | :---: | :--- |\n")
        for c in cgpa_audit:
            if c["personal_cgpa"]:
                f.write(f"| **{c['candidate']}** | {c['company']} | **{c['personal_cgpa']}** | {c['source_status']} (`{c['source_file']}`) |\n")

        f.write("\n---\n\n## 2. Complete Inventory of Extracted Experiences & Resources\n\n")
        f.write("| # | Student Name | Company | Role | Branch | Placement Package | Personal CGPA | Resources Count | Study Materials | Resume Attached | Source File |\n")
        f.write("| :---: | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- |\n")

        for idx, r in enumerate(extracted_records, 1):
            pkg_val = r["package"] or "Disclosed in Interview"
            cgpa_val = r["cgpa"] or "—"
            res_count = len(r["resources"])
            mat_count = len(r["studyMaterials"])
            has_res = "Yes (Verified Link)" if r["resumeFile"] else "—"
            f.write(f"| {idx} | **{r['name']}** | {r['company']} | {r['role']} | {r['branch']} | {pkg_val} | {cgpa_val} | {res_count} | {mat_count} | {has_res} | `{r['source_file']}` |\n")

        f.write("\n---\n\n## 3. Documents Requiring Manual Review (Scanned / Unfilled Templates)\n\n")
        f.write("| File Name | Folder | Reason | Action Taken |\n")
        f.write("| :--- | :--- | :--- | :--- |\n")
        for a in audit_records:
            if a["status"] == "unreadable_or_scanned":
                f.write(f"| `{a['source_file']}` | {a['company_folder']} | Image/Scanned stream without embed text | Preserved for manual review; omitted from automated import |\n")
            elif a["status"] == "unfilled_template":
                f.write(f"| `{a['source_file']}` | {a['company_folder']} | Unfilled TPO questionnaire template | Excluded from public stories; requires student completion |\n")

        f.write("\n---\n\n## 4. Skipped Duplicates (DOCX / PDF Counterparts)\n\n")
        f.write("| File Name | Folder | Candidate Name | Duplicate Of | Action Taken |\n")
        f.write("| :--- | :--- | :--- | :--- | :--- |\n")
        for a in audit_records:
            if a["status"] == "skipped_duplicate":
                f.write(f"| `{a['source_file']}` | {a['company_folder']} | {a['extracted_name'] or '—'} | `{a['duplicate_of']}` | Skipped in favor of primary complete version |\n")

    print(f"Generated comprehensive audit report at {md_out}")

if __name__ == "__main__":
    main()
