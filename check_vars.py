import re
content = open('index.html', encoding='utf-8').read()
scripts = [m.group(1) for m in re.finditer(r'<script[^>]*>([\s\S]*?)</script>', content)]

for i, s in enumerate(scripts):
    if 'editingProd' in s:
        lets_count = s.count('let editingProd')
        const_count = s.count('const editingProd')
        total = s.count('editingProd')
        print(f'Script {i+1}: total={total}, let={lets_count}, const={const_count}')
