/**
 * Returns today's date as a local-time YYYY-MM-DD string.
 * Using local date (not UTC) ensures the date matches the user's calendar day,
 * e.g. 23:30 in UTC+2 is still "today" locally but would be "yesterday" in UTC.
 */
export function getTodayDateString() {
  const d = new Date()
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}
