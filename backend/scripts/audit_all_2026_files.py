import os
import re
import json
from urllib.parse import urlparse
import pypdf
import docx

SOURCE_DIR = "/Users/swapnil/Documents/Interview/2026_Interview_Experiences"

def normalize_spacing(text):
    if not text:
        return ""
    # Detect word-by-word or letter-by-letter fragmentation
    cleaned = re.sub(r'(\b[a-zA-Z])\s+([a-zA-Z]\b)', r'\1\2', text)
    cleaned = re.sub(r'(\b[a-zA-Z])\s+([a-zA-Z]\b)', r'\1\2', cleaned)
    return cleaned

def extract_personal_cgpa(full_text, filename):
    # Normalize text for regex matching
    norm = normalize_spacing(full_text)
    norm = re.sub(r'\s+', ' ', norm)
    
    # 1. High confidence explicit self-reported patterns
    patterns = [
        (r'mine\s+was\s+([6-9]\.\d{1,2}|10(?:\.0)?)\s*(?:/10)?', 'mine was {val}'),
        (r'my\s+ptr\s+was\s+[6-9]\.\d{1,2}\s*\(currently\s+it\'?s\s+([6-9]\.\d{1,2})\)', 'current ptr {val}'),
        (r'my\s+gpa\s*\(?\s*([6-9]\.\d{1,2})\s*\)?', 'my gpa({val})'),
        (r'high\s*\(\s*([6-9]\.\d{1,2})\s*\)', 'high({val})'),
        (r'had\s+a\s+cg(?:pa)?\s+of\s+([6-9]\.\d{1,2})', 'had a cg of {val}'),
        (r'luckily\s+i\s+had\s+just\s+reached\s+to\s+([6-9]\.\d{1,2})', 'reached to {val}'),
        (r'cgpa\s*:\s*([6-9]\.\d{1,2})\b', 'cgpa: {val}'),
        (r'pointer\s*:\s*([6-9]\.\d{1,2})\b', 'pointer: {val}'),
    ]
    
    for pat, desc in patterns:
        m = re.search(pat, norm, re.I)
        if m:
            val = m.group(1)
            # Ensure it is NOT eligibility/cutoff
            start = max(0, m.start() - 60)
            end = min(len(norm), m.end() + 60)
            ctx = norm[start:end].lower()
            if any(k in ctx for k in ['criteria was', 'minimum of', 'eligibility', 'cutoff', 'shortlisted if', 'allowed to give']):
                continue
            return val, norm[start:end]
            
    return None, None

def inspect_file(filepath):
    filename = os.path.basename(filepath)
    ext = os.path.splitext(filename)[1].lower()
    
    links = []
    full_text = ""
    error = None
    
    if ext == '.pdf':
        try:
            reader = pypdf.PdfReader(filepath)
            for p_idx, page in enumerate(reader.pages):
                fragments = []
                def visitor(text, cm, tm, fontDict, fontSize):
                    if text and text.strip():
                        fragments.append((text, cm[4], cm[5], fontSize))
                try:
                    p_text = page.extract_text(visitor_text=visitor) or ""
                except Exception:
                    p_text = page.extract_text() or ""
                full_text += p_text + "\n"
                
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
                                        for t, fx, fy, _ in fragments:
                                            if (x1 - 5) <= fx <= (x2 + 5) and (y1 - 5) <= fy <= (y2 + 5):
                                                matched.append(t)
                                    anchor = "".join(matched).strip()
                                    links.append({
                                        'page': p_idx + 1,
                                        'url': url,
                                        'anchor': anchor or url
                                    })
                        except Exception:
                            pass
        except Exception as e:
            error = str(e)
            
    elif ext == '.docx':
        try:
            doc = docx.Document(filepath)
            for p in doc.paragraphs:
                full_text += p.text + "\n"
                for hl in p._element.xpath('.//w:hyperlink'):
                    r_id = hl.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                    anchor = ''.join(hl.xpath('.//w:t/text()')).strip()
                    url = doc.part.rels[r_id].target_ref if r_id in doc.part.rels else None
                    if url:
                        links.append({'page': 1, 'url': url, 'anchor': anchor or url})
            for t in doc.tables:
                for row in t.rows:
                    for c in row.cells:
                        full_text += c.text + "\n"
                        for hl in c._element.xpath('.//w:hyperlink'):
                            r_id = hl.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                            anchor = ''.join(hl.xpath('.//w:t/text()')).strip()
                            url = doc.part.rels[r_id].target_ref if r_id in doc.part.rels else None
                            if url:
                                links.append({'page': 1, 'url': url, 'anchor': anchor or url})
        except Exception as e:
            error = str(e)
            
    # Also discover any raw URLs in text that were not in annotations
    raw_urls = re.findall(r'https?://[^\s<>\"\'\)]+', full_text)
    annot_urls = set(l['url'] for l in links)
    for ru in raw_urls:
        clean_ru = ru.rstrip('.,;:\'\")')
        if clean_ru not in annot_urls and len(clean_ru) >= 10:
            links.append({'page': 1, 'url': clean_ru, 'anchor': clean_ru})
            annot_urls.add(clean_ru)
            
    cgpa, cgpa_ctx = extract_personal_cgpa(full_text, filename)
    
    return {
        'filename': filename,
        'filepath': filepath,
        'error': error,
        'char_count': len(full_text),
        'links_count': len(links),
        'links': links,
        'cgpa': cgpa,
        'cgpa_context': cgpa_ctx
    }

def main():
    files = []
    for dirpath, _, filenames in os.walk(SOURCE_DIR):
        for fn in filenames:
            if not fn.startswith('.'):
                files.append(os.path.join(dirpath, fn))
                
    files.sort()
    print(f"Total files discovered in source directory: {len(files)}")
    
    audit_results = []
    cgpa_found = []
    total_links = 0
    
    for fp in files:
        res = inspect_file(fp)
        audit_results.append(res)
        total_links += res['links_count']
        if res['cgpa']:
            cgpa_found.append((res['filename'], res['cgpa'], res['cgpa_context']))
            
    print(f"Total document hyperlinks discovered across files: {total_links}")
    print(f"Total verified personal CGPAs discovered: {len(cgpa_found)}")
    print("\nVerified Personal CGPAs:")
    for fn, val, ctx in cgpa_found:
        print(f"  - {fn}: {val} (Context: {ctx[:80]}...)")
        
    out_path = "/Users/swapnil/Base Zero /Placement/PROJECT FILE/backend/scripts/audit_inventory_2026.json"
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(audit_results, f, indent=2)
    print(f"\nSaved full inventory to {out_path}")

if __name__ == '__main__':
    main()
