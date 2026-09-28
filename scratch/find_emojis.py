import os
import re

emoji_pattern = re.compile(
    "["
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F1E6-\U0001F1FF"  # flags (iOS)
    "\U0002600-\U00026FF"   # miscellaneous symbols
    "\U0002700-\U00027BF"   # dingbats
    "\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    "\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    "]+", flags=re.UNICODE
)

src_dir = r"C:\Users\HP\.gemini\antigravity\scratch\Leenkit\src"

results = []

for root, dirs, files in os.walk(src_dir):
    for f in files:
        if f.endswith(('.jsx', '.js')):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8', errors='ignore') as fp:
                for line_idx, line in enumerate(fp, 1):
                    matches = emoji_pattern.findall(line)
                    if matches:
                        results.append((path, line_idx, matches, line.strip()))

print(f"Found {len(results)} occurrences:")
for path, line_no, matches, line in results:
    rel = os.path.relpath(path, src_dir)
    print(f"{rel}:{line_no}: {matches} -> {line}")
