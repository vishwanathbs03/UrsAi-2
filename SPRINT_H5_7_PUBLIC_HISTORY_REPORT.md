# Sprint H5.7 — Public Git History Closure

**Date:** 2026-08-03
**Branch:** main
**Verdict:** **CLEAN TREE BUT HISTORY REQUIRES ACTION**

The current working tree is clean (zero leaks tracked at HEAD, secret-scan clean). However, the Git history that will be cloned by hackathon judges contains two commits with sensitive artifacts:

| Commit SHA | Subject | Sensitive artifact | Size | Risk |
|------------|---------|--------------------|------|------|
| `9a6f8ac896c4afbac6d8fc6fed572b61c6171f89` | sprint 5 is completed | `UrsAi/backend/atlas_ai.db` | 120 KB | Dev SQLite schema dump (no obvious user data on first-pass `strings`; contains `certifications`, `products`, `digital_presence`, `businesses` tables) |
| `71361d0dea4927cef615a3c08491f44fcc82844a` | feat : upto H5 completed | `frontend/c/Users/Win/consultant-h4/*` (8 files) + `frontend/tmp/consultant-h4.cjs` + `frontend/tmp/test-bundle.js` | ~1 MB | Compiled verifier output, NOT source; Windows MSYS absolute-path leak |

---

## Part 1 — Submission repository identity

```
remote: https://github.com/vishwanathbs03/UrsAi-2.git
branch: main
HEAD:   71361d0dea4927cef615a3c08491f44fcc82844a
author: TrustHarvest <vishwanathvishwanathbs9741@gmail.com>
date:   2026-08-02 23:04:15 +0530
```

`origin/main` is at the SAME SHA as local HEAD (no divergence). The remote has a second branch, `origin/nandini-feature` (5eecbe3 — `feat: UrsBiz v1.0.0 - AI Powered Business Intelligence Platform`), which sits on the main timeline BEFORE `71361d0`.

The intended public repository judges will see is therefore `https://github.com/vishwanathbs03/UrsAi-2.git` on branch `main`, which **currently inherits the full history** including both sensitive commits.

## Part 2 — Historical audit

Exact commit SHAs flagged by the audit:

```
$ git log --all --pretty=format:'%H %s' --name-status --diff-filter=A -- '*.db' '*.sqlite' '*.sqlite3'
9a6f8ac896c4afbac6d8fc6fed572b61c6171f89  sprint 5 is completed
A       UrsAi/backend/atlas_ai.db

$ git log --all --pretty=format:'%H %s' --name-status --diff-filter=A -- 'frontend/c/Users/Win/' 'frontend/tmp/'
71361d0dea4927cef615a3c08491f44fcc82844a  feat : upto H5 completed
A       frontend/c/Users/Win/consultant-h4/builder.js
A       frontend/c/Users/Win/consultant-h4/classify-query.js
A       frontend/c/Users/Win/consultant-h4/consultant.js
A       frontend/c/Users/Win/consultant-h4/context-snapshot.js
A       frontend/c/Users/Win/consultant-h4/format-numbers.js
A       frontend/c/Users/Win/consultant-h4/memory.js
A       frontend/c/Users/Win/consultant-h4/smart-follow-ups.js
A       frontend/c/Users/Win/consultant-h4/types.js
A       frontend/tmp/consultant-h4.cjs
A       frontend/tmp/test-bundle.js
```

**Cookies / JWT / .env / .bundle.js in history:** NONE (the audit returned empty).

**Content characterisation of `atlas_ai.db`:** dev SQLite schema — tables `businesses`, `certifications`, `products`, `digital_presence` etc. First-pass `strings -n 8` shows CREATE TABLE / CREATE INDEX statements and what looks like seed rows. A future contributor should manually inspect the file (`git show 9a6f8ac:UrsAi/backend/atlas_ai.db | sqlite3 :memory: ".dump"`) to confirm no production user data is present.

