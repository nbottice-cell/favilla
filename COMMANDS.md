# Favilla — Terminal Command Reference

## First Time Setup

```bash
# Navigate to your repo (run this once, adjust path if needed)
cd ~/Documents/favilla

# Make the deploy script executable (run this once)
chmod +x deploy.sh
```

---

## Daily Workflow

### Start of every session — pull latest
```bash
git pull
```

### Check what files have changed
```bash
git status
```

### Check recent commits
```bash
git log --oneline -5
```

### Open the repo folder in Finder
```bash
open .
```

---

## Deploying to Vercel

### Option A — One-command deploy (recommended)
```bash
./deploy.sh "Your commit message here"
```
This checks syntax, commits, and pushes in one step.
If the syntax check fails, nothing gets pushed.

### Option B — Manual deploy
```bash
git add index.html
git commit -m "Your commit message here"
git push
```

### Option C — Stage everything (all changed files)
```bash
git add .
git commit -m "Your commit message here"
git push
```

---

## Syntax Checking

### Check index.html for JS errors before pushing
```bash
python3 -c "
c=open('index.html').read()
s=c.rfind('<script>')
e=c.rfind('</script>')
open('/tmp/check.js','w').write(c[s+8:e])
"
node --check /tmp/check.js && echo "✓ Clean — safe to push"
```

---

## Fixing Mistakes

### Undo the last commit (before pushing)
```bash
git reset HEAD~1
```

### Undo the last commit (already pushed — creates a safe reversal)
```bash
git revert HEAD
git push
```

### Discard all local changes and reset to last commit
```bash
git checkout -- index.html
```

### Pull and overwrite everything local (nuclear option)
```bash
git fetch origin
git reset --hard origin/main
```

---

## Supabase Test Data — Run in Supabase SQL Editor

### Clear all test data before a new test session
```sql
delete from messages;
delete from matches;
delete from likes;
delete from ember_likes;
```

### Reset RLS policies on likes table (if Spark breaks)
```sql
drop policy if exists "Insert own like" on likes;
drop policy if exists "Delete own like" on likes;
drop policy if exists "Read own likes" on likes;

create policy "Insert own like" on likes
  for insert with check (auth.uid() = user_id);
create policy "Delete own like" on likes
  for delete using (auth.uid() = user_id);
create policy "Read own likes" on likes
  for select using (auth.uid() = user_id or auth.uid() = liked_user_id);
```

### Create ember_likes table (if not already done)
```sql
create table if not exists ember_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  liked_user_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, liked_user_id)
);

alter table ember_likes enable row level security;

create policy "Insert own ember like" on ember_likes
  for insert with check (auth.uid() = user_id);
create policy "Delete own ember like" on ember_likes
  for delete using (auth.uid() = user_id);
create policy "Read ember likes" on ember_likes
  for select using (auth.uid() = user_id or auth.uid() = liked_user_id);

alter table messages add column if not exists message_type text default 'text';
```

### Reset matches RLS policies
```sql
drop policy if exists "Read own matches" on matches;
create policy "Read own matches" on matches
  for select using (auth.uid() = user_id_1 or auth.uid() = user_id_2);

drop policy if exists "Insert match" on matches;
create policy "Insert match" on matches
  for insert with check (auth.uid() = user_id_1);
```

---

## Quick Reference — Key URLs

| Resource | URL |
|----------|-----|
| Live app | https://favilla.vercel.app |
| Supabase dashboard | https://supabase.com/dashboard |
| Vercel deployments | https://vercel.com/dashboard |
| GitHub repo | https://github.com/your-username/favilla |

---

## deploy.sh — Full Script

Save this as `deploy.sh` in your repo folder.

```bash
#!/bin/bash
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
```
