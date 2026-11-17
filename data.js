/*
 * Catoosa County Public Schools — student calendar data
 * Source: Official 2026-2027 and 2027-2028 School Calendars,
 *         adopted by the Catoosa County Board of Education on December 2, 2025.
 *         https://www.catoosa.k12.ga.us/district-calendars
 *
 * Event types:
 *   milestone – first / last day of school
 *   holiday   – district holiday, no school
 *   break     – multi-day break, no school
 *   inservice – student holiday / teacher in-service (no school for students)
 *   early     – early release (1/2 day for students)
 *
 * All dates are inclusive. Calendar may change due to conditions beyond the
 * district's control, as specified in state law.
 */
window.CALENDAR_DATA = {
  "2026-2027": {
    label: "2026 – 2027",
    first: "2026-08-07",
    last: "2027-05-25",
    pdf: "https://files.smartsites.parentsquare.com/13442/2026-2027_school_calendar_1.pdf",
    events: [
      { start: "2026-08-07", title: "First Day of School", type: "milestone", emoji: "🎒", note: "Welcome back, students!" },
      { start: "2026-09-07", title: "Labor Day", type: "holiday", emoji: "🛠️", note: "No school" },
      { start: "2026-09-18", title: "Early Release Day", type: "early", emoji: "⏰", note: "½ day for students" },
      { start: "2026-10-12", end: "2026-10-16", title: "Fall Break", type: "break", emoji: "🍂", note: "No school all week" },
      { start: "2026-11-06", title: "Early Release Day", type: "early", emoji: "⏰", note: "½ day for students" },
      { start: "2026-11-23", end: "2026-11-27", title: "Thanksgiving Break", type: "break", emoji: "🦃", note: "No school all week" },
      { start: "2026-12-21", end: "2027-01-05", title: "Winter Break", type: "break", emoji: "❄️", note: "Students return Wednesday, January 6" },
      { start: "2027-01-18", title: "Martin Luther King Jr. Day", type: "holiday", emoji: "🕊️", note: "No school" },
      { start: "2027-02-15", title: "Presidents' Day", type: "holiday", emoji: "🇺🇸", note: "No school" },
      { start: "2027-02-16", title: "Student Holiday / Teacher In-Service", type: "inservice", emoji: "🍎", note: "No school for students" },
      { start: "2027-03-11", title: "Early Release Day", type: "early", emoji: "⏰", note: "½ day for students" },
      { start: "2027-03-12", title: "Student Holiday / Teacher In-Service", type: "inservice", emoji: "🍎", note: "No school for students" },
      { start: "2027-03-26", end: "2027-04-02", title: "Spring Break", type: "break", emoji: "🌸", note: "Students return Monday, April 5" },
      { start: "2027-05-25", title: "Last Day of School", type: "milestone", emoji: "🎓", note: "Early release — ½ day for students", early: true }
    ]
  },
  "2027-2028": {
    label: "2027 – 2028",
    first: "2027-08-06",
    last: "2028-05-23",
    pdf: "https://files.smartsites.parentsquare.com/13442/2027-2028_school_calendar_1.pdf",
    events: [
      { start: "2027-08-06", title: "First Day of School", type: "milestone", emoji: "🎒", note: "Welcome back, students!" },
      { start: "2027-09-06", title: "Labor Day", type: "holiday", emoji: "🛠️", note: "No school" },
      { start: "2027-09-17", title: "Early Release Day", type: "early", emoji: "⏰", note: "½ day for students" },
      { start: "2027-10-11", end: "2027-10-15", title: "Fall Break", type: "break", emoji: "🍂", note: "No school all week" },
      { start: "2027-11-05", title: "Early Release Day", type: "early", emoji: "⏰", note: "½ day for students" },
      { start: "2027-11-22", end: "2027-11-26", title: "Thanksgiving Break", type: "break", emoji: "🦃", note: "No school all week" },
      { start: "2027-12-20", end: "2028-01-04", title: "Winter Break", type: "break", emoji: "❄️", note: "Students return Wednesday, January 5" },
      { start: "2028-01-17", title: "Martin Luther King Jr. Day", type: "holiday", emoji: "🕊️", note: "No school" },
      { start: "2028-02-18", title: "Student Holiday / Teacher In-Service", type: "inservice", emoji: "🍎", note: "No school for students" },
      { start: "2028-02-21", title: "Presidents' Day", type: "holiday", emoji: "🇺🇸", note: "No school" },
      { start: "2028-03-16", title: "Early Release Day", type: "early", emoji: "⏰", note: "½ day for students" },
      { start: "2028-03-17", title: "Student Holiday / Teacher In-Service", type: "inservice", emoji: "🍎", note: "No school for students" },
      { start: "2028-04-03", end: "2028-04-07", title: "Spring Break", type: "break", emoji: "🌸", note: "No school all week" },
      { start: "2028-04-14", title: "Student Holiday", type: "holiday", emoji: "🌷", note: "No school" },
      { start: "2028-05-23", title: "Last Day of School", type: "milestone", emoji: "🎓", note: "Early release — ½ day for students", early: true }
    ]
  }
};
