#!/usr/bin/env python3
"""
LOOP: FINAL READ-ONLY VERIFICATION OF 430 PLACEMENT STORIES
Strictly read-only. Compares all 430 live MongoDB stories against original
source documents (PDF, DOCX) across 2024, 2025, 2026, and 2027.
"""

import os
import re
import sys
import json
import csv
import docx
import pypdf
from datetime import datetime

# Paths
FOLDERS = [
    ('/Users/swapnil/Documents/Interview/Interview Experience 2024', '2024'),
    ('/Users/swapnil/Documents/Interview/Interview Experience 2025', '2025'),
    ('/Users/swapnil/Documents/Interview/2026_Interview_Experiences', '2026'),
    ('/Users/swapnil/Documents/Interview/Interview_Experience_2027', '2027')
]

LIVE_SNAPSHOT = '/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/reports/live_stories_snapshot.json'
OUT_JSON = '/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/reports/LOOP_FINAL_VERIFICATION_REPORT.json'
OUT_CSV = '/Users/swapnil/Base Zero /Placement/PROJECT FILE/reports/LOOP_FINAL_VERIFICATION_REPORT.csv'
OUT_MD = '/Users/swapnil/Base Zero /Placement/PROJECT FILE/reports/LOOP_FINAL_VERIFICATION_REPORT.md'

KNOWN_FILE_MAP = {
    'story_2026_65225111': '/Users/swapnil/Documents/Interview/2026_Interview_Experiences/InCred_2026/InCred_BuisnessAnalyst_Jsh.pdf',
    'story_2027_b66cc323': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/JPMC_2027/CIB/JPMC_CIB_BHAVIK_DESAI.pdf',
    'story_2026_28159237': '/Users/swapnil/Documents/Interview/2026_Interview_Experiences/Edelweiss Life Insurance/EdelweissSDERuswin.pdf',
    'story_2024_181a49f2': '/Users/swapnil/Documents/Interview/Interview Experience 2024/ISS/Interview Experience.pdf',
    'story_2024_58c28a34': '/Users/swapnil/Documents/Interview/Interview Experience 2024/ISS/Junior_Analyst_ISS.pdf',
    'story_2024_75fe1e32': '/Users/swapnil/Documents/Interview/Interview Experience 2024/InCred/InCred Interview Experience.pdf',
    'story_2024_c2db7667': '/Users/swapnil/Documents/Interview/Interview Experience 2024/JPMC/CIB/Interview Experience_Janhvi_CIB.pdf',
    'story_2024_cec82c28': '/Users/swapnil/Documents/Interview/Interview Experience 2024/JPMC/CIB/Interview Experience_Namita_CIB.pdf',
    'story_2025_21cd46f6': '/Users/swapnil/Documents/Interview/Interview Experience 2025/IDFC/Deepanshu_IDFC_Application-Engineer.pdf',
    'story_2025_309ae901': '/Users/swapnil/Documents/Interview/Interview Experience 2025/ISS Governance /ISS_Analytical-Verification_Aarya.pdf',
    'story_2025_f63bc436': '/Users/swapnil/Documents/Interview/Interview Experience 2025/ISS Governance /ISS_AnalyticalVerification_Aryaman.pdf',
    'story_2025_c229dc16': '/Users/swapnil/Documents/Interview/Interview Experience 2025/ISS Governance /ISS_SDE_Ankit.pdf',
    'story_2025_6610a85d': '/Users/swapnil/Documents/Interview/Interview Experience 2025/ISS Governance /ISS_SOFTWARE_TESTING_VAIBHAV.pdf',
    'story_2025_04685155': '/Users/swapnil/Documents/Interview/Interview Experience 2025/ISS Governance /ISS_SQL-Developer_Sankalp.pdf',
    'story_2025_bb9882a3': '/Users/swapnil/Documents/Interview/Interview Experience 2025/ISS Governance /ISS_SoftwareEngineerInTesting_Harshey.pdf',
    'story_2025_b073ef1f': '/Users/swapnil/Documents/Interview/Interview Experience 2025/JPMC/CIB/JPMC_CIB-Banking_Dhruv.pdf',
    'story_2025_970949f4': '/Users/swapnil/Documents/Interview/Interview Experience 2025/JPMC/CFG (Summer Internship)/JPMC_SEPSummerIntern_Sheshasai.pdf',
    'story_2027_f81ad7bc': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/JPMC_2027/JPMC_CADP/JPMC_CADP_Krisha.pdf',
    'story_2027_316ef9df': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/IDFC_2027/IDFC_Application_Engineer_Vedant.pdf'
}

def normalize_str(s):
    return re.sub(r'[^a-z0-9]', '', (s or '').lower())

