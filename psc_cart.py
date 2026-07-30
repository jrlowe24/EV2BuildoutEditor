#!/usr/bin/env python3
"""Add Pacific Science Center tickets to a TNEW cart.

Companion to psc_showtimes.py. The add-to-cart flow was reverse-engineered from
tnew-event-detail.js and verified end to end against a real performance:

    POST /api/tickets/reservation
    Content-Type: application/x-www-form-urlencoded
    RequestVerificationToken: <value of input[name=__RequestVerificationToken]>

    isSingleSeatsEnabled, isUnseated, performanceId, productionSeasonId, zoneId
    ticketReservationRequests[0][pricetypeId]  1=Adult(18-64) 2=Youth(3-17) 3=Senior(65+)
    ticketReservationRequests[0][price]        0 unless the price is user-set
    ticketReservationRequests[0][isUserPrice]  false
    ticketReservationRequests[0][quantity]

A successful response is {"type":"Success","redirectLocation":"/components/precart?p=1"},
and GET /api/cart/timer then reports the hold countdown (~20 minutes).

IMPORTANT — two hard limits, both confirmed by testing:

1. The cart lives in a server-side session keyed by the cookies in THIS process
   (ASP.NET_SessionId, .ASPXFORMSAUTH, TNEW). A cart created here is not visible
   in your browser unless you import those cookies — see --cookies.
2. /cart and /checkout return 403 to non-browser clients (Imperva/Incapsula WAF),
   so checkout cannot be completed from a script. A human in a real browser has
   to finish the purchase.

Usage:
    python3 psc_cart.py --performance 80599 --quantity 2      # add 2 adult tickets
    python3 psc_cart.py --timer                               # hold time remaining
    python3 psc_cart.py --cookies                             # cookies to import
"""

from __future__ import annotations

import argparse
import http.cookiejar
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://my.pacificsciencecenter.org"
ODYSSEY_PRODUCTION = 79140
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
PRICE_TYPES = {"adult": 1, "youth": 2, "senior": 3}
DEFAULT_JAR = os.path.expanduser("~/.psc_cart_cookies.txt")


class CartError(RuntimeError):
    pass


def make_opener(jar_path: str):
    jar = http.cookiejar.LWPCookieJar(jar_path)
    try:
        jar.load(ignore_discard=True)
    except (FileNotFoundError, http.cookiejar.LoadError):
        pass
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", USER_AGENT)]
    return opener, jar


