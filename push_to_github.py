"""
Push webfishing-save-editor to GitHub.
Creates the repo if it doesn't exist, initializes git, and pushes.

Usage: python push_to_github.py
       python push_to_github.py "commit message here"
Requires: pip install PyGithub
"""

import subprocess
import sys
import os
from datetime import datetime

# ─── Config ───────────────────────────────────────────────────────
GITHUB_USER = "cry4pt"
REPO_NAME = "webfishing-save-editor"
REPO_DESC = "A premium web-based save editor for WEBFISHING — edit everything, break nothing."
PRIVATE = False
PROJECT_DIR = os.path.dirname(os.path.abspath(__file__))

# Files/folders to exclude (added to .gitignore if missing)
EXTRA_IGNORES = [
    # Build / deps
    "node_modules/",
    "build/",
    ".svelte-kit/",
    ".output/",
    "bun.lock",
    # Copilot session planning files
    ".copilot/",
    # Python bytecode
    "__pycache__/",
    "*.pyc",
]


def run(cmd, **kwargs):
    """Run a shell command and return output."""
    print(f"  $ {cmd}")
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True,
        cwd=kwargs.get("cwd", PROJECT_DIR)
    )
    if result.returncode != 0 and not kwargs.get("allow_fail"):
        print(f"  ERROR: {result.stderr.strip()}")
        sys.exit(1)
    return result.stdout.strip()


def ensure_gitignore():
    """Make sure .gitignore has all the exclusions we need."""
    gitignore_path = os.path.join(PROJECT_DIR, ".gitignore")
    existing = ""
    if os.path.exists(gitignore_path):
        with open(gitignore_path, "r") as f:
            existing = f.read()

    additions = []
    for pattern in EXTRA_IGNORES:
        if pattern.strip("/") not in existing and pattern not in existing:
            additions.append(pattern)

    if additions:
        with open(gitignore_path, "a") as f:
            f.write("\n# Auto-added by push_to_github.py\n")
            for a in additions:
                f.write(a + "\n")
        print(f"  Added {len(additions)} entries to .gitignore")
    else:
        print("  .gitignore already up to date")


def create_repo_if_needed(token):
    """Create GitHub repo via API if it doesn't exist."""
    try:
        from github import Github, GithubException, Auth
    except ImportError:
        print("\n  PyGithub not installed. Installing...")
        subprocess.run([sys.executable, "-m", "pip", "install", "PyGithub"], check=True)
        from github import Github, GithubException, Auth

    g = Github(auth=Auth.Token(token))
    user = g.get_user()

    try:
        repo = user.get_repo(REPO_NAME)
        print(f"  Repo already exists: {repo.html_url}")
        return repo.clone_url
    except GithubException:
        pass

    print(f"  Creating {'private' if PRIVATE else 'public'} repo: {GITHUB_USER}/{REPO_NAME}")
    repo = user.create_repo(
        name=REPO_NAME,
        description=REPO_DESC,
        private=PRIVATE,
        auto_init=False,
    )
    print(f"  Created: {repo.html_url}")
    return repo.clone_url


def get_token():
    """Get GitHub token from gh CLI, env var, or prompt."""
    # Try gh CLI first
    result = subprocess.run(
        "gh auth token", shell=True, capture_output=True, text=True
    )
    if result.returncode == 0 and result.stdout.strip():
        print("  Using token from GitHub CLI (gh)")
        return result.stdout.strip()

    # Try env var
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        print("  Using token from environment variable")
        return token

    # Prompt
    import getpass
    print("\n  No GitHub token found. Get one at: https://github.com/settings/tokens")
    print("  Required scope: 'repo'")
    return getpass.getpass("  Enter GitHub personal access token: ")


def get_commit_message():
    """Get commit message from CLI args or generate a default."""
    if len(sys.argv) > 1:
        return " ".join(sys.argv[1:])

    # Auto-generate from changed files
    result = subprocess.run(
        "git diff --cached --name-only", shell=True,
        capture_output=True, text=True, cwd=PROJECT_DIR
    )
    changed = result.stdout.strip()
    if not changed:
        result = subprocess.run(
            "git status --porcelain", shell=True,
            capture_output=True, text=True, cwd=PROJECT_DIR
        )
        changed = result.stdout.strip()

    n_files = len(changed.splitlines()) if changed else 0
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    return f"Update: {n_files} file(s) changed — {timestamp}"


def main():
    print("=" * 60)
    print(f"  🐟 Push {REPO_NAME} to GitHub ({GITHUB_USER})")
    print("=" * 60)

    os.chdir(PROJECT_DIR)

    # 1. Get token
    print("\n[1/5] Getting GitHub token...")
    token = get_token()

    # 2. Create repo
    print("\n[2/5] Ensuring GitHub repo exists...")
    clone_url = create_repo_if_needed(token)
    push_url = clone_url.replace("https://", f"https://{GITHUB_USER}:{token}@")

    # 3. Update .gitignore
    print("\n[3/5] Checking .gitignore...")
    ensure_gitignore()

    # 4. Init git & commit
    print("\n[4/5] Staging and committing...")
    is_git = os.path.isdir(os.path.join(PROJECT_DIR, ".git"))
    if not is_git:
        run("git init")
        run("git branch -M main")

    run("git remote remove origin", allow_fail=True)
    run(f"git remote add origin {push_url}")

    run("git add -A")

    # Check if there's anything to commit
    status = run("git status --porcelain", allow_fail=True)
    if status:
        msg = get_commit_message()
        print(f"\n  Commit message: {msg}")
        run(f'git commit -m "{msg}"')
    else:
        print("  Nothing new to commit")

    # 5. Push
    print("\n[5/5] Pushing to GitHub...")
    run("git push -u origin main --force")

    print("\n" + "=" * 60)
    print(f"  ✅ Done! Repo live at: https://github.com/{GITHUB_USER}/{REPO_NAME}")
    print("=" * 60)


if __name__ == "__main__":
    main()
