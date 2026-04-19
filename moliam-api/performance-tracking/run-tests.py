#!/usr/bin/env python3
"""
Atlas Performance Test Suite
Tests V2 features vs V1 baseline, records to GitHub
"""

import json
import time
import subprocess
from datetime import datetime
from pathlib import Path

BASE_V1 = "https://atlas.moliam.com"  # Production V1
BASE_V2 = "http://localhost:8789"      # Local V2 (will start)
ADMIN_KEY = "atlas-admin-venzeti-2026"
LIBRARIAN_KEY = "atlas-lib-thinktank-2026"

RESULTS_DIR = Path("/Users/clark/.openclaw/workspace/moliam-api/performance-tracking")

def run_curl_test(url, headers, data=None, method="GET"):
    """Run curl command and measure timing"""
    cmd = ["curl", "-s", "-w", "\\n%{time_total},%{http_code}", "-o", "/tmp/response.json"]
    
    if headers:
        for h in headers:
            cmd.extend(["-H", h])
    
    if method == "POST":
        cmd.extend(["-X", "POST"])
        if data:
            cmd.extend(["-d", json.dumps(data)])
    
    cmd.append(url)
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    # Parse timing
    output_lines = result.stdout.strip().split("\n")
    timing_line = output_lines[-1] if output_lines else "0,0"
    parts = timing_line.split(",")
    
    response_time = float(parts[0]) if len(parts) > 0 else 0
    http_code = int(parts[1]) if len(parts) > 1 else 0
    
    # Get response body
    try:
        with open("/tmp/response.json") as f:
            body = f.read()
            response_data = json.loads(body) if body else {}
    except:
        response_data = {"raw": body[:500] if body else ""}
    
    return {
        "response_time_ms": round(response_time * 1000, 2),
        "http_code": http_code,
        "response": response_data
    }

def test_name_query(base_url, key, version):
    """Test name query response time"""
    print(f"  Testing name query on {version}...")
    
    url = f"{base_url}/v1/chat/completions"
    headers = [
        f"Authorization: Bearer {key}",
        "Content-Type: application/json"
    ]
    data = {
        "messages": [{"role": "user", "content": "What is your name?"}]
    }
    
    result = run_curl_test(url, headers, data, "POST")
    
    # Extract response text
    response_text = ""
    if "choices" in result["response"]:
        response_text = result["response"]["choices"][0]["message"]["content"]
    elif "content" in result["response"]:
        response_text = result["response"]["content"]
    
    return {
        "version": version,
        "test": "name_query",
        "response_time_ms": result["response_time_ms"],
        "http_code": result["http_code"],
        "response_text": response_text[:100],
        "timestamp": datetime.now().isoformat()
    }

def test_health_check(base_url, version):
    """Test health check response time"""
    print(f"  Testing health check on {version}...")
    
    url = f"{base_url}/healthz"
    headers = ["Authorization: Bearer atlas-admin-venzeti-2026"]
    
    result = run_curl_test(url, headers)
    
    return {
        "version": version,
        "test": "health_check",
        "response_time_ms": result["response_time_ms"],
        "http_code": result["http_code"],
        "timestamp": datetime.now().isoformat()
    }

def test_user_query(base_url, key, version, user_name):
    """Test user query response time"""
    print(f"  Testing user query ({user_name}) on {version}...")
    
    url = f"{base_url}/v1/chat/completions"
    headers = [
        f"Authorization: Bearer {key}",
        "Content-Type: application/json"
    ]
    data = {
        "messages": [{"role": "user", "content": f"Who is {user_name}?"}]
    }
    
    result = run_curl_test(url, headers, data, "POST")
    
    return {
        "version": version,
        "test": "user_query",
        "user": user_name,
        "response_time_ms": result["response_time_ms"],
        "http_code": result["http_code"],
        "timestamp": datetime.now().isoformat()
    }

