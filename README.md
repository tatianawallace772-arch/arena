# Catoosa County Public Schools · Interactive Calendar (2026–2027 & 2027–2028)

An animated, interactive version of the Catoosa County School System (Ringgold, GA) student calendars.

## Features
- **Year switcher**: toggle between 2026–2027 and 2027–2028, with animated month transitions
- **Live countdown** to the next event (or "back to school" while you're on a break)
- **Year progress ring**: student days done and days left
- **Animated month grid**: color-coded days, a pulsing "today" marker, hover tooltips, and a click-to-open day drawer (←/→ keys step through days, Esc closes it)
- **Legend filters** that highlight only breaks, holidays, early releases, and so on
- **Timeline view** of every event, with the next one highlighted
- **Breaks at a glance**: total days off in a row (weekends included)
- **"Is there school on…?"** date checker
- **.ics export** for Google, Apple, or Outlook calendars, plus links to the official PDFs
- Dark mode, print layout, mobile layout, and `prefers-reduced-motion` support

## Run
No build step is needed. Serve the folder:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. To preview a different "today", add `?today=2027-03-01`.

## Data
The dates in `data.js` come from the official calendars that the Board of Education adopted on December 2, 2025:
- 2026–2027: https://files.smartsites.parentsquare.com/13442/2026-2027_school_calendar_1.pdf
- 2027–2028: https://files.smartsites.parentsquare.com/13442/2027-2028_school_calendar_1.pdf

The district can change the calendar. Always check with https://www.catoosa.k12.ga.us/district-calendars.
This is an unofficial project.
