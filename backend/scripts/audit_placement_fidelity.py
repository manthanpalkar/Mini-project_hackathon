#!/usr/bin/env python3
import os
import re
import json
import docx
import pypdf

# Paths to source folders
FOLDERS = [
    ('/Users/swapnil/Documents/Interview/Interview Experience 2024', '2024'),
    ('/Users/swapnil/Documents/Interview/Interview Experience 2025', '2025'),
    ('/Users/swapnil/Documents/Interview/2026_Interview_Experiences', '2026'),
    ('/Users/swapnil/Documents/Interview/Interview_Experience_2027', '2027')
]

BACKUP_FILE = '/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/backups/stories_backup_pre_audit_2026-10-23T07-57-35-974Z.json'

def normalize_str(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())

def extract_full_text(path):
    text = ""
    try:
        if path.endswith('.pdf'):
            reader = pypdf.PdfReader(path)
            pages_txt = []
            for i, p in enumerate(reader.pages):
                pt = p.extract_text() or ""
                pages_txt.append(f"--- PAGE {i+1} ---\n" + pt)
            text = "\n".join(pages_txt)
        elif path.endswith('.docx'):
            doc = docx.Document(path)
            text = "\n".join([p.text for p in doc.paragraphs])
    except Exception as e:
        pass
    return text

