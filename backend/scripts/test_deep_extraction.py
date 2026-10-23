import os
import re
import json
from urllib.parse import urlparse
import pypdf
import docx

SOURCE_DIR = "/Users/swapnil/Documents/Interview/2026_Interview_Experiences"

def get_pdf_links_and_text(pdf_path):
    links = []
    full_text = ""
    pages_text = []
    
    try:
        reader = pypdf.PdfReader(pdf_path)
    except Exception as e:
        return links, full_text, pages_text, str(e)
        
    for p_idx, page in enumerate(reader.pages):
        # 1. Collect text fragments with coordinates
        fragments = []
        def visitor(text, cm, tm, fontDict, fontSize):
            if text and text.strip():
                # cm[4] is x, cm[5] is y on page
                fragments.append((text, cm[4], cm[5], fontSize))
        
        try:
            page_text = page.extract_text(visitor_text=visitor) or ""
        except Exception:
            page_text = page.extract_text() or ""
            
        full_text += page_text + "\n"
        pages_text.append(page_text)
        
        # 2. Inspect Link Annotations
        if '/Annots' in page:
            for annot_ref in page['/Annots']:
                try:
                    annot = annot_ref.get_object()
                    if annot.get('/Subtype') == '/Link':
                        rect = [float(x) for x in annot.get('/Rect', [])]
                        url = None
                        if '/A' in annot:
                            action = annot['/A']
                            if '/URI' in action:
                                url = str(action['/URI'])
                        elif '/Dest' in annot:
                            url = str(annot['/Dest'])
                            
                        if not url:
                            continue
                            
                        # Find overlapping text within rect [x1, y1, x2, y2]
                        matched_texts = []
                        if len(rect) == 4:
                            x1, y1, x2, y2 = rect[0], rect[1], rect[2], rect[3]
                            # Allow slight tolerance
                            tol = 4.0
                            for text_frag, fx, fy, fsize in fragments:
                                if (x1 - tol) <= fx <= (x2 + tol) and (y1 - tol) <= fy <= (y2 + tol):
                                    matched_texts.append(text_frag)
                                    
                        anchor = "".join(matched_texts).strip()
                        if not anchor:
                            # Fallback: check text in raw line around link position
                            anchor = url
                            
                        links.append({
                            'page': p_idx + 1,
                            'url': url,
                            'anchor': anchor,
                            'rect': rect
                        })
                except Exception:
                    pass
                    
    return links, full_text, pages_text, None

def get_docx_links_and_text(docx_path):
    links = []
    full_text = ""
    pages_text = []
    
    try:
        doc = docx.Document(docx_path)
    except Exception as e:
        return links, full_text, pages_text, str(e)
        
    for p in doc.paragraphs:
        full_text += p.text + "\n"
        hyperlinks = p._element.xpath('.//w:hyperlink')
        for hl in hyperlinks:
            r_id = hl.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
            anchor = ''.join(hl.xpath('.//w:t/text()')).strip()
            url = doc.part.rels[r_id].target_ref if r_id in doc.part.rels else None
            if url:
                links.append({
                    'page': 1,
                    'url': url,
                    'anchor': anchor or url,
                    'rect': []
                })
                
    for t in doc.tables:
        for row in t.rows:
            for cell in row.cells:
                full_text += cell.text + "\n"
                hyperlinks = cell._element.xpath('.//w:hyperlink')
                for hl in hyperlinks:
                    r_id = hl.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
                    anchor = ''.join(hl.xpath('.//w:t/text()')).strip()
                    url = doc.part.rels[r_id].target_ref if r_id in doc.part.rels else None
                    if url:
                        links.append({
                            'page': 1,
                            'url': url,
                            'anchor': anchor or url,
                            'rect': []
                        })
                        
    pages_text.append(full_text)
    return links, full_text, pages_text, None

print("Link extraction logic compiled successfully.")
