#!/bin/bash

# MyTuner Radio Scraper (Optimized Batch Mode)
# Usage: ./mytuner.sh <code> <name> [max_pages]

CODE=$1
NAME=$2
MAX_PAGES=${3:-1000}

if [[ -z "$CODE" || -z "$NAME" ]]; then
    echo "Usage: $0 <code> <name> [max_pages]"
    exit 1
fi

SCRAPER_DIR="$(dirname "$0")"
FETCHER="node $SCRAPER_DIR/mytuner_fetcher.js"
OUTPUT_DIR="$SCRAPER_DIR/data"
OUTPUT_FILE="$OUTPUT_DIR/${CODE^^}.json" # Use uppercase ISO code for filename
STATIONS_JSON="[]"

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_FILE.tmp"

# Colors
GRAY=$'\033[0;90m'
WHITE=$'\033[1;37m'
CYAN=$'\033[1;36m'
BLUE=$'\033[1;34m'
GREEN=$'\033[1;32m'
RED=$'\033[1;31m'
MAGENTA=$'\033[1;35m'
YELLOW=$'\033[1;33m'
NC=$'\033[0m'

COL_IDX=4
COL_NAME=44
COL_STATUS=10
COL_FORMAT=12

print_separator() {
    echo -ne "${GRAY}"
    printf "+-%-${COL_IDX}s-+-%-${COL_NAME}s-+-%-${COL_STATUS}s-+-%-${COL_FORMAT}s-+\n" \
        "$(printf '%*s' $COL_IDX '' | tr ' ' '-')" \
        "$(printf '%*s' $COL_NAME '' | tr ' ' '-')" \
        "$(printf '%*s' $COL_STATUS '' | tr ' ' '-')" \
        "$(printf '%*s' $COL_FORMAT '' | tr ' ' '-')"
    echo -ne "${NC}"
}

print_header() {
    print_separator
    printf "${GRAY}|${NC} ${WHITE}%-${COL_IDX}s${NC} ${GRAY}|${NC} ${WHITE}%-${COL_NAME}s${NC} ${GRAY}|${NC} ${WHITE}%-${COL_STATUS}s${NC} ${GRAY}|${NC} ${WHITE}%-${COL_FORMAT}s${NC} ${GRAY}|${NC}\n" \
        "No" "Station" "Status" "Format"
    print_separator
}

print_row() {
    local idx="$1"
    local name="$2"
    local status_colored="$3"
    local format="$4"
    local clean_status
    clean_status=$(echo -e "$status_colored" | sed 's/\x1b\[[0-9;]*m//g')
    local color_code="${RED}"
    if [[ "$status_colored" == *"$GREEN"* ]]; then color_code="${GREEN}"; fi
    printf "${GRAY}|${NC} ${BLUE}%-${COL_IDX}s${NC} ${GRAY}|${NC} ${CYAN}%-44.44s${NC} ${GRAY}|${NC} %b%-${COL_STATUS}s${NC} ${GRAY}|${NC} ${MAGENTA}%-${COL_FORMAT}s${NC} ${GRAY}|${NC}\n" \
        "$idx" "$name" "$color_code" "$clean_status" "$format"
}

echo -e "${CYAN}==================================================${NC}"
echo -e "${YELLOW}Scraping MyTuner $NAME ($CODE)${NC}"
echo -e "${CYAN}==================================================${NC}"

PAGE_URL="https://mytuner-radio.com/radio/country/${CODE}-stations"
PAGES_SCRAPED=0
STATION_TOTAL=0

while [[ $PAGES_SCRAPED -lt $MAX_PAGES && -n "$PAGE_URL" ]]; do
    echo -e "${CYAN}Fetching page $((PAGES_SCRAPED + 1)):${NC} $PAGE_URL"
    
    LIST_RESULT=$($FETCHER "$PAGE_URL" "country")
    if [[ $? -ne 0 || -z "$LIST_RESULT" ]]; then
        echo -e "${RED}Error fetching listing. URL: $PAGE_URL${NC}"
        break
    fi

    # Extract station URLs to a comma-separated string for batch fetching
    STATION_URLS_CSV=$(echo "$LIST_RESULT" | jq -r '.stations[].url' | paste -sd "," -)
    
    if [[ -z "$STATION_URLS_CSV" ]]; then
        echo -e "${YELLOW}No stations found on this page.${NC}"
        break
    fi

    print_header
    
    # Append results to temporary file (JSONL format) using process substitution to avoid subshell
    while read -r DETAIL; do
        if [[ -z "$DETAIL" || "$DETAIL" == *"error"* ]]; then continue; fi

        ((STATION_TOTAL++))
        S_NAME=$(echo "$DETAIL" | jq -r '.name')
        
        # Pick the first stream and skip testing (handled by ingest.py)
        FIRST_STREAM=$(echo "$DETAIL" | jq -r '.streams[0].url')
        WORKING_STREAM="$FIRST_STREAM"
        WORKING_FORMAT="unknown"
        WORKING_STATUS="${GRAY}untested${NC}"

        print_row "$STATION_TOTAL" "$S_NAME" "$WORKING_STATUS" "$WORKING_FORMAT"
        
        # Build JSON item
        STATION_JSON=$(echo "$DETAIL" | jq -c --arg status "$(echo -e "$WORKING_STATUS" | sed 's/\x1b\[[0-9;]*m//g')" \
                                          --arg codec "$WORKING_FORMAT" \
                                          --arg best_url "$WORKING_STREAM" \
                                          --arg time "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
                                          '. + {
                                            status: $status, 
                                            codec: $codec, 
                                            stream_url: $best_url, 
                                            last_tested_at: $time
                                          } | del(.verified_url, .streams)')
        
        echo "$STATION_JSON" >> "$OUTPUT_FILE.tmp"
    done < <($FETCHER "$STATION_URLS_CSV" "station")
    print_separator
    
    # Next page?
    PAGE_URL=$(echo "$LIST_RESULT" | jq -r '.nextPage')
    ((PAGES_SCRAPED++))
done

# Cleanup and final assembly
if [[ -f "$OUTPUT_FILE.tmp" ]]; then
   # Final wrap into array and deduplicate by ID
   jq -s 'unique_by(.id)' "$OUTPUT_FILE.tmp" > "$OUTPUT_FILE"
   rm -f "$OUTPUT_FILE.tmp"
fi

if [ "$STATION_TOTAL" -gt 0 ]; then
    echo -e "\n${GREEN}Scrape complete! Saved $STATION_TOTAL stations to $OUTPUT_FILE${NC}"
else
    echo -e "\n${RED}No stations scraped.${NC}"
fi
