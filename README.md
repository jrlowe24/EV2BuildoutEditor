# EV2BuildoutEditor

## psc_showtimes.py — Pacific Science Center showtime checker

Finds showtimes at [my.pacificsciencecenter.org](https://my.pacificsciencecenter.org)
that aren't sold out. Defaults to **The Odyssey**.

Python 3.9+, no dependencies.

```bash
python3 psc_showtimes.py                    # Odyssey, next 30 days, open showtimes only
python3 psc_showtimes.py --days 60 --all    # longer window, include sold-out showtimes
python3 psc_showtimes.py --start 2026-08-08 --end 2026-08-09
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