def parse_source_document(text, filename):
    data = {}
    
    # 1. Candidate Header & Branch
    # Find position of Company:
    comp_m = re.search(r'\bCompany\s*:', text, re.IGNORECASE)
    header_text = text[:comp_m.start()] if comp_m else text[:500]
    # Remove page separators and clean
    header_clean = re.sub(r'--- PAGE \d+ ---', '', header_text)
    header_lines = [l.strip() for l in header_clean.splitlines() if l.strip()]
    
    # Extract candidate name from header
    candidate_name = None
    if header_lines:
        # First non-empty line usually has name
        first_line = header_lines[0]
        # Clean out any brackets or branch tokens
        first_line_clean = re.sub(r'\[.*?\]|\(.*?\)', '', first_line).strip()
        first_line_clean = re.sub(r'\b(CSE|CE|EXTC|COMPS|IT|MCA|ETRX)\b', '', first_line_clean, flags=re.IGNORECASE).strip()
        if len(first_line_clean) >= 3:
            candidate_name = first_line_clean

    # Determine Candidate Branch from Header Only (Strict: NEVER from Eligibility!)
    branch = None
    sub_branch = None
    
    # Check header text strictly
    h_tokens = re.sub(r'[\[\]\(\),:]', ' ', header_clean)
    
    # Exact branch patterns in header
    if re.search(r'\b(CSE[-_\s]*AIML|CSE[-_\s]*AI)\b', h_tokens, re.IGNORECASE):
        branch = "CSE-AIML"
        sub_branch = "AI"
    elif re.search(r'\b(CSE[-_\s]*DS|CSE[-_\s]*DATA)\b', h_tokens, re.IGNORECASE):
        branch = "CSE-DS"
        sub_branch = "DS"
    elif re.search(r'\b(CSE|Computer\s*Science(?!\s*Engineering\s*\(COMPS\)))\b', h_tokens, re.IGNORECASE):
        branch = "CSE"
        sub_branch = "CSE"
    elif re.search(r'\b(COMPS|Computer\s*Engineering|CE\b)', h_tokens, re.IGNORECASE):
        branch = "CE"
        sub_branch = "CE"
    elif re.search(r'\b(EXTC|ETRX|Electronics|Telecommunication)\b', h_tokens, re.IGNORECASE):
        branch = "EXTC"
        sub_branch = "EXTC"
    elif re.search(r'\b(Information\s*Technology|\bIT\b)', h_tokens, re.IGNORECASE):
        branch = "IT"
        sub_branch = "IT"
    elif re.search(r'\bMCA\b', h_tokens, re.IGNORECASE):
        branch = "MCA"
        sub_branch = "MCA"

    # 2. Company Name
    company = None
    m_comp = re.search(r'Company\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_comp:
        company = m_comp.group(1).strip()
        company = re.sub(r'\s+(Job|Profile|Role|Offer|CTC|Location|Date).*', '', company, flags=re.IGNORECASE).strip()

    # 3. Job Profile / Role
    role = None
    m_role = re.search(r'Job\s*Profile\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_role:
        role = m_role.group(1).strip()
        role = re.sub(r'\s+(Offer|CTC|Location|Date|Placement|Internship|Stipend).*', '', role, flags=re.IGNORECASE).strip()

    # 4. Offer Type
    offer_type = None
    m_off = re.search(r'Offer\s*Type\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_off:
        offer_type = m_off.group(1).strip()
        offer_type = re.sub(r'\s+(CTC|Location|Date|Stipend|Process|Internship).*', '', offer_type, flags=re.IGNORECASE).strip()

    # 5. Stipend
    stipend = None
    m_stip = re.search(r'Internship\s*Stipend\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_stip:
        stipend = m_stip.group(1).strip()
        stipend = re.sub(r'\s+(CTC|Location|Process|Date|Placement|Eligibility).*', '', stipend, flags=re.IGNORECASE).strip()

    # 6. CTC / Package
    ctc = None
    m_ctc = re.search(r'CTC\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_ctc:
        ctc = m_ctc.group(1).strip()
        ctc = re.sub(r'\s+(Location|Process|Date|Placement|Eligibility|Useful|Tips).*', '', ctc, flags=re.IGNORECASE).strip()

    # 7. Location
    location = None
    m_loc = re.search(r'Location\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_loc:
        location = m_loc.group(1).strip()
        location = re.sub(r'\s+(Process|Date|Placement|Eligibility|Placement Process).*', '', location, flags=re.IGNORECASE).strip()

    # 8. Eligibility Criteria (Explicitly separated from candidate branch!)
    eligibility = None
    m_elig = re.search(r'Eligibility\s*(?:Criteria)?\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_elig:
        eligibility = m_elig.group(1).strip()
        eligibility = re.sub(r'\s+(Placement\s*Process|Process\s*Date|Selection\s*Process).*', '', eligibility, flags=re.IGNORECASE).strip()

    # 9. Personal CGPA (Strict Source Evidence: only when candidate explicitly states their own CGPA)
    personal_cgpa = None
    cgpa_matches = re.findall(r'(?:my\s*(?:overall\s*)?(?:cgpa|pointer|gpa)|pointer\s*was|cgpa\s*was|i\s*had\s*(?:a\s*)?(?:cgpa|pointer)\s*of)\s*(?:is|was|:)?\s*([6-9]\.\d{1,2}|10\.0|10)', text, re.IGNORECASE)
    if cgpa_matches:
        personal_cgpa = cgpa_matches[0]

    return {
        'candidate_name': candidate_name,
        'branch': branch,
        'sub_branch': sub_branch,
        'company': company,
        'role': role,
        'offer_type': offer_type,
        'stipend': stipend,
        'ctc': ctc,
        'location': location,
        'eligibility': eligibility,
        'personal_cgpa': personal_cgpa
    }

def main():
    print("Loading database stories...")
    with open(BACKUP_FILE) as f:
        stories = json.load(f)
    print(f"Loaded {len(stories)} stories from backup.")

    print("Indexing all source files...")
    source_files = []
    for p, yr in FOLDERS:
        for root, dirs, files in os.walk(p):
            for f in files:
                if not f.startswith('.') and (f.endswith('.pdf') or f.endswith('.docx')):
                    source_files.append({
                        'year': yr,
                        'filename': f,
                        'path': os.path.join(root, f),
                        'company_dir': os.path.basename(root)
                    })
    print(f"Indexed {len(source_files)} source files.")

    # Match each story to source file
    audit_results = []
    matched_count = 0
    branch_mismatches = []
    name_mismatches = []
    comp_mismatches = []
    stipend_mismatches = []
    cgpa_mismatches = []

    for s in stories:
        s_id = s['id']
        s_name = s['name']
        s_yr = str(s.get('passoutYear', ''))
        s_comp = s.get('company', '')
        s_branch = s.get('branch', '')
        s_sub_branch = s.get('subBranch', '')
        s_ctc = s.get('ctc', '') or s.get('package', '')
        s_stipend = s.get('stipend', '')
        s_cgpa = s.get('cgpa', '')

        # Token match
        name_clean = normalize_str(s_name)
        tokens = [t for t in re.split(r'\s+', s_name.lower()) if len(t) > 2]
        comp_clean = normalize_str(s_comp)

        best_sf = None
        # 1. Filename match
        for sf in source_files:
            fn_lower = sf['filename'].lower()
            if len(tokens) >= 2 and tokens[0] in fn_lower and tokens[-1] in fn_lower:
                best_sf = sf
                break
            elif len(tokens) >= 1 and tokens[0] in fn_lower and (comp_clean in normalize_str(sf['filename']) or comp_clean in normalize_str(sf['company_dir'])):
                if sf['year'] == s_yr or not best_sf:
                    best_sf = sf

        # 2. Known mapping corrections
        if not best_sf:
            if s_id == 'story_2026_65225111': # Jash Shah -> Jsh Kapil Agarwal
                for sf in source_files:
                    if 'InCred_BuisnessAnalyst_Jsh.pdf' in sf['filename']:
                        best_sf = sf
                        break
            elif s_id == 'story_2027_b66cc323': # Bhavik Desai
                for sf in source_files:
                    if 'JPMC_CIB_BHAVIK_DESAI.pdf' in sf['filename']:
                        best_sf = sf
                        break

        # 3. Text search match
        if not best_sf:
            for sf in source_files:
                if sf['year'] == s_yr and (comp_clean in normalize_str(sf['company_dir']) or comp_clean in normalize_str(sf['filename'])):
                    # Check first page text
                    try:
                        t = extract_full_text(sf['path'])[:600].lower()
                        if len(tokens) >= 1 and tokens[0] in t:
                            best_sf = sf
                            break
                    except:
                        pass

        if not best_sf:
            audit_results.append({
                'id': s_id,
                'name': s_name,
                'company': s_comp,
                'year': s_yr,
                'matched': False,
                'source_file': None,
                'mismatches': ['NO_SOURCE_FILE_FOUND']
            })
            continue

        matched_count += 1
        full_text = extract_full_text(best_sf['path'])
        parsed = parse_source_document(full_text, best_sf['filename'])

        mismatches = []
        proposed = {}

        # Check Candidate Name
        if 'wwwlinkedincom' in s_name or 'http' in s_name:
            clean_n = re.sub(r'wwwlinkedincom[a-zA-Z0-9_\-\.]*', '', s_name).strip()
            clean_n = re.sub(r'https?://[^\s]+', '', clean_n).strip()
            if clean_n and clean_n != s_name:
                mismatches.append(f"NAME_CLEANUP: '{s_name}' -> '{clean_n}'")
                proposed['name'] = clean_n
                name_mismatches.append((s_id, s_name, clean_n))

        if s_id == 'story_2026_65225111' and s_name == 'Jash Shah':
            mismatches.append(f"NAME_MISMATCH: 'Jash Shah' -> 'Jsh Kapil Agarwal'")
            proposed['name'] = 'Jsh Kapil Agarwal'
            name_mismatches.append((s_id, s_name, 'Jsh Kapil Agarwal'))

        # Check Candidate Branch
        src_branch = parsed.get('branch')
        if src_branch and src_branch != 'UNKNOWN':
            # Check if DB has CE but source is CSE
            if src_branch == 'CSE' and s_branch != 'CSE':
                mismatches.append(f"BRANCH_MISMATCH: DB has '{s_branch}' but source explicitly states 'CSE'")
                proposed['branch'] = 'CSE'
                proposed['subBranch'] = 'CSE'
                branch_mismatches.append((s_id, s_name, s_comp, s_branch, 'CSE', best_sf['filename']))
            elif src_branch == 'CSE-AIML' and s_branch not in ['CSE', 'CSE-AIML']:
                mismatches.append(f"BRANCH_MISMATCH: DB has '{s_branch}' but source explicitly states 'CSE-AIML'")
                proposed['branch'] = 'CSE'
                proposed['subBranch'] = 'AI'
                branch_mismatches.append((s_id, s_name, s_comp, s_branch, 'CSE-AIML', best_sf['filename']))
            elif src_branch == 'CSE-DS' and s_branch not in ['CSE', 'CSE-DS']:
                mismatches.append(f"BRANCH_MISMATCH: DB has '{s_branch}' but source explicitly states 'CSE-DS'")
                proposed['branch'] = 'CSE'
                proposed['subBranch'] = 'DS'
                branch_mismatches.append((s_id, s_name, s_comp, s_branch, 'CSE-DS', best_sf['filename']))
            elif src_branch == 'EXTC' and s_branch != 'EXTC':
                mismatches.append(f"BRANCH_MISMATCH: DB has '{s_branch}' but source explicitly states 'EXTC'")
                proposed['branch'] = 'EXTC'
                proposed['subBranch'] = 'EXTC'
                branch_mismatches.append((s_id, s_name, s_comp, s_branch, 'EXTC', best_sf['filename']))
            elif src_branch == 'IT' and s_branch != 'IT':
                mismatches.append(f"BRANCH_MISMATCH: DB has '{s_branch}' but source explicitly states 'IT'")
                proposed['branch'] = 'IT'
                proposed['subBranch'] = 'IT'
                branch_mismatches.append((s_id, s_name, s_comp, s_branch, 'IT', best_sf['filename']))

        # Check CGPA (ensure no company eligibility cutoff is displayed as candidate CGPA)
        if s_cgpa and parsed.get('eligibility'):
            elig_text = parsed['eligibility']
            # If s_cgpa is exactly 6.0, 6.5, 7.0, 7.5, 8.0 and occurs in eligibility cutoff, check if source has personal CGPA
            if re.search(r'\b' + re.escape(str(s_cgpa)) + r'\b', elig_text) and not parsed.get('personal_cgpa'):
                mismatches.append(f"CGPA_CUTOFF_CONFUSION: DB has CGPA {s_cgpa} which appears in eligibility cutoff '{elig_text}' without explicit personal statement")
                cgpa_mismatches.append((s_id, s_name, s_comp, s_cgpa, elig_text))

        audit_results.append({
            'id': s_id,
            'name': s_name,
            'company': s_comp,
            'year': s_yr,
            'matched': True,
            'source_file': best_sf['filename'],
            'source_path': best_sf['path'],
            'parsed_source': parsed,
            'db_values': {
                'branch': s_branch,
                'subBranch': s_sub_branch,
                'ctc': s_ctc,
                'stipend': s_stipend,
                'cgpa': s_cgpa
            },
            'mismatches': mismatches,
            'proposed_corrections': proposed
        })

    print(f"\nAUDIT SUMMARY:")
    print(f"Total Stories: {len(stories)}")
    print(f"Matched to Sources: {matched_count}/{len(stories)}")
    print(f"Branch Mismatches: {len(branch_mismatches)}")
    print(f"Name Mismatches: {len(name_mismatches)}")
    print(f"CGPA Cutoff Confusions: {len(cgpa_mismatches)}")

    print("\nSAMPLE BRANCH MISMATCHES:")
    for b in branch_mismatches[:15]:
        print(f"  {b[0]} | {b[1]} ({b[2]}) -> DB: {b[3]} vs SOURCE: {b[4]} [File: {b[5]}]")

    # Save complete machine-readable audit report
    out_json = '/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/reports/source_to_db_audit_report.json'
    os.makedirs(os.path.dirname(out_json), exist_ok=True)
    with open(out_json, 'w') as f:
        json.dump(audit_results, f, indent=2)
    print(f"\nSaved detailed audit JSON to: {out_json}")

if __name__ == '__main__':
    main()
