#!/usr/bin/env python3
import glob
import json
import os
from collections import defaultdict
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse


def normalize_url(url):
    """Normalize stream URL by removing session-specific query parameters."""
    if not url: return ""
    url = url.strip()
    try:
        u = urlparse(url)
        params = parse_qsl(u.query)
        strip_params = {
            'token', 'session_id', 'sid', 'uid', 'uuid', 'auth', 'expires',
            'timestamp', 'time', 'key', 'hash', 'signature', 'sign',
            'tracker', 'client_id', 'user_id', 'h', 't', 'session', 'player'
        }
        filtered_params = [(k, v) for k, v in params if k.lower() not in strip_params]
        filtered_params.sort()
        new_query = urlencode(filtered_params)
        return urlunparse(u._replace(query=new_query, fragment="")).rstrip('/')
    except Exception:
        return url

def count_unique_stations():
    # New Modular Path Structure
    scrapers_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    providers_dir = os.path.join(scrapers_root, "providers")

    provider_stats = defaultdict(lambda: {"total": 0, "unique": set()})
    global_unique = set()
    all_recordings = defaultdict(list)

    # Files to process: providers/*/data/*.json
    files = glob.glob(os.path.join(providers_dir, "*/data/*.json"))

    print(f"Scanning {len(files)} files...")

    for file_path in files:
        try:
            # ISO code is the filename
            iso_code = os.path.basename(file_path).replace(".json", "")
            # Path is providers/{provider}/data/{ISO}.json
            parts = file_path.split(os.sep)
            provider = parts[-3]

            with open(file_path, encoding='utf-8') as f:
                stations = json.load(f)

                for station in stations:
                    url = (station.get("stream_url") or station.get("verified_url") or "").strip()

                    if not url:
                        continue

                    norm_url = normalize_url(url)
                    provider_stats[provider]["total"] += 1
                    provider_stats[provider]["unique"].add(norm_url)
                    global_unique.add(norm_url)

                    all_recordings[norm_url].append({
                        "name": station.get("name", "Unknown"),
                        "country": station.get("country", iso_code),
                        "provider": provider,
                        "file": file_path,
                        "original_url": url
                    })
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    # Identify true duplicates
    duplicates = {url: records for url, records in all_recordings.items() if len(records) > 1}

    output_path = os.path.join(scrapers_root, "metadata", "duplicates.json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(duplicates, f, indent=2, ensure_ascii=False)

    print("\n" + "="*50)
    print("      RADIO STATION INGESTION SUMMARY")
    print("="*50)
    total_raw = 0
    for p, stats in provider_stats.items():
        total_raw += stats["total"]
        print(f"Provider: {p.upper()}")
        print(f"  - Raw entries:    {stats['total']}")
        print(f"  - Unique (norm):  {len(stats['unique'])}")

    print("-" * 50)
    print(f"Total Raw Entries:       {total_raw}")
    print(f"Total Unique (Merged):   {len(global_unique)}")
    print(f"Duplicate URLs found:    {len(duplicates)}")
    print(f"Duplicate report saved:  {output_path}")
    print("="*50)

    if total_raw:
        redundancy = (total_raw - len(global_unique)) / total_raw * 100
        print(f"Global Redundancy:       {redundancy:.2f}%")
        print("="*50)

if __name__ == "__main__":
    count_unique_stations()
