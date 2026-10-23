#!/usr/bin/env python3
import os
import re
import json
import docx
import pypdf

REPORT_JSON = '/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/reports/LOOP_FINAL_VERIFICATION_REPORT.json'

with open(REPORT_JSON) as f:
    data = json.load(f)

ambiguous = data['ambiguous_records']
print(f"Loaded {len(ambiguous)} ambiguous records.\n")

# Correct mappings for misplaced source files identified earlier
CUSTOM_SOURCE_MAP = {
    'story_2027_74505ba4': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/Russell_Summer_Interns/Russell_Investments_Tech_Intern_Daksh_Jain.pdf',
    'story_2027_c0206428': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/Auxo_2027/AUXO_AI_DEV_RAI.pdf',
    'story_2027_4f4008e3': '/Users/swapnil/Documents/Interview/Interview_Experience_2027/Barclays_Summer_Interns/Barclays_Summer_Intern_Heet_Keyur_Shah.pdf',
}

def extract_text(path):
    txt = ""
    try:
        if path.endswith('.pdf'):
            r = pypdf.PdfReader(path)
            for i, p in enumerate(r.pages):
                pt = p.extract_text() or ""
                txt += f"\n--- PAGE {i+1} ---\n" + pt
        elif path.endswith('.docx'):
            d = docx.Document(path)
            txt = "\n".join([p.text for p in d.paragraphs])
            for t in d.tables:
                for row in t.rows:
                    txt += "\n[TABLE] " + " | ".join([c.text.strip().replace('\n', ' ') for c in row.cells])
    except Exception as e:
        txt = f"[ERROR: {e}]"
    return txt

findings = []

for idx, rec in enumerate(ambiguous):
    sid = rec['id']
    name = rec['name']
    company = rec['company']
    year = rec['year']
    db_branch = rec['db_branch']
    
    spath = CUSTOM_SOURCE_MAP.get(sid, rec['source_path'])
    if not os.path.exists(spath):
        findings.append({
            'idx': idx + 1,
            'id': sid,
            'name': name,
            'company': company,
            'year': year,
            'file': os.path.basename(spath),
            'db_branch': db_branch,
            'evidence': 'File not found',
            'decision': 'Unresolved / Source Not Found'
        })
        continue

    full_txt = extract_text(spath)
    header = full_txt[:800]
    
    # Analyze text for branch mentions
    branch_evidence = None
    proposed = None
    
    # 1. Search in header or first 1000 chars
    if re.search(r'\b(CSE[-_\s]*AIML|CSE[-_\s]*AI)\b', header, re.IGNORECASE):
        branch_evidence = "Header specifies CSE-AIML"
        proposed = "CSE-AIML"
    elif re.search(r'\b(CSE[-_\s]*DS|CSE[-_\s]*DATA)\b', header, re.IGNORECASE):
        branch_evidence = "Header specifies CSE-DS"
        proposed = "CSE-DS"
    elif re.search(r'\bC\.S\.E\s+Data\s+Science\b', header, re.IGNORECASE):
        branch_evidence = "Header specifies C.S.E Data Science"
        proposed = "CSE-DS"
    elif re.search(r'\b(Computer\s*Science\s*(?:and|&)\s*Engineering|\bCSE\b)\b', header, re.IGNORECASE):
        branch_evidence = "Header specifies Computer Science & Engineering / CSE"
        proposed = "CSE"
    elif re.search(r'\b(COMPS|Computer\s*Engineering|\bCE\b|Branch:\s*Computer|\bC\.E\.\b)', header, re.IGNORECASE):
        branch_evidence = "Header specifies COMPS / Computer Engineering / CE"
        proposed = "CE"
    elif re.search(r'\b(EXTC|Electronics\s*(?:and|&)?\s*Telecommunication)\b', header, re.IGNORECASE):
        branch_evidence = "Header specifies EXTC"
        proposed = "EXTC"
    elif re.search(r'\b(Information\s*Technology|\bIT\b)', header, re.IGNORECASE):
        branch_evidence = "Header specifies Information Technology / IT"
        proposed = "IT"
    elif re.search(r'\bMCA\b', header, re.IGNORECASE):
        branch_evidence = "Header specifies MCA"
        proposed = "MCA"

    # Check filename evidence if header is unstated
    fn = os.path.basename(spath)
    if not proposed:
        if '_CE_' in fn or 'Computer' in fn:
            branch_evidence = f"Filename token indicates CE ({fn})"
            proposed = "CE"
        elif '_CSE_' in fn:
            branch_evidence = f"Filename token indicates CSE ({fn})"
            proposed = "CSE"
        elif '_IT_' in fn:
            branch_evidence = f"Filename token indicates IT ({fn})"
            proposed = "IT"
        elif '_EXTC_' in fn:
            branch_evidence = f"Filename token indicates EXTC ({fn})"
            proposed = "EXTC"

    # Check entire document if still unstated
    if not proposed:
        dept_match = re.search(r'(?:Department\s*of|Branch\s*:|from\s+the\s+department\s+of)\s*([A-Za-z\s\-]+)', full_txt, re.IGNORECASE)
        if dept_match:
            d_val = dept_match.group(1).strip()[:40]
            branch_evidence = f"Body context mentions department: '{d_val}'"
            if 'Computer' in d_val or 'Comps' in d_val:
                proposed = "CE"
            elif 'Information' in d_val or 'IT' in d_val:
                proposed = "IT"
            elif 'Telecom' in d_val or 'EXTC' in d_val:
                proposed = "EXTC"

    # Make decision
    decision = ""
    if proposed:
        if proposed == db_branch or (proposed.startswith('CSE') and db_branch.startswith('CSE')):
            decision = f"Retain current DB branch '{db_branch}' (confirmed by evidence: {branch_evidence})"
        else:
            decision = f"Update DB branch '{db_branch}' -> '{proposed}' (supported by: {branch_evidence})"
    else:
        decision = f"Retain existing '{db_branch}' (No explicit branch in source; marked for manual review, zero guesswork)"

    findings.append({
        'idx': idx + 1,
        'id': sid,
        'name': name,
        'company': company,
        'year': year,
        'file': fn,
        'db_branch': db_branch,
        'proposed': proposed,
        'evidence': branch_evidence or "None in header/body",
        'decision': decision,
        'header_sample': re.sub(r'\s+', ' ', header[:200])
    })

print(f"{'#':<3} | {'ID':<21} | {'Name':<25} | {'DB Branch':<10} | {'Proposed':<10} | Decision")
print("-" * 115)
for f in findings:
    print(f"{f['idx']:<3} | {f['id']:<21} | {f['name'][:24]:<25} | {f['db_branch']:<10} | {str(f['proposed']):<10} | {f['decision'][:45]}")

with open('/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/reports/ambiguous_records_detailed_review.json', 'w') as out_f:
    json.dump(findings, out_f, indent=2)
print("\nSaved detailed ambiguous review to backend/reports/ambiguous_records_detailed_review.json")
