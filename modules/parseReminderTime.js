const chrono = require("chrono-node");
const moment = require("moment-timezone");

/**
 * Parse a natural-language reminder time in an IANA timezone.
 * Wall-clock times use the zone's offset on that date (DST-aware).
 * Relative durations such as "in 10 minutes" stay anchored to the instant.
 */
function parseReminderTime(when, { timezone = "America/New_York", now = new Date() } = {}) {
  const nowDate = now instanceof Date ? now : new Date(now);
  const nowInTz = moment.tz(nowDate, timezone);

  const results = chrono.parse(
    when,
    {
      instant: nowDate,
      timezone: nowInTz.utcOffset(),
    },
    { forwardDate: true }
  );

  const parsed = results[0];
  if (!parsed) return null;

  const start = parsed.start;
  // Relative durations and explicit zones ("12am EST") already resolve to an instant.
  if (start.isCertain("timezoneOffset") && start.isCertain("hour")) {
    return start.date();
  }

  return moment
    .tz(
      {
        year: start.get("year"),
        month: start.get("month") - 1,
        day: start.get("day"),
        hour: start.get("hour") ?? 0,
        minute: start.get("minute") ?? 0,
        second: start.get("second") ?? 0,
      },
      timezone
    )
    .toDate();
}

module.exports = { parseReminderTime };
