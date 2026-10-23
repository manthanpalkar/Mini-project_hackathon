#!/usr/bin/env python3
import os
import re
import json
import pypdf
import docx

REPORT_JSON = '/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/reports/LOOP_FINAL_VERIFICATION_REPORT.json'

with open(REPORT_JSON) as f:
    data = json.load(f)

ambiguous = data['ambiguous_records']

CUSTOM_SOURCE_MAP = {
    'story_2027_74505ba4': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/Russell_Summer_Interns/Russell_Investments_Tech_Intern_Daksh_Jain.pdf',
    'story_2027_c0206428': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/Auxo_2027/AUXO_AI_DEV_RAI.pdf',
    'story_2027_4f4008e3': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/Barclays_Summer_Interns/Barclays_Summer_Intern_Heet_Keyur_Shah.pdf',
}

def extract_full(path):
    txt = ""
    try:
        if path.endswith('.pdf'):
            r = pypdf.PdfReader(path)
            for i, p in enumerate(r.pages):
                t = p.extract_text() or ""
                txt += f"\n[PAGE {i+1}] " + t
        elif path.endswith('.docx'):
            d = docx.Document(path)
            txt = "\n".join([p.text for p in d.paragraphs])
            for t in d.tables:
                for row in t.rows:
                    txt += "\n[TABLE] " + " | ".join([c.text.strip().replace('\n', ' ') for c in row.cells])
    except Exception as e:
        txt = f"[ERROR: {e}]"
    return txt

results = []

# Exclude the 3 already corrected in Phase 2
PHASE2_IDS = {'story_2025_7ec35412', 'story_2026_26830791', 'story_2026_10137144'}

for rec in ambiguous:
    sid = rec['id']
    if sid in PHASE2_IDS:
        continue

    spath = CUSTOM_SOURCE_MAP.get(sid, rec['source_path'])
    fn = os.path.basename(spath)
    txt = extract_full(spath)
    
    # Analyze text
    db_val = rec['db_branch']
    evidence = ""
    status = "Unresolved (Manual Review)"
    proposed = db_val

    # Look for candidate degree patterns
    if re.search(r'\b(CSE[-_\s]*AIML|CSE[-_\s]*AI)\b', txt[:1200], re.IGNORECASE):
        evidence = "Header explicitly specifies CSE-AIML"
        proposed = "CSE-AIML"
        status = "Resolved by Source"
    elif re.search(r'\b(CSE[-_\s]*DS|CSE[-_\s]*DATA)\b', txt[:1200], re.IGNORECASE):
        evidence = "Header explicitly specifies CSE-DS"
        proposed = "CSE-DS"
        status = "Resolved by Source"
    elif re.search(r'\b(Computer\s*Science\s*(?:and|&)\s*Engineering|\bCSE\b)\b', txt[:800], re.IGNORECASE):
        evidence = "Header explicitly specifies Computer Science & Engineering (CSE)"
        proposed = "CSE"
        status = "Resolved by Source"
    elif re.search(r'\[\s*CE\s*\]|\bComputer\s*Engineering\b|\bCOMPS\b|\bC\.E\.\b|Branch:\s*Computer\b|\bComp\s*Engineering\b', txt[:800], re.IGNORECASE):
        evidence = "Header explicitly specifies Computer Engineering / CE"
        proposed = "CE"
        status = "Resolved by Source"
    elif re.search(r'\b(EXTC|ETRX|Electronics\s*(?:and|&)?\s*Telecommunication)\b', txt[:800], re.IGNORECASE):
        evidence = "Header explicitly specifies EXTC"
        proposed = "EXTC"
        status = "Resolved by Source"
    elif re.search(r'\b(Information\s*Technology|\bIT\b)', txt[:800], re.IGNORECASE):
        evidence = "Header explicitly specifies Information Technology (IT)"
        proposed = "IT"
        status = "Resolved by Source"
    elif '_CE_' in fn:
        evidence = f"Filename code explicitly indicates CE ({fn})"
        proposed = "CE"
        status = "Resolved by Source"
    elif 'EXTC' in rec['name']:
        evidence = f"Candidate name header has merged EXTC token ({rec['name']})"
        proposed = "EXTC"
        status = "Resolved by Source"
    else:
        evidence = "Source document contains no branch or degree track statement in header or body"
        status = "Unresolved (Manual Review — Zero Guesswork)"
        proposed = db_val

    decision = ""
    if status.startswith("Resolved"):
        if proposed == db_val:
            decision = f"Retain verified '{db_val}' (Confirmed by source: {evidence})"
        else:
            decision = f"Proposed update to '{proposed}' (Supported by source: {evidence})"
    else:
        decision = f"Retain existing '{db_val}' without modification; flagged for manual review"

    results.append({
        'id': sid,
        'name': rec['name'],
        'company': rec['company'],
        'year': rec['year'],
        'file': fn,
        'path': spath,
        'current_branch': db_val,
        'proposed_branch': proposed,
        'evidence': evidence,
        'status': status,
        'decision': decision
    })

print(f"Reviewed {len(results)} remaining ambiguous records.")
resolved_count = sum(1 for r in results if r['status'].startswith("Resolved"))
unresolved_count = sum(1 for r in results if "Unresolved" in r['status'])
print(f"  - Verified / Confirmed by Source: {resolved_count}")
print(f"  - Unresolved (No branch stated in source): {unresolved_count}")

with open('/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/reports/ambiguous_27_audit_catalog.json', 'w') as f:
    json.dump(results, f, indent=2)
print("Saved catalog to backend/reports/ambiguous_27_audit_catalog.json")