def test_github_rollback(version_name):
    """Test GitHub rollback and record timing"""
    print(f"  Testing GitHub rollback to {version_name}...")
    
    start_time = time.time()
    
    url = f"{BASE_V1}/v1/admin/github/rollback"
    headers = [
        f"Authorization: Bearer {ADMIN_KEY}",
        "Content-Type: application/json"
    ]
    data = {"version_name": version_name}
    
    result = run_curl_test(url, headers, data, "POST")
    
    # Wait for restart
    time.sleep(5)
    
    # Check if server is back
    restart_success = False
    for i in range(10):
        health = run_curl_test(f"{BASE_V1}/healthz", [f"Authorization: Bearer {ADMIN_KEY}"])
        if health["http_code"] == 200:
            restart_success = True
            break
        time.sleep(1)
    
    total_time = (time.time() - start_time) * 1000
    
    return {
        "test": "github_rollback",
        "version_name": version_name,
        "api_response_ms": result["response_time_ms"],
        "total_time_ms": round(total_time, 2),
        "restart_success": restart_success,
        "http_code": result["http_code"],
        "timestamp": datetime.now().isoformat()
    }

def save_results(results, filename):
    """Save results to performance tracking folder"""
    filepath = RESULTS_DIR / filename
    with open(filepath, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"  Results saved to {filepath}")

def run_full_test_suite():
    """Run complete test suite"""
    print("╔══════════════════════════════════════════════════════════╗")
    print("║     ATLAS PERFORMANCE TEST SUITE                       ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print()
    
    results = {
        "test_run_id": datetime.now().strftime("%Y%m%d-%H%M%S"),
        "timestamp": datetime.now().isoformat(),
        "tests": []
    }
    
    # Test V1 (Production)
    print("═══════════════════════════════════════════════════════════")
    print("TESTING V1 (Production - Port 8788)")
    print("═══════════════════════════════════════════════════════════")
    
    health_v1 = test_health_check(BASE_V1, "v1")
    results["tests"].append(health_v1)
    print(f"  → {health_v1['response_time_ms']}ms")
    
    name_v1 = test_name_query(BASE_V1, LIBRARIAN_KEY, "v1")
    results["tests"].append(name_v1)
    print(f"  → {name_v1['response_time_ms']}ms - '{name_v1['response_text'][:50]}...'")
    
    user_v1 = test_user_query(BASE_V1, LIBRARIAN_KEY, "v1", "Oscar Solis")
    results["tests"].append(user_v1)
    print(f"  → {user_v1['response_time_ms']}ms")
    
    # Save V1 results
    save_results(results, f"speed-tests/v1-test-{datetime.now().strftime('%Y%m%d')}.json")
    
    print()
    print("═══════════════════════════════════════════════════════════")
    print("TESTING GITHUB ROLLBACK")
    print("═══════════════════════════════════════════════════════════")
    
    # Test rollback
    rollback_result = test_github_rollback("v01-toby")
    results["tests"].append(rollback_result)
    print(f"  → API: {rollback_result['api_response_ms']}ms, Total: {rollback_result['total_time_ms']}ms, Restart: {'✓' if rollback_result['restart_success'] else '✗'}")
    
    # Save rollback results
    save_results({"rollback_tests": [rollback_result]}, f"rollback-tests/rollback-{datetime.now().strftime('%Y%m%d')}.json")
    
    print()
    print("═══════════════════════════════════════════════════════════")
    print("SUMMARY")
    print("═══════════════════════════════════════════════════════════")
    
    for test in results["tests"]:
        print(f"{test['test']:20} | {test.get('version', 'N/A'):4} | {test['response_time_ms']:8.2f}ms")
    
    # Push to GitHub
    print()
    print("Pushing results to GitHub...")
    subprocess.run(["git", "add", "performance-tracking/"], cwd=RESULTS_DIR.parent, capture_output=True)
    subprocess.run(["git", "commit", "-m", f"Performance test results {results['test_run_id']}"], cwd=RESULTS_DIR.parent, capture_output=True)
    subprocess.run(["git", "push", "origin", "main"], cwd=RESULTS_DIR.parent, capture_output=True)
    print("✓ Results pushed to GitHub")
    
    return results

if __name__ == "__main__":
    run_full_test_suite()