def add_to_cart(opener, jar, production_id, performance_id, quantity, pricetype_id):
    """Reserve `quantity` tickets. Returns the parsed API response."""
    detail_url = f"{BASE}/{production_id}/{performance_id}"
    try:
        with opener.open(detail_url, timeout=30) as response:
            page = response.read().decode("utf-8", "replace")
    except urllib.error.URLError as exc:
        raise CartError(f"could not load {detail_url}: {exc}") from exc

    if re.search(r"tn-event-detail__unavailable-text", page):
        note = re.search(r"tn-event-detail__unavailable-text[^>]*>(.*?)</p>", page, re.S)
        raise CartError(
            f"performance {performance_id} is not purchasable: "
            f"{re.sub(r'<[^>]+>', '', note.group(1)).strip() if note else 'unavailable'}"
        )

    token = re.search(r'name="__RequestVerificationToken"[^>]*value="([^"]+)"', page)
    config = re.search(r"new window\.tnew\.EventDetail\(\s*(\{.*?\})\s*\)", page, re.S)
    if not token or not config:
        raise CartError("could not find the verification token or ticket-selector config")

    parsed = json.loads(config.group(1))
    perf = parsed["performanceConfiguration"]
    zone = parsed.get("ticketSelectorOptions", {}).get("selectedZoneId", "0")

    payload = urllib.parse.urlencode(
        {
            "isSingleSeatsEnabled": str(perf["isSingleSeatsEnabled"]).lower(),
            "isUnseated": str(perf["isUnseated"]).lower(),
            "performanceId": perf["performanceId"],
            "productionSeasonId": perf["productionSeasonId"],
            "zoneId": zone,
            "ticketReservationRequests[0][pricetypeId]": pricetype_id,
            "ticketReservationRequests[0][price]": 0,
            "ticketReservationRequests[0][isUserPrice]": "false",
            "ticketReservationRequests[0][quantity]": quantity,
            "specialRequests": "",
        }
    ).encode()

    request = urllib.request.Request(
        f"{BASE}/api/tickets/reservation",
        data=payload,
        headers={
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Accept": "application/json, text/javascript, */*; q=0.01",
            "X-Requested-With": "XMLHttpRequest",
            "RequestVerificationToken": token.group(1),
            "Referer": detail_url,
        },
    )
    try:
        with opener.open(request, timeout=30) as response:
            body = response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as exc:
        raise CartError(f"HTTP {exc.code}: {exc.read().decode('utf-8', 'replace')[:300]}")
    finally:
        jar.save(ignore_discard=True)

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        raise CartError(f"unexpected response: {body[:300]}")


def cart_timer(opener) -> float | None:
    """Minutes left on the cart hold, or None if there's no cart."""
    request = urllib.request.Request(
        f"{BASE}/api/cart/timer",
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": BASE + "/events",
        },
    )
    try:
        with opener.open(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8", "replace"))
    except (urllib.error.URLError, json.JSONDecodeError):
        return None
    remaining = data.get("millisecondsRemaining") or 0
    return remaining / 60000 if remaining else None


def print_cookies(jar) -> None:
    """Emit the cookies a browser needs to adopt this cart."""
    wanted = ("ASP.NET_SessionId", ".ASPXFORMSAUTH", "TNEW")
    print("Import these into my.pacificsciencecenter.org, then open /cart:\n")
    for cookie in jar:
        if cookie.name in wanted:
            print(f"  {cookie.name}={cookie.value}")
    print(
        "\nIn the browser console on https://my.pacificsciencecenter.org "
        "(HttpOnly cookies may need devtools > Application > Cookies instead):"
    )
    for cookie in jar:
        if cookie.name in wanted:
            print(f'  document.cookie = "{cookie.name}={cookie.value}; path=/";')


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("-p", "--performance", type=int, help="performance id")
    parser.add_argument(
        "--production", type=int, default=ODYSSEY_PRODUCTION, help="production season id"
    )
    parser.add_argument("-q", "--quantity", type=int, default=2, help="tickets (default 2)")
    parser.add_argument(
        "--type", choices=sorted(PRICE_TYPES), default="adult", help="price type"
    )
    parser.add_argument("--jar", default=DEFAULT_JAR, help="cookie jar path")
    parser.add_argument("--timer", action="store_true", help="show hold time remaining")
    parser.add_argument("--cookies", action="store_true", help="show handoff cookies")
    args = parser.parse_args(argv)

    opener, jar = make_opener(args.jar)

    if args.timer or args.cookies:
        if args.timer:
            minutes = cart_timer(opener)
            print(f"{minutes:.1f} min left on hold" if minutes else "no active cart")
        if args.cookies:
            print_cookies(jar)
        return 0

    if not args.performance:
        parser.error("--performance is required (or use --timer / --cookies)")

    try:
        result = add_to_cart(
            opener, jar, args.production, args.performance,
            args.quantity, PRICE_TYPES[args.type],
        )
    except CartError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if result.get("type") != "Success":
        print(f"not added: {json.dumps(result)}", file=sys.stderr)
        return 1

    minutes = cart_timer(opener)
    print(f"Added {args.quantity} x {args.type} to cart for performance {args.performance}.")
    if minutes:
        print(f"Hold expires in {minutes:.1f} minutes.")
    print("\nCheckout must happen in a browser (/cart is WAF-blocked to scripts).")
    print_cookies(jar)
    return 0


if __name__ == "__main__":
    sys.exit(main())
