"""
MileSplit scraper — pulls athlete performance results from public pages.

Rate-limiting: 3-second delay between requests as recommended by the community.
Attribution: Data sourced from MileSplit (milesplit.com).
"""

import time
import re
import requests
from bs4 import BeautifulSoup

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}
DELAY = 3  # seconds between requests


def _get(url):
    time.sleep(DELAY)
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.text


def search_athlete(name):
    """
    Search MileSplit for an athlete by name.
    Returns a list of dicts: [{id, name, team, url}, ...]
    """
    url = f"https://www.milesplit.com/search/?q={requests.utils.quote(name)}&type=athletes"
    html = _get(url)
    soup = BeautifulSoup(html, "lxml")

    results = []
    seen_ids = set()

    # MileSplit search results are typically list items or divs containing
    # an athlete link plus a secondary team/school link.
    # We walk each result container to extract both.
    for container in soup.select("li, div.result, div.search-result, article"):
        a_tag = container.find("a", href=re.compile(r"/athletes/\d+"))
        if not a_tag:
            continue
        match = re.search(r"/athletes/(\d+)", a_tag["href"])
        if not match:
            continue
        athlete_id = match.group(1)
        if athlete_id in seen_ids:
            continue
        seen_ids.add(athlete_id)

        athlete_name = a_tag.get_text(separator=" ", strip=True)
        if not athlete_name:
            continue

        # Try to find a team/school link in the same container
        team = ""
        team_tag = container.find("a", href=re.compile(r"/teams/|/schools/"))
        if team_tag:
            team = team_tag.get_text(strip=True)

        results.append({
            "id": athlete_id,
            "name": athlete_name,
            "team": team,
            "url": f"https://www.milesplit.com/athletes/{athlete_id}",
        })

    # Fallback: if the container-based search found nothing, scan all athlete links
    if not results:
        for a_tag in soup.select("a[href*='/athletes/']"):
            match = re.search(r"/athletes/(\d+)", a_tag["href"])
            if not match:
                continue
            athlete_id = match.group(1)
            if athlete_id in seen_ids:
                continue
            seen_ids.add(athlete_id)
            text = a_tag.get_text(separator=" ", strip=True)
            if not text:
                continue
            results.append({
                "id": athlete_id,
                "name": text,
                "team": "",
                "url": f"https://www.milesplit.com/athletes/{athlete_id}",
            })

    return results


def athlete_exists(milesplit_id):
    """
    Return True if the MileSplit athlete profile page exists (HTTP 200).
    Used to validate IDs before saving to the database.
    """
    url = f"https://www.milesplit.com/athletes/{milesplit_id}"
    try:
        time.sleep(DELAY)
        resp = requests.get(url, headers=HEADERS, timeout=15, allow_redirects=True)
        return resp.status_code == 200
    except requests.RequestException:
        return False


def get_athlete_performances(milesplit_id):
    """
    Fetch an athlete's performance history from MileSplit.
    Returns a list of dicts: [{event, mark, meet, meet_date}, ...]

    MileSplit athlete performance URL:
      https://www.milesplit.com/athletes/<id>/performances
    """
    url = f"https://www.milesplit.com/athletes/{milesplit_id}/performances"
    html = _get(url)
    soup = BeautifulSoup(html, "lxml")

    performances = []

    # MileSplit performances page has a table with columns:
    # Place | Mark | Event | Meet | Date | Wind (sometimes)
    # The table may be inside a section or have class variations — we try several selectors.
    table = (
        soup.select_one("table.performances")
        or soup.select_one("table#performances")
        or soup.select_one("table")
    )

    if not table:
        return performances

    rows = table.select("tbody tr")
    if not rows:
        rows = table.select("tr")[1:]  # skip header row

    for row in rows:
        cells = [td.get_text(strip=True) for td in row.select("td")]
        if len(cells) < 3:
            continue

        # Try to map columns heuristically
        # Typical column order: Place, Mark, Wind?, Event, Meet, Date
        # We detect by looking for a time/distance pattern
        event = ""
        mark = ""
        meet = ""
        meet_date = ""

        # Find the mark column (time pattern like 4:32.10 or distance like 185-03)
        mark_pattern = re.compile(
            r"^\d{1,2}:\d{2}\.\d{1,2}$|"     # time: 4:32.10
            r"^\d{2,3}\.\d{1,2}$|"            # decimal distance: 45.32
            r"^\d{1,3}-\d{2}(\.\d+)?$"        # field: 185-03
        )

        for i, cell in enumerate(cells):
            if mark_pattern.match(cell):
                mark = cell
                # Event is usually the next cell after mark
                if i + 1 < len(cells):
                    event = cells[i + 1]
                # Meet and date come after
                if i + 2 < len(cells):
                    meet = cells[i + 2]
                if i + 3 < len(cells):
                    meet_date = cells[i + 3]
                break

        if mark and event:
            performances.append({
                "event": event,
                "mark": mark,
                "meet": meet,
                "meet_date": meet_date,
            })

    return performances


def get_meet_results(meet_url):
    """
    Scrape results from a specific MileSplit meet results page.
    meet_url example: https://www.milesplit.com/meets/123456/results

    Returns a list of dicts:
      [{place, athlete_name, team, event, mark, meet_date}, ...]
    """
    html = _get(meet_url)
    soup = BeautifulSoup(html, "lxml")

    results = []
    # Each event section is typically a <div> or <table> with a heading
    event_sections = soup.select("div.event-results, section.event-results")

    for section in event_sections:
        heading = section.select_one("h2, h3, h4")
        event_name = heading.get_text(strip=True) if heading else "Unknown"

        table = section.select_one("table")
        if not table:
            continue

        for row in table.select("tbody tr, tr")[1:]:
            cells = [td.get_text(strip=True) for td in row.select("td")]
            if len(cells) < 3:
                continue
            results.append({
                "event": event_name,
                "place": cells[0] if len(cells) > 0 else "",
                "athlete_name": cells[1] if len(cells) > 1 else "",
                "team": cells[2] if len(cells) > 2 else "",
                "mark": cells[3] if len(cells) > 3 else "",
            })

    return results
