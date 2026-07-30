#!/usr/bin/env python3
"""Find Pacific Science Center showtimes that aren't sold out.

my.pacificsciencecenter.org is a Tessitura TNEW storefront. Its event listing
page is rendered client-side from a single JSON endpoint, so we query that
directly instead of parsing HTML:

    POST /api/products/productionseasons
    Content-Type: application/x-www-form-urlencoded
    startDate=<iso>&endDate=<iso>

The response is a list of production seasons, each with a `performances` list
carrying `isOnSale`, `hasLimitedSeatingAvailable` and an HTML status message
("Sold Out!", "Limited Seating!", ...). That's everything needed to tell an
open showtime from a sold-out one.

Examples:
    python3 psc_showtimes.py                     # Odyssey, next 30 days, open seats only
    python3 psc_showtimes.py --days 60 --all     # include sold-out showtimes
    python3 psc_showtimes.py --event laser       # a different show
    python3 psc_showtimes.py --list              # what's on sale at all
    python3 psc_showtimes.py --watch 300         # poll every 5 min, print new openings
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta

BASE = "https://my.pacificsciencecenter.org"
API = BASE + "/api/products/productionseasons"
LISTING = BASE + "/events"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

AVAILABLE = "available"
LIMITED = "limited"
SOLD_OUT = "sold_out"
NOT_ON_SALE = "not_on_sale"

STATUS_LABEL = {
    AVAILABLE: "Available",
    LIMITED: "Limited seating",
    SOLD_OUT: "SOLD OUT",
    NOT_ON_SALE: "Not on sale",
}


class FetchError(RuntimeError):
    pass


def venue_now() -> datetime:
    """Current wall-clock time in Seattle, as a naive datetime.

    Performance times come back as Pacific local time, and this script may well
    run somewhere else (a UTC container, a cron box), so compare against the
    venue's clock rather than the host's.
    """
    try:
        from zoneinfo import ZoneInfo

        return datetime.now(ZoneInfo("America/Los_Angeles")).replace(tzinfo=None)
    except Exception:  # no tzdata installed — host clock is the best we have
        return datetime.now()


@dataclass
class Showtime:
    production: str
    performance_id: int
    starts_at: datetime
    display_date: str
    display_time: str
    status: str
    status_message: str
    url: str

    @property
    def bookable(self) -> bool:
        """True when seats can actually be bought right now."""
        return self.status in (AVAILABLE, LIMITED)

    def as_dict(self) -> dict:
        return {
            "production": self.production,
            "performance_id": self.performance_id,
            "starts_at": self.starts_at.isoformat(),
            "display_date": self.display_date,
            "display_time": self.display_time,
            "status": self.status,
            "status_message": self.status_message,
            "bookable": self.bookable,
            "url": self.url,
        }


def strip_html(raw: str) -> str:
    """TNEW status messages arrive as inline-styled HTML; reduce to plain text."""
    return html.unescape(re.sub(r"<[^>]+>", "", raw or "")).strip()


def classify(perf: dict) -> str:
    message = strip_html(perf.get("performanceStatusMessage", "")).lower()
    on_sale = bool(perf.get("isOnSale"))
    limited = bool(perf.get("hasLimitedSeatingAvailable"))

    if "sold out" in message:
        return SOLD_OUT
    if not on_sale:
        # Anything unsellable that isn't flagged sold out is simply not open yet.
        return NOT_ON_SALE
    return LIMITED if limited or "limited" in message else AVAILABLE


def parse_performance_date(perf: dict) -> datetime:
    """Prefer the tz-aware performanceDate; fall back to the naive ISO string."""
    for key in ("performanceDate", "iso8601DateString"):
        value = perf.get(key)
        if not value:
            continue
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError:
            continue
        return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
    return datetime.max


def fetch_productions(start: datetime, end: datetime, timeout: float = 30.0) -> list[dict]:
    payload = urllib.parse.urlencode(
        {
            "startDate": start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "endDate": end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
    ).encode()
    request = urllib.request.Request(
        API,
        data=payload,
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": LISTING,
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        raise FetchError(f"HTTP {exc.code} from {API}: {exc.reason}") from exc
    except urllib.error.URLError as exc:
        raise FetchError(f"Could not reach {API}: {exc.reason}") from exc

    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise FetchError(
            "Unexpected non-JSON response — the listing API may have changed "
            f"or a bot filter intercepted the request (first 200 chars: {body[:200]!r})"
        ) from exc

    if not isinstance(data, list):
        raise FetchError(f"Expected a list of productions, got {type(data).__name__}")
    return data


def collect_showtimes(
    productions: list[dict],
    event: str | None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[Showtime]:
    """Flatten productions into a sorted list of showtimes.

    The API honours the requested window only loosely — it can return
    performances a little outside it — so the window is re-applied here.
    """
    needle = (event or "").strip().lower()
    showtimes: list[Showtime] = []

    for production in productions:
        title = production.get("productionTitle") or "(untitled)"
        if needle and needle not in title.lower():
            continue
        for perf in production.get("performances") or []:
            when = parse_performance_date(perf)
            if start and when < start:
                continue
            if end and when >= end:
                continue
            showtimes.append(
                Showtime(
                    production=title,
                    performance_id=perf.get("id", 0),
                    starts_at=when,
                    display_date=perf.get("displayDate") or "",
                    display_time=perf.get("displayTime") or "",
                    status=classify(perf),
                    status_message=strip_html(perf.get("performanceStatusMessage", "")),
                    url=perf.get("actionUrl") or LISTING,
                )
            )

    showtimes.sort(key=lambda s: (s.starts_at, s.production))
    return showtimes


def print_table(showtimes: list[Showtime], show_all: bool) -> None:
    rows = [
        (
            s.display_date or s.starts_at.strftime("%A, %B %-d, %Y"),
            s.display_time or s.starts_at.strftime("%-I:%M%p"),
            STATUS_LABEL[s.status],
            s.production,
            s.url,
        )
        for s in showtimes
    ]
    headers = ("Date", "Time", "Status", "Show", "Link")
    widths = [
        max(len(headers[i]), max((len(r[i]) for r in rows), default=0))
        for i in range(len(headers))
    ]

    def line(cells) -> str:
        return "  ".join(cell.ljust(widths[i]) for i, cell in enumerate(cells)).rstrip()

    print(line(headers))
    print("  ".join("-" * w for w in widths))
    for row in rows:
        print(line(row))

    open_count = sum(1 for s in showtimes if s.bookable)
    if show_all:
        print(f"\n{open_count} of {len(showtimes)} showtimes still have seats.")
    else:
        print(f"\n{open_count} showtime(s) with seats available.")


def list_productions(productions: list[dict]) -> None:
    print(f"{len(productions)} production(s) currently listed:\n")
    for production in sorted(
        productions, key=lambda p: (p.get("productionTitle") or "").lower()
    ):
        perfs = production.get("performances") or []
        open_now = sum(1 for p in perfs if classify(p) in (AVAILABLE, LIMITED))
        title = production.get("productionTitle") or "(untitled)"
        print(f"  {title:<34} {len(perfs):>3} showtimes, {open_now:>3} with seats")


def run_once(args) -> tuple[int, list[Showtime]]:
    """Print one report. Returns (exit code, showtimes that can be booked)."""
    # Default to "from now", so showtimes that already started drop off the list.
    # An explicit --start means the whole of that day.
    start = datetime.strptime(args.start, "%Y-%m-%d") if args.start else venue_now()
    # --end names a day the user wants included, so the real bound is the day after.
    end = (
        datetime.strptime(args.end, "%Y-%m-%d") + timedelta(days=1)
        if args.end
        else start + timedelta(days=args.days)
    )
    if end <= start:
        print(
            "empty date range: --end must be on or after --start, and --days at least 1",
            file=sys.stderr,
        )
        return 2, []
    span = f"{start:%Y-%m-%d} and {end - timedelta(days=1):%Y-%m-%d}"

    productions = fetch_productions(start, end)

    if args.list:
        list_productions(productions)
        return 0, []

    showtimes = collect_showtimes(productions, args.event, start, end)
    if not showtimes:
        label = f" matching {args.event!r}" if args.event else ""
        print(f"No showtimes{label} between {span}.", file=sys.stderr)
        return 1, []

    if not args.all:
        showtimes = [s for s in showtimes if s.bookable]

    if args.json:
        print(json.dumps([s.as_dict() for s in showtimes], indent=2))
    elif not showtimes:
        print(
            f"Everything is sold out between {span}."
            "  (Run with --all to see the full schedule.)"
        )
    else:
        print_table(showtimes, args.all)

    open_showtimes = [s for s in showtimes if s.bookable]
    # Exit 0 only when something is actually buyable, so this can drive a cron alert.
    return (0 if open_showtimes else 1), open_showtimes


def watch(args) -> int:
    """Re-check on an interval, calling out showtimes that opened up since last time."""
    # Long-running, so don't sit on output when piped to a log or a notifier.
    sys.stdout.reconfigure(line_buffering=True)
    seen: set[int] | None = None
    while True:
        print(f"\n=== {venue_now():%Y-%m-%d %H:%M:%S} Pacific ===")
        try:
            _, open_showtimes = run_once(args)
        except FetchError as exc:
            print(f"fetch failed: {exc}", file=sys.stderr)
        else:
            if seen is not None:
                fresh = [s for s in open_showtimes if s.performance_id not in seen]
                if fresh:
                    print("\n*** Newly available since last check ***")
                    for s in fresh:
                        print(
                            f"  {s.display_date} {s.display_time} — "
                            f"{s.production} — {s.url}"
                        )
            seen = {s.performance_id for s in open_showtimes}
        time.sleep(args.watch)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Find Pacific Science Center showtimes that are not sold out.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Exit code is 0 when at least one showtime has seats, 1 when none do.",
    )
    parser.add_argument(
        "-e",
        "--event",
        default="odyssey",
        help="case-insensitive substring of the show title (default: %(default)s). "
        "Use '' for every show.",
    )
    parser.add_argument(
        "-d",
        "--days",
        type=int,
        default=30,
        help="days ahead to search from --start (default: %(default)s)",
    )
    parser.add_argument("--start", metavar="YYYY-MM-DD", help="first date to search")
    parser.add_argument("--end", metavar="YYYY-MM-DD", help="last date; overrides --days")
    parser.add_argument(
        "-a", "--all", action="store_true", help="include sold-out showtimes"
    )
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    parser.add_argument(
        "--list", action="store_true", help="list every production on sale and exit"
    )
    parser.add_argument(
        "-w",
        "--watch",
        type=int,
        metavar="SECONDS",
        help="re-check on this interval and highlight newly available showtimes",
    )
    args = parser.parse_args(argv)
    if args.watch is not None and args.watch < 1:
        parser.error("--watch interval must be at least 1 second")

    try:
        if args.watch:
            return watch(args)
        return run_once(args)[0]
    except FetchError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\nstopped.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
