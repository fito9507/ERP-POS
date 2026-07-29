import re, sys

file = sys.argv[1] if len(sys.argv)>1 else 'index.html'
with open(file, 'r', encoding='utf-8') as f:
    content = f.read()

# Extract all scripts
scripts = re.findall(r'<script[^>]*>([\s\S]*?)</script>', content)
if scripts:
    with open('test_syntax.js', 'w', encoding='utf-8') as f:
        for s in scripts:
            f.write(s + "\n")
    print("Extracted script to test_syntax.js")
else:
    print("Could not extract script")
