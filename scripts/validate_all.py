#!/usr/bin/env python3
import os
import json
import subprocess
import time
import argparse
import sys

# Configuration
os.environ["PATH"] = f"/home/ashish/n/bin:{os.environ.get('PATH', '')}"
SCRAPER_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
METADATA_DIR = os.path.join(SCRAPER_ROOT, "metadata")
CORE_DIR = os.path.join(SCRAPER_ROOT, "core")
STATE_FILE = os.path.join(METADATA_DIR, "ingestion_progress.json")
COUNTRIES_FILE = os.path.join(CORE_DIR, "countries.txt")
ISO_MAP_FILE = os.path.join(CORE_DIR, "countries_iso_map.json")

# Colors for output
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"

def log(msg, color=RESET):
    print(f"{color}{msg}{RESET}")

def run_command(cmd, timeout=None):
    """Run a shell command and return stdout, stderr, and return code."""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return "", "Timeout expired", 1
    except Exception as e:
        return "", str(e), 1

# Proton VPN ISO Mapping (for discrepencies like GB vs UK)
PROTON_MAP = {
    "gb": "uk",
    "el": "gr",
}

def vpn_disconnect():
    log("Disconnecting VPN...", YELLOW)
    run_command("protonvpn disconnect")
    time.sleep(2)

def vpn_connect(iso_code):
    """Connect to Proton VPN for a specific country code."""
    # Handle Proton-specific ISO overrides
    proton_iso = PROTON_MAP.get(iso_code.lower(), iso_code.lower())
    
    log(f"Attempting to connect to Proton VPN: {proton_iso} (Source: {iso_code})", CYAN)
    
    # Try connecting to the specific country
    stdout, stderr, code = run_command(f"protonvpn connect --country {proton_iso}")
    
    if code != 0:
        log(f"Failed to connect to {iso_code}. Falling back to US...", YELLOW)
        stdout, stderr, code = run_command("protonvpn connect --country us")
        if code != 0:
            log(f"CRITICAL: Failed to connect to VPN even with US fallback. {stderr}", RED)
            return False
    
    log(f"Successfully connected to VPN ({iso_code if code == 0 else 'US fallback'})", GREEN)
    time.sleep(5) # Wait for network to stabilize
    return True

def get_processed_countries():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_progress(country_name, status):
    progress = get_processed_countries()
    progress[country_name] = {
        "status": status,
        "last_run": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    os.makedirs(METADATA_DIR, exist_ok=True)
    with open(STATE_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

def main():
    parser = argparse.ArgumentParser(description="Orchestrate radio ingestion with automatic Proton VPN switching.")
    parser.add_argument("--provider", required=True, help="Radio provider name (e.g., onlineradiobox)")
    parser.add_argument("--force", action="store_true", help="Reprocess already processed countries")
    parser.add_argument("--resume", action="store_true", default=True, help="Resume from last processed country")
    
    args = parser.parse_args()
    provider = args.provider

    if not os.path.exists(COUNTRIES_FILE):
        log(f"Countries file not found: {COUNTRIES_FILE}", RED)
        sys.exit(1)

    # Load ISO Map
    iso_map = {}
    if os.path.exists(ISO_MAP_FILE):
        with open(ISO_MAP_FILE, 'r') as f:
            iso_map = json.load(f)

    processed = get_processed_countries()
    
    # Read countries.txt (format iso:Name)
    with open(COUNTRIES_FILE, 'r') as f:
        lines = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    log(f"Starting orchestration for {len(lines)} countries...", GREEN)

    for line in lines:
        try:
            iso_code, country_name = line.split(":", 1)
        except ValueError:
            continue

        if not args.force and country_name in processed and processed[country_name]["status"] == "success":
            log(f"Skipping {country_name} (Already processed)", YELLOW)
            continue

        log(f"\n>>> Processing Country: {country_name} ({iso_code})", CYAN)

        # 1. Connect VPN
        vpn_success = False
        retries = 3
        while retries > 0 and not vpn_success:
            if vpn_connect(iso_code):
                vpn_success = True
            else:
                retries -= 1
                log(f"VPN connection failed. Retries left: {retries}", YELLOW)
                vpn_disconnect()
                time.sleep(5)

        if not vpn_success:
            log(f"Skipping {country_name} due to VPN failure.", RED)
            save_progress(country_name, "failed_vpn")
            continue

        # 2. Run Ingestion
        log(f"Running ingestion for {country_name}...", CYAN)
        # ingest.py is in the same directory as this script
        ingest_cmd = f"python3 {SCRAPER_ROOT}/scripts/ingest.py --provider {provider} --country \"{country_name}\" --iso {iso_code}"
        stdout, stderr, code = run_command(ingest_cmd)

        if code == 0:
            log(f"Successfully ingested {country_name}", GREEN)
            
            # 3. Sync to DB (Optional but recommended for reliability)
            log(f"Syncing {country_name} to database...", CYAN)
            sync_cmd = f"npx tsx {SCRAPER_ROOT}/src/sync_to_db.ts {provider} \"{country_name}\""
            s_stdout, s_stderr, s_code = run_command(sync_cmd)
            
            if s_code == 0:
                log(f"Successfully synced {country_name} to DB", GREEN)
                save_progress(country_name, "success")
            else:
                log(f"Ingested but sync failed for {country_name}: {s_stderr}", YELLOW)
                save_progress(country_name, "failed_sync")
        else:
            log(f"Ingestion failed for {country_name}: {stderr}", RED)
            save_progress(country_name, "failed_ingest")

        # 4. Disconnect VPN (Optional: can keep it if next country is same, but safer to cycle)
        # However, Proton VPN switching usually handles this.
        # vpn_disconnect() 

    log("\nOrchestration Complete!", GREEN)
    vpn_disconnect()

if __name__ == "__main__":
    main()
