#!/bin/bash
# Favilla deploy script
# Usage: ./deploy.sh "Your commit message"

if [ -z "$1" ]; then
  echo "Usage: ./deploy.sh \"Your commit message\""
  exit 1
fi

echo "Checking syntax..."
python3 -c "
c=open('index.html').read()
s=c.rfind('<script>')
e=c.rfind('</script>')
open('/tmp/check.js','w').write(c[s+8:e])
"

node --check /tmp/check.js
if [ $? -eq 0 ]; then
  echo "✓ Syntax clean"
  git add index.html
  git commit -m "$1"
  git push
  echo "✓ Deployed: $1"
  echo "Vercel will be live in ~30 seconds at https://favilla.vercel.app"
else
  echo "✗ Syntax error found — fix before pushing"
  exit 1
fi