def extract_full_text(path):
    text = ""
    try:
        if path.endswith('.pdf'):
            reader = pypdf.PdfReader(path)
            pages = []
            for i, p in enumerate(reader.pages):
                pt = p.extract_text() or ""
                pages.append(f"--- PAGE {i+1} ---\n" + pt)
            text = "\n".join(pages)
        elif path.endswith('.docx'):
            doc = docx.Document(path)
            text = "\n".join([p.text for p in doc.paragraphs])
    except Exception as e:
        pass
    return text

def parse_source_document(text, filename):
    # Candidate Header text (before Company: or first 600 chars)
    comp_m = re.search(r'\bCompany\s*:', text, re.IGNORECASE)
    header_text = text[:comp_m.start()] if comp_m else text[:600]
    header_clean = re.sub(r'--- PAGE \d+ ---', '', header_text)
    header_lines = [l.strip() for l in header_clean.splitlines() if l.strip()]

    # Candidate Name
    candidate_name = None
    if header_lines:
        first_line = header_lines[0]
        first_line_clean = re.sub(r'\[.*?\]|\(.*?\)', '', first_line).strip()
        first_line_clean = re.sub(r'\b(CSE|CE|EXTC|COMPS|IT|MCA|ETRX)\b', '', first_line_clean, flags=re.IGNORECASE).strip()
        if len(first_line_clean) >= 3:
            candidate_name = first_line_clean

    # Branch: Candidate Header ONLY (Never from Eligibility Criteria!)
    branch = None
    sub_branch = None
    h_tokens = re.sub(r'[\[\]\(\),:]', ' ', header_clean)

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
    else:
        branch = "UNKNOWN"
        sub_branch = "UNKNOWN"

    # Company
    company = None
    m_comp = re.search(r'Company\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_comp:
        company = m_comp.group(1).strip()
        company = re.sub(r'\s+(Job|Profile|Role|Offer|CTC|Location|Date).*', '', company, flags=re.IGNORECASE).strip()

    # Job Profile
    role = None
    m_role = re.search(r'Job\s*Profile\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_role:
        role = m_role.group(1).strip()
        role = re.sub(r'\s+(Offer|CTC|Location|Date|Placement|Internship|Stipend).*', '', role, flags=re.IGNORECASE).strip()

    # Offer Type
    offer_type = None
    m_off = re.search(r'Offer\s*Type\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_off:
        offer_type = m_off.group(1).strip()
        offer_type = re.sub(r'\s+(CTC|Location|Date|Stipend|Process|Internship).*', '', offer_type, flags=re.IGNORECASE).strip()

    # Stipend
    stipend = None
    m_stip = re.search(r'Internship\s*Stipend\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_stip:
        stipend = m_stip.group(1).strip()
        stipend = re.sub(r'\s+(CTC|Location|Process|Date|Placement|Eligibility).*', '', stipend, flags=re.IGNORECASE).strip()

    # CTC
    ctc = None
    m_ctc = re.search(r'CTC\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_ctc:
        ctc = m_ctc.group(1).strip()
        ctc = re.sub(r'\s+(Location|Process|Date|Placement|Eligibility|Useful|Tips).*', '', ctc, flags=re.IGNORECASE).strip()

    # Location
    location = None
    m_loc = re.search(r'Location\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_loc:
        location = m_loc.group(1).strip()
        location = re.sub(r'\s+(Process|Date|Placement|Eligibility|Placement Process).*', '', location, flags=re.IGNORECASE).strip()

    # Eligibility Criteria
    eligibility = None
    m_elig = re.search(r'Eligibility\s*(?:Criteria)?\s*:\s*([^\n\r•]+)', text, re.IGNORECASE)
    if m_elig:
        eligibility = m_elig.group(1).strip()
        eligibility = re.sub(r'\s+(Placement\s*Process|Process\s*Date|Selection\s*Process).*', '', eligibility, flags=re.IGNORECASE).strip()

    # Personal CGPA
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

def run_verification():
    print("=" * 75)
    print("LOOP: FINAL READ-ONLY VERIFICATION OF 430 PLACEMENT STORIES")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 75)

    with open(LIVE_SNAPSHOT) as f:
        stories = json.load(f)
    print(f"Loaded {len(stories)} stories from live MongoDB snapshot.")

    # Index all source files
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
    print(f"Indexed {len(source_files)} source files from interview folders.\n")

    results = []
    confirmed_correct = []
    confirmed_incorrect = []
    source_unavailable = []
    ambiguous_review = []

    # Track duplicates
    seen_ids = set()
    duplicate_ids = []
    seen_combos = {}

    for s in stories:
        s_id = s['id']
        s_name = s['name']
        s_yr = str(s.get('passoutYear', ''))
        s_comp = s.get('company', '')
        s_branch = s.get('branch', '')
        s_sub_branch = s.get('subBranch', '')
        s_role = s.get('role', '')
        s_offer = s.get('offerType', '')
        s_ctc = s.get('ctc', '') or s.get('package', '')
        s_stipend = s.get('stipend', '')
        s_cgpa = s.get('cgpa', '')
        s_journey = s.get('journey', {})

        # Duplicate check
        if s_id in seen_ids:
            duplicate_ids.append(s_id)
        seen_ids.add(s_id)

        combo_key = (normalize_str(s_name), normalize_str(s_comp), s_yr)
        if combo_key in seen_combos:
            seen_combos[combo_key].append(s_id)
        else:
            seen_combos[combo_key] = [s_id]

        # Match to source file
        best_sf = None
        if s_id in KNOWN_FILE_MAP:
            p = KNOWN_FILE_MAP[s_id]
            best_sf = {
                'year': s_yr,
                'filename': os.path.basename(p),
                'path': p,
                'company_dir': os.path.basename(os.path.dirname(p))
            }
        else:
            tokens = [t for t in re.split(r'\s+', s_name.lower()) if len(t) > 2]
            comp_clean = normalize_str(s_comp)
            for sf in source_files:
                fn_lower = sf['filename'].lower()
                if len(tokens) >= 2 and tokens[0] in fn_lower and tokens[-1] in fn_lower:
                    best_sf = sf
                    break
                elif len(tokens) >= 1 and tokens[0] in fn_lower and (comp_clean in normalize_str(sf['filename']) or comp_clean in normalize_str(sf['company_dir'])):
                    if sf['year'] == s_yr or not best_sf:
                        best_sf = sf

            if not best_sf:
                for sf in source_files:
                    if sf['year'] == s_yr and (comp_clean in normalize_str(sf['company_dir']) or comp_clean in normalize_str(sf['filename'])):
                        try:
                            t = extract_full_text(sf['path'])[:600].lower()
                            if len(tokens) >= 1 and tokens[0] in t:
                                best_sf = sf
                                break
                        except:
                            pass

        if not best_sf:
            source_unavailable.append({
                'id': s_id,
                'name': s_name,
                'company': s_comp,
                'year': s_yr,
                'db_branch': s_branch,
                'db_package': s_ctc,
                'reason': 'Source file could not be mapped'
            })
            continue

        full_text = extract_full_text(best_sf['path'])
        parsed = parse_source_document(full_text, best_sf['filename'])

        discrepancies = []
        is_ambiguous = False
        ambiguous_reasons = []

        # 1. Candidate Name Check
        if 'wwwlinkedincom' in s_name or 'http' in s_name:
            discrepancies.append(f"Candidate name contains URL residue: '{s_name}'")

        # 2. Candidate Branch Verification (Strict)
        src_branch = parsed.get('branch')
        if src_branch == 'UNKNOWN':
            is_ambiguous = True
            ambiguous_reasons.append("Source document header does not contain explicit branch string (header lacks CE/CSE/EXTC/IT marker)")
        else:
            # Check if source branch matches DB
            if src_branch == 'CSE' and s_branch != 'CSE':
                discrepancies.append(f"Branch mismatch: DB has '{s_branch}', source header explicitly states 'CSE'")
            elif src_branch in ['CSE-AIML', 'CSE-DS'] and s_branch not in ['CSE', 'CSE-AIML', 'CSE-DS']:
                discrepancies.append(f"Branch mismatch: DB has '{s_branch}', source header states '{src_branch}'")
            elif src_branch == 'CE' and s_branch != 'CE':
                discrepancies.append(f"Branch mismatch: DB has '{s_branch}', source header explicitly states 'CE'")
            elif src_branch == 'EXTC' and s_branch != 'EXTC':
                discrepancies.append(f"Branch mismatch: DB has '{s_branch}', source header explicitly states 'EXTC'")
            elif src_branch == 'IT' and s_branch != 'IT':
                discrepancies.append(f"Branch mismatch: DB has '{s_branch}', source header explicitly states 'IT'")

        # 3. Check that Candidate Branch was NOT inferred from Eligibility
        src_elig = parsed.get('eligibility') or ''
        if src_branch == 'UNKNOWN' and src_elig:
            # If DB has a branch that appears only in eligibility and not header
            if ('CE' in src_elig or 'CSE' in src_elig) and s_branch:
                ambiguous_reasons.append(f"Candidate branch '{s_branch}' may have relied on default/eligibility '{src_elig}' due to unstated header")
                is_ambiguous = True

        # 4. Compensation / Package Corruption Check
        # Check for OCR 7 artifact or corrupt symbols in s_ctc
        if s_ctc:
            if re.search(r'\b7\s*LPA\b', s_ctc, re.IGNORECASE) and not re.search(r'\b7(?:\.0)?\s*LPA\b', full_text[:1000]):
                discrepancies.append(f"Possible OCR '7' artifact for rupee symbol in package: '{s_ctc}'")
            if any(sym in s_ctc for sym in ['€', '₴', '<']):
                discrepancies.append(f"Corrupt OCR character in package: '{s_ctc}'")

        # 5. CGPA Eligibility vs Personal Statement Check
        if s_cgpa and src_elig:
            if re.search(r'\b' + re.escape(str(s_cgpa)) + r'\b', src_elig) and not parsed.get('personal_cgpa'):
                discrepancies.append(f"CGPA cutoff confusion: DB has CGPA {s_cgpa} which appears in eligibility cutoff '{src_elig}' without candidate personal statement")

        # 6. Journey / Interview Round Completeness Check
        journey_content = ""
        if isinstance(s_journey, dict):
            journey_content = s_journey.get('howSecured', '') or ''
        elif isinstance(s_journey, list):
            journey_content = " ".join([str(x) for x in s_journey])
        elif isinstance(s_journey, str):
            journey_content = s_journey

        if len(journey_content.strip()) < 50:
            discrepancies.append("Interview journey narrative is empty or excessively short (<50 chars)")

        # Compile record result
        record_res = {
            'id': s_id,
            'name': s_name,
            'company': s_comp,
            'year': s_yr,
            'source_file': best_sf['filename'],
            'source_path': best_sf['path'],
            'db_branch': s_branch,
            'source_branch': src_branch,
            'db_package': s_ctc,
            'source_ctc': parsed.get('ctc'),
            'db_stipend': s_stipend,
            'source_stipend': parsed.get('stipend'),
            'db_role': s_role,
            'source_role': parsed.get('role'),
            'source_eligibility': src_elig,
            'personal_cgpa': parsed.get('personal_cgpa'),
            'discrepancies': discrepancies,
            'ambiguous_reasons': ambiguous_reasons,
            'status': 'Confirmed correct'
        }

        if discrepancies:
            record_res['status'] = 'Confirmed incorrect'
            confirmed_incorrect.append(record_res)
        elif is_ambiguous:
            record_res['status'] = 'Ambiguous and requiring human review'
            ambiguous_review.append(record_res)
        else:
            record_res['status'] = 'Confirmed correct'
            confirmed_correct.append(record_res)

        results.append(record_res)

    print("--- AUDIT SUMMARY ---")
    print(f"Total stories checked: {len(stories)}")
    print(f"Source files mapped: {len(stories) - len(source_unavailable)} / {len(stories)}")
    print(f"Confirmed correct: {len(confirmed_correct)}")
    print(f"Confirmed incorrect: {len(confirmed_incorrect)}")
    print(f"Ambiguous / human review: {len(ambiguous_review)}")
    print(f"Source unavailable: {len(source_unavailable)}")
    print(f"Duplicate IDs: {len(duplicate_ids)}")

    # Save machine-readable JSON
    with open(OUT_JSON, 'w') as f:
        json.dump({
            'meta': {
                'timestamp': datetime.now().isoformat(),
                'total_checked': len(stories),
                'confirmed_correct': len(confirmed_correct),
                'confirmed_incorrect': len(confirmed_incorrect),
                'ambiguous_review': len(ambiguous_review),
                'source_unavailable': len(source_unavailable),
                'duplicate_ids': len(duplicate_ids)
            },
            'discrepancies': confirmed_incorrect,
            'ambiguous_records': ambiguous_review,
            'unavailable_records': source_unavailable,
            'all_records': results
        }, f, indent=2)
    print(f"\nSaved machine-readable JSON report to: {OUT_JSON}")

    # Save machine-readable CSV
    with open(OUT_CSV, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Story ID', 'Candidate Name', 'Company', 'Passout Year',
            'Source Filename', 'Status', 'DB Branch', 'Source Branch',
            'DB Package', 'Source CTC', 'DB Stipend', 'Source Stipend',
            'Discrepancies', 'Ambiguity Notes'
        ])
        for r in results:
            writer.writerow([
                r['id'], r['name'], r['company'], r['year'],
                r['source_file'], r['status'], r['db_branch'], r['source_branch'],
                r['db_package'], r['source_ctc'] or '', r['db_stipend'] or '', r['source_stipend'] or '',
                " | ".join(r['discrepancies']), " | ".join(r['ambiguous_reasons'])
            ])
    print(f"Saved machine-readable CSV report to: {OUT_CSV}")

    return {
        'total': len(stories),
        'confirmed_correct': confirmed_correct,
        'confirmed_incorrect': confirmed_incorrect,
        'ambiguous_review': ambiguous_review,
        'source_unavailable': source_unavailable,
        'duplicate_ids': duplicate_ids,
        'all_results': results
    }

if __name__ == '__main__':
    run_verification()