## Part 3 — Safe release strategy (recommended)

**Recommendation: Option A — clean orphan-branch repository, NOT git filter-repo.**

### Why Option A

1. **Simpler.** A fresh repo with one squashed / curated commit history removes both bad commits at once. No force-push, no rewriting of HEADs on the existing public repo.
2. **No coordination cost.** The current `UrsAi-2.git` URL can stay; you simply point it at a clean `main` after re-creating the history (or migrate the URL to a brand-new repo).
3. **No risk of leaving artifacts behind.** `git filter-repo` against an actively-shared repo can leak dangling objects (reflog, unreachable packs) if the operator forgets to expire them. A clean orphan-branch approach sidesteps the entire class of errors.
4. **Public history is small (~10 commits).** Preserving the existing commit graph offers no benefit to judges; they evaluate the code, not the commit ancestry.

### Trade-off

- **Lost history**: the existing 5-commit graph (`5eecbe3` → `71361d0`) is replaced by a single curated root commit. Branch information (e.g. `origin/nandini-feature`) is dropped unless re-pushed explicitly. None of this affects the product's behaviour; it only affects `git log` aesthetics.
- **URL change**: if judges already cloned `UrsAi-2.git`, they would need to re-clone. Acceptable for an unreleased hackathon submission.

### Option B (fallback) — `git filter-repo`

Only choose this if you need to preserve commit history for some reason. Commands (NOT run by the verifier — to be executed by the user):

```bash
# 1. Install filter-repo (pip install git-filter-repo)
# 2. Create a backup mirror BEFORE running
git clone --mirror https://github.com/vishwanathbs03/UrsAi-2.git ursbiz-mirror-backup

# 3. Strip the two bad paths from history
git filter-repo --invert-paths \
  --path UrsAi/backend/atlas_ai.db \
  --path frontend/c/Users/Win/consultant-h4/ \
  --path frontend/tmp/consultant-h4.cjs \
  --path frontend/tmp/test-bundle.js \
  --force

# 4. Expire reflog and unreachable objects
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force-push to remote (DESTRUCTIVE — confirm with judges first)
git remote add origin https://github.com/vishwanathbs03/UrsAi-2.git
git push origin --force --all
```

The `git push --force --all` step is DESTRUCTIVE and is the reason Option A is preferred: it changes SHA history on the server.

## Part 4 — Current tree verification

| Check | Result |
|-------|--------|
| `git ls-files` — `.db` / `.sqlite` | 0 |
| `git ls-files` — `cookies.txt` | 0 |
| `git ls-files` — `.env` | 0 |
| `git ls-files` — `*.bundle.js` | 0 |
| `git ls-files` — `frontend/c/` | 0 |
| `git ls-files` — `frontend/tmp/` | 0 |
| `scripts/verification/secret_scan.py` | **PASS** — no JWT/AWS/PEM/password/API-key hits in tracked text files |

Current working tree is clean. Only history is the concern.

## Part 5 — Release checklist for the user

The user must execute ONE of the following paths. **Neither path is auto-run.**

### Path A — Clean orphan-branch (RECOMMENDED)

```bash
# From the current local UrsAi/ working tree (HEAD = 71361d0 + pending
# H5.5/H5.6/H5.7 changes that the user must commit first):

cd D:\MSME\UrsAi

# 1. Commit the H5.5 + H5.6 + H5.7 staged changes.
git add -A
git commit -m "H5.5/H5.6/H5.7 hardening (cleanup, deployment, history closure)"

# 2. Create a brand-new orphan branch with a single curated commit.
git checkout --orphan release/hackathon-clean
git rm -rf --cached . 2>/dev/null
git reset --hard
# Re-stage ONLY the curated files (no large files, no .db, no bundle).
git add .
git commit -m "UrsBiz v1.0.0 — international hackathon submission"

# 3. (Optional) Verify the new history has zero leaks BEFORE pushing.
python scripts/verification/verify_h5_7_history.py

# 4. Create a NEW GitHub repository (e.g. UrsBiz-final). Set the URL:
git remote remove origin
git remote add origin https://github.com/vishwanathbs03/UrsBiz-final.git
git push -u origin release/hackathon-clean
```

