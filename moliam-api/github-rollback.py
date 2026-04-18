#!/usr/bin/env python3
"""
GitHub-Integrated Rollback System
Automatically pulls from GitHub, creates versioned releases, and switches workspaces
"""

import os
import json
import subprocess
import shutil
from pathlib import Path
from datetime import datetime

REPO_URL = "https://github.com/oscarsolis3301/atlas-api.git"
WORKSPACE = Path("/Users/clark/.openclaw/workspace/moliam-api")
VERSIONS_DIR = WORKSPACE / "versions"
GITHUB_TOKEN_FILE = WORKSPACE / ".github-token"

def get_github_token():
    """Read GitHub token from secure file"""
    if GITHUB_TOKEN_FILE.exists():
        return GITHUB_TOKEN_FILE.read_text().strip()
    return None

def pull_from_github(version_name):
    """
    Pull specific version from GitHub
    Creates new folder in versions/ with naming convention
    """
    token = get_github_token()
    if not token:
        return {"error": "GitHub token not found"}
    
    # Create version directory
    date_str = datetime.now().strftime("%Y%m%d")
    version_dir = VERSIONS_DIR / f"{version_name}-{date_str}"
    version_dir.mkdir(parents=True, exist_ok=True)
    
    # Clone with token
    auth_url = f"https://oscarsolis3301:{token}@github.com/oscarsolis3301/atlas-api.git"
    
    try:
        # Clone to temp
        temp_dir = version_dir / "temp_clone"
        result = subprocess.run(
            ["git", "clone", auth_url, str(temp_dir)],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            return {"error": f"Git clone failed: {result.stderr}"}
        
        # Move files up
        for item in temp_dir.iterdir():
            if item.name != ".git":
                shutil.move(str(item), str(version_dir / item.name))
        
        # Clean up
        shutil.rmtree(temp_dir)
        
        # Create metadata
        metadata = {
            "version_name": version_name,
            "backup_id": f"{version_name}-{date_str}",
            "pulled_from": "github",
            "timestamp": datetime.now().isoformat(),
            "status": "ready"
        }
        
        with open(version_dir / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "success": True,
            "version_dir": str(version_dir),
            "version_name": version_name,
            "message": f"Pulled {version_name} from GitHub to {version_dir}"
        }
        
    except Exception as e:
        return {"error": str(e)}

def switch_to_version(version_name):
    """
    Switch workspace to use specific version
    - Copies files from versions/{version_name} to workspace root
    - Updates current-version.json
    - Restarts server
    """
    date_str = datetime.now().strftime("%Y%m%d")
    version_dir = VERSIONS_DIR / f"{version_name}-{date_str}"
    
    # Find version dir (may have different dates)
    if not version_dir.exists():
        # Try to find any matching version
        for v_dir in VERSIONS_DIR.iterdir():
            if v_dir.is_dir() and version_name in v_dir.name:
                version_dir = v_dir
                break
    
    if not version_dir.exists():
        # Pull from GitHub if not local
        result = pull_from_github(version_name)
        if "error" in result:
            return result
        version_dir = Path(result["version_dir"])
    
    try:
        # Backup current
        current_backup = WORKSPACE / "current-backup"
        if current_backup.exists():
            shutil.rmtree(current_backup)
        
        # Copy important files from current
        for file in ["data", "backups", ".github-token"]:
            src = WORKSPACE / file
            if src.exists():
                if src.is_dir():
                    shutil.copytree(src, current_backup / file, dirs_exist_ok=True)
                else:
                    shutil.copy(src, current_backup / file)
        
        # Copy new version files (except data/)
        for item in version_dir.iterdir():
            if item.name not in ["data", "backups", ".git"]:
                dest = WORKSPACE / item.name
                if item.is_dir():
                    if dest.exists():
                        shutil.rmtree(dest)
                    shutil.copytree(item, dest)
                else:
                    shutil.copy(item, dest)
        
        # Update current-version.json
        metadata_file = version_dir / "metadata.json"
        if metadata_file.exists():
            metadata = json.load(open(metadata_file))
        else:
            metadata = {
                "version_name": version_name,
                "backup_id": f"{version_name}-{date_str}",
                "pulled_from": "local"
            }
        
        with open(WORKSPACE / "data" / "current-version.json", "w") as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "success": True,
            "message": f"Switched to {version_name}",
            "version_dir": str(version_dir),
            "restart_required": True
        }
        
    except Exception as e:
        return {"error": str(e)}

def create_github_release(version_name, description=""):
    """
    Push current code to GitHub as a new commit
    """
    token = get_github_token()
    if not token:
        return {"error": "GitHub token not found"}
    
    try:
        # Configure git
        subprocess.run(["git", "config", "user.email", "atlas@moliam.com"], cwd=WORKSPACE, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Atlas API"], cwd=WORKSPACE, capture_output=True)
        
        # Stage all changes
        subprocess.run(["git", "add", "."], cwd=WORKSPACE, capture_output=True)
        
        # Commit
        commit_msg = f"{version_name}: {description or 'New version'}"
        subprocess.run(
            ["git", "commit", "-m", commit_msg],
            cwd=WORKSPACE,
            capture_output=True
        )
        
        # Push to GitHub
        result = subprocess.run(
            ["git", "push", "origin", "main"],
            cwd=WORKSPACE,
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            return {"error": f"Push failed: {result.stderr}"}
        
        # Also create local version folder
        date_str = datetime.now().strftime("%Y%m%d")
        version_dir = VERSIONS_DIR / f"{version_name}-{date_str}"
        version_dir.mkdir(parents=True, exist_ok=True)
        
        # Copy current files
        for item in WORKSPACE.iterdir():
            if item.name not in ["versions", ".git", "__pycache__"]:
                if item.is_dir():
                    shutil.copytree(item, version_dir / item.name, dirs_exist_ok=True)
                else:
                    shutil.copy(item, version_dir / item.name)
        
        # Create metadata
        metadata = {
            "version_name": version_name,
            "backup_id": f"{version_name}-{date_str}",
            "description": description,
            "pushed_to": "github",
            "timestamp": datetime.now().isoformat()
        }
        with open(version_dir / "metadata.json", "w") as f:
            json.dump(metadata, f, indent=2)
        
        # Update current version
        with open(WORKSPACE / "data" / "current-version.json", "w") as f:
            json.dump(metadata, f, indent=2)
        
        return {
            "success": True,
            "message": f"Created release {version_name}",
            "pushed_to": "github",
            "local_version": str(version_dir)
        }
        
    except Exception as e:
        return {"error": str(e)}

def list_github_versions():
    """List all versions available on GitHub"""
    try:
        result = subprocess.run(
            ["git", "log", "--oneline", "-20"],
            cwd=WORKSPACE,
            capture_output=True,
            text=True
        )
        
        versions = []
        for line in result.stdout.strip().split("\n"):
            if line:
                parts = line.split(" ", 1)
                versions.append({
                    "commit": parts[0],
                    "message": parts[1] if len(parts) > 1 else "",
                    "is_version": "v" in line.lower() and "-toby" in line.lower()
                })
        
        return {"versions": versions}
        
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python github-rollback.py [push|pull|switch|list] [version_name] [description]")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == "push" and len(sys.argv) >= 3:
        result = create_github_release(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "")
    elif command == "pull" and len(sys.argv) >= 3:
        result = pull_from_github(sys.argv[2])
    elif command == "switch" and len(sys.argv) >= 3:
        result = switch_to_version(sys.argv[2])
    elif command == "list":
        result = list_github_versions()
    else:
        result = {"error": "Invalid command or missing version_name"}
    
    print(json.dumps(result, indent=2))
