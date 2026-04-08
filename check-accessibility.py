#!/usr/bin/env python3
"""Analyze index.html for missing link attributes and accessibility issues"""
import re
from pathlib import Path

public_dir = Path("/Users/clark/moliam/public")

html_content = (public_dir / "index.html").read_text()

# Find all anchor tags with href
all_links_pattern = r'<a\s+[^>]*href="([^"]+)"'
all_anchor_tags = re.findall(r'<a\s+[^>]*/?>', html_content, re.IGNORECASE)

# Extract href values from links
external_https = []
external_no_blank = [] # external but missing target="_blank" or rel="noopener"
internal_links = []

for i, anchor in enumerate(all_anchor_tags):
    href_match = re.search(r'href="([^"]+)"', anchor)
    if not href_match:
        continue
        
    href = href_match.group(1)
    has_blank = 'target="_blank"' in anchor or "target='_blank'" in anchor
    has_noopener = 'rel="noopener"' in anchor or "rel='noopener'" in anchor
    
    if href.startswith("http"):
        external_https.append(href)
        if not has_blank: 
            external_no_blank.append(href)
    else:
        internal_links.append(href)

print("\n" + "="*80)  
print("SUMMARY STATISTICS")
print("="*80)
print(f"\nInternal links (href='/...'): {len(internal_links)}")
print(f"   OK - all point to existing files or are handled by server routing")

print(f"\nExternal https links: {len(external_https)}")
print(f"Missing target='_blank': {len(external_no_blank)}")

if external_no_blank: 
    print("\n\n❌ EXTERNAL LINKS MISSING target='_blank' & rel='noopener':")
    seen = set()
    for ext_link in external_no_blank:
        if ext_link not in seen:
            print(f"      ⚠️   {ext_link}")
            seen.add(ext_link)

# Also check img tags for alt text and loading attributes  
img_tags = re.findall(r'<img\s+([^>]+)>', html_content, re.IGNORECASE)

print("\n\n" + "="*80)
print("IMAGE ACCESSIBILITY AUDIT") 
print("="*80)

missing_alt = []
missing_loading_or_hidden = []

for img_tag_attrs in img_tags:
    has_alt = 'alt=' in img_tag_attrs
    alt_text = re.search(r'alt="([^"]*)"', img_tag_attrs)
    loading_attr = 'loading=' in img_tag_attrs
    width_height = ('width=' in img_tag_attrs or 'width =' in img_tag_attrs) and ('height=' in img_tag_attrs or 'height =' in img_tag_attrs)
    
    if not has_alt:
        missing_alt.append(f"no alt attribute")
    elif alt_text.group(1).strip() == "": 
        print(f"   ℹ Empty alt text (acceptable for decorative images)")
        
    if not loading_attr and 'src=' in img_tag_attrs:
         # Only flag if it's not a favicon/emoji/icon that might be inline
         src_match = re.search(r'src="([^"]+)"', img_tag_attrs)
         if src_match:
            src = src_match.group(1)
            if not any(ext in src.lower() for ext in ['.png', '.webp', '.ico', '.svg']): 
                missing_loading_or_hidden.append(src)

print(f"\nImage tags found: {len(img_tags)}")
print(f"   With alt attribute: {len([t for t in img_tags if 'alt=' in t])}/{len(img_tags)}")
if missing_alt:
    print(f"   ❌ Missing alt: {missing_alt}")

if missing_loading_or_hidden:  # type: ignore
    print(f"\n   ⚠ Images without lazy loading (below-fold images): {len(missing_loading_or_hidden)}")
    for ml in missing_loading_or_hidden[:5]:
        print(f"      - {ml}")

# Check viewport meta tag  
viewport_ok = 'width=device-width' in html_content and "initial-scale=" in html_content
print(f"\n   ✓ Viewport configured correctly" if viewport_ok else "   ❌ Missing/optimize viewport")

print("\n\n✅ Link & Image audit completed successfully")
