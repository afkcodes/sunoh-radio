#!/usr/bin/env python3
import os
import json
import glob
from collections import defaultdict
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

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
    
    all_recordings = defaultdict(list)
    total_entries = 0
    
    # Files to process: src/radio/scrapers/providers/*/data/*.json
    files = glob.glob(os.path.join(providers_dir, "*/data/*.json"))
    
    print(f"Scanning {len(files)} files...")
    
    for file_path in files:
        try:
            # ISO code is the filename
            iso_code = os.path.basename(file_path).replace(".json", "")
            provider = os.path.basename(os.path.dirname(os.path.dirname(file_path)))
            
            with open(file_path, 'r', encoding='utf-8') as f:
                stations = json.load(f)
                
                for station in stations:
                    total_entries += 1
                    url = (station.get("stream_url") or station.get("verified_url") or "").strip()
                    if not url and "streams" in station and station["streams"]:
                        url = station["streams"][0].get("url")
                    
                    if url:
                        norm_url = normalize_url(url)
                        all_recordings[norm_url].append({
                            "name": station.get("name", "Unknown"),
                            "country": station.get("country", iso_code),
                            "provider": provider,
                            "file": file_path,
                            "original_url": url
                        })
        except Exception as e:
            print(f"Error processing {file_path}: {e}")

    # Identify true duplicates (URLs with > 1 occurrence)
    duplicates = {url: records for url, records in all_recordings.items() if len(records) > 1}
    
    output_path = "src/radio/scrapers/metadata/duplicates.json"
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(duplicates, f, indent=2, ensure_ascii=False)

    print("\n" + "="*50)
    print("      UNIQUE RADIO STATION SUMMARY")
    print("="*50)
    print(f"Total entries processed: {total_entries}")
    print(f"Unique playback URLs:    {len(all_recordings)}")
    print(f"Duplicate URLs found:    {len(duplicates)}")
    print(f"Duplicate report saved:  {output_path}")
    print("="*50)
    
    if all_recordings:
        redundancy = (total_entries - len(all_recordings)) / total_entries * 100
        print(f"Redundancy rate:         {redundancy:.2f}%")
        print("="*50)

if __name__ == "__main__":
    count_unique_stations()