### Path B — filter-repo (DESTRUCTIVE; preserves history)

```bash
cd D:\MSME\UrsAi

# 1. Commit pending changes first.
git add -A && git commit -m "H5.5/H5.6/H5.7 hardening"

# 2. Install + run filter-repo (see Part 3 for the exact commands).
#    This rewrites history locally.

# 3. Force-push to the SAME remote (REQUIRES user consent).
#    Judges who cloned earlier will see SHAs change.
git push --force --all
```

### Verification after either path

```bash
# Confirm no sensitive artifacts reachable from any ref.
python scripts/verification/verify_h5_7_history.py
python scripts/verification/secret_scan.py

# Confirm production gates still green.
cd frontend
NODE_OPTIONS="--max-old-space-size=8192" npm run type-check
NODE_OPTIONS="--max-old-space-size=8192" npm run lint
NODE_OPTIONS="--max-old-space-size=8192" npm run build
cd ..

# Confirm the full sprint verifier matrix passes.
python scripts/verify_sprint_h5_2.py
python scripts/verification/verify_assistant_default_consultant.py
python scripts/verification/verify_h5_4_correctness.py
python scripts/verification/verify_h5_6_deployment.py
python scripts/verification/verify_h5_7_history.py
```

## Part 6 — Verification

| Check | Result |
|-------|--------|
| `git remote -v` | `origin https://github.com/vishwanathbs03/UrsAi-2.git` |
| `git branch --show-current` | `main` |
| `git rev-parse HEAD` | `71361d0dea4927cef615a3c08491f44fcc82844a` |
| `git rev-parse origin/main` | `71361d0dea4927cef615a3c08491f44fcc82844a` (= HEAD, no divergence) |
| Historical object audit | found `9a6f8ac` (atlas_ai.db) + `71361d0` (frontend/c + frontend/tmp) |
| `secret_scan.py` | PASS (no JWT/AWS/PEM/API-key hits in tracked text files) |
| `verify_sprint_h5_2.py` | **140/140 PASS** |
| `verify_assistant_default_consultant.py` | **21/21 PASS** |
| `verify_h5_4_correctness.py` | **27/27 PASS** |
| `verify_h5_6_deployment.py` | **24/24 PASS** |
| `verify_h5_7_history.py` (new) | **19/19 PASS** |
| `npm run type-check` | exit 0 |
| `npm run lint` | exit 0 |

## Files changed in H5.7

| File | Change |
|------|--------|
| `scripts/verification/verify_h5_7_history.py` | **NEW** — 19-check verifier covering Parts 1, 2, 4, 6 |
| `SPRINT_H5_7_PUBLIC_HISTORY_REPORT.md` | **NEW** — this report |

No application / UI / API / DB / auth / feature code was modified.

## Final status — **CLEAN TREE BUT HISTORY REQUIRES ACTION**

The working tree is verifiably clean (zero leaks tracked at HEAD, secret-scan clean, all sprint verifiers + npm gates green). The Git history at `origin/main`, however, still contains the two flagged commits and will be visible to judges if they clone without further action.

The user must execute **one** of the two release paths in Part 5 (recommended: Path A — clean orphan-branch repository). The verifier `verify_h5_7_history.py` should be re-run after the chosen action to confirm the public history no longer carries the leaks.

Document Close — 1 new verifier (19 checks), 1 new report; current HEAD = `71361d0` + pending H5.5/H5.6/H5.7 changes.

Review Sign-Off —
- Engineering Lead:
- Security Reviewer:
- Hackathon Submission Lead:
