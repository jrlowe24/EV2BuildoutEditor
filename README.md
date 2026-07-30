# EV2BuildoutEditor

## psc_showtimes.py — Pacific Science Center showtime checker

Finds showtimes at [my.pacificsciencecenter.org](https://my.pacificsciencecenter.org)
that aren't sold out. Defaults to **The Odyssey**.

Python 3.9+, no dependencies.

```bash
python3 psc_showtimes.py                    # Odyssey, next 30 days, open showtimes only
python3 psc_showtimes.py --days 60 --all    # longer window, include sold-out showtimes
python3 psc_showtimes.py --start 2026-08-08 --end 2026-08-09
python3 psc_showtimes.py --time 7:30        # only the 7:30PM shows
python3 psc_showtimes.py -e laser           # any other show (substring of the title)
python3 psc_showtimes.py -e '' --days 3     # every show
python3 psc_showtimes.py --list             # what's on sale right now
python3 psc_showtimes.py --json             # machine-readable
python3 psc_showtimes.py --watch 300        # re-check every 5 min, flag new openings
python3 psc_showtimes.py --no-verify        # trust the (stale) listing feed; faster
```

Sample output:

```
Date                       Time     Status           Show         Link
-------------------------  -------  ---------------  -----------  ------------------------------------------------
Friday, July 31, 2026      12:40PM  Limited seating  The Odyssey  https://my.pacificsciencecenter.org/79140/79173
Monday, August 3, 2026     12:40PM  Available        The Odyssey  https://my.pacificsciencecenter.org/79140/80599

2 showtime(s) with seats available.
```

### How it works

The ticketing site is a Tessitura TNEW storefront whose event listing is rendered
client-side from a single JSON endpoint, so the script queries that directly rather
than parsing HTML:

```
POST /api/products/productionseasons
Content-Type: application/x-www-form-urlencoded

startDate=2026-07-30T00:00:00Z&endDate=2026-08-29T00:00:00Z
```

Each performance in the response carries `isOnSale`,
`hasLimitedSeatingAvailable` and an HTML `performanceStatusMessage`
("Sold Out!", "Limited Seating!"), which map to four statuses:

| Status | Meaning |
| --- | --- |
| `available` | on sale, no seating warning |
| `limited` | on sale, flagged "Limited Seating!" |
| `sold_out` | flagged "Sold Out!" |
| `not_on_sale` | not yet released |

`available` and `limited` count as bookable.

### The listing feed lies

**The listing feed is cached and over-reports availability.** It will report
`"Limited Seating!"` for a performance whose purchase page already says
`Sold Out!` — observed live, and the same performance flip-flopped between two
runs three minutes apart. Trusting it alone means being sent to a dead link.

So every showtime the listing calls bookable is confirmed against its own
purchase page, which is what actually gates a sale:

* `<p class="tn-event-detail__unavailable-text">Sold Out!</p>` → really gone
* `id="tn-add-to-cart-button"` → really buyable

Verification only ever *downgrades* a showtime, runs on the handful of open
candidates (4 at a time, ~6s for a typical query), and reports how many the
listing got wrong. `--no-verify` skips it and is roughly 6x faster, but then
you're back to trusting the cache.

If a purchase page can't be reached, that showtime is labelled `(?)` rather than
being passed off as confirmed — it's the listing's unverified word.

### Availability moves in minutes

Even with verification, this is a snapshot. Popular evening showtimes were
observed going from genuinely buyable to sold out inside two minutes: seats come
back when someone's cart expires and are taken almost immediately. Every run
prints the time it checked, and `--watch` rings the terminal bell when something
opens up — that's the realistic way to catch a hot showtime:

```bash
python3 psc_showtimes.py --watch 120 --time 7:30 --days 7
```

Two smaller details: the endpoint honours the requested date window only
loosely, so the window is re-applied client-side; and showtimes are Pacific time
while the script may run elsewhere, so "now" is computed in `America/Los_Angeles`.

### Exit codes

`0` when at least one showtime has seats, `1` when none do, `2` on a fetch or
argument error — so it can drive a cron alert:

```bash
*/15 * * * * cd ~/EV2BuildoutEditor && python3 psc_showtimes.py --days 14 \
  && echo "Odyssey seats open" | mail -s "PacSci" you@example.com
```

Please keep polling intervals reasonable (minutes, not seconds).

## psc_cart.py — add tickets to the cart

Companion script. Reserves tickets via the flow used by the site's own ticket
selector, reverse-engineered from `tnew-event-detail.js` and verified end to end:

```
POST /api/tickets/reservation          (form-urlencoded)
RequestVerificationToken: <input[name=__RequestVerificationToken]>

performanceId, productionSeasonId, zoneId, isSingleSeatsEnabled, isUnseated
ticketReservationRequests[0][pricetypeId]   1=Adult(18-64) 2=Youth(3-17) 3=Senior(65+)
ticketReservationRequests[0][quantity]
```

```bash
python3 psc_cart.py --performance 80599 --quantity 2   # 2 adult tickets
python3 psc_cart.py --timer                            # hold time remaining
python3 psc_cart.py --cookies                          # cookies for browser handoff
```

Success returns `{"type":"Success"}` and `GET /api/cart/timer` then counts down
the hold (**~20 minutes**).

### Two hard limits

Both confirmed by testing, and they shape how this can actually be used:

1. **The cart is not portable.** It lives in a server-side session keyed to this
   process's cookies (`ASP.NET_SessionId`, `.ASPXFORMSAUTH`, `TNEW`). A cart
   created by the script is invisible in your browser unless you import those
   cookies (`--cookies` prints them). That import path is **unverified** — this
   environment has no browser egress to test it.
2. **Checkout is impossible from a script.** `/cart` and `/checkout` return
   **403** to non-browser clients (Imperva/Incapsula WAF), while the JSON APIs
   are not blocked. A human in a real browser must finish the purchase.

So the realistic play for a hot showtime is: script reserves the seats the
instant they appear (buying you the ~20 minute hold), and you complete checkout
in your browser — via the cookie import if it works, or by booking the link
directly if it doesn't.
