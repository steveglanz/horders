"""Turn the single-file build into an Artifact page (the host adds its own html/head/body skeleton)."""
import re, sys
src = open('dist/index.html', encoding='utf-8').read()
head = re.search(r'<head>(.*?)</head>', src, re.S).group(1)
body = re.search(r'<body>(.*)</body>', src, re.S).group(1)
head = re.sub(r'<meta charset[^>]*>\s*', '', head)
head = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head)
# Scripts in head (vite puts the module there) must run after the body markup exists.
scripts = re.findall(r'<script type="module"[^>]*>.*?</script>', head, re.S)
for s in scripts:
    head = head.replace(s, '')
out = head.strip() + '\n' + body.strip() + '\n' + '\n'.join(scripts) + '\n'
open(sys.argv[1], 'w', encoding='utf-8').write(out)
print(len(out))
