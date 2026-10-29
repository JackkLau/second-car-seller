import assert from "node:assert/strict";
import test from "node:test";
import { getVisitDates, isAvailableVisitDate } from "./appointmentDates.ts";

test("appointment dates use the next seven Hong Kong calendar days", () => {
  const dates = getVisitDates(new Date("2026-10-29T16:01:00Z"));
  assert.equal(dates.length, 7);
  assert.equal(dates[0].value, "2026-10-31");
  assert.equal(dates[6].value, "2026-11-06");
});

test("a previously selectable date is rejected after the calendar moves on", () => {
  const firstVisitDate = getVisitDates(new Date("2026-10-29T23:59:00+08:00"))[0]
    .value;
  assert.equal(firstVisitDate, "2026-10-30");
  assert.equal(
    isAvailableVisitDate(firstVisitDate, new Date("2026-10-31T10:00:00+08:00")),
    false,
  );
  assert.equal(
    isAvailableVisitDate("2026-11-01", new Date("2026-10-31T10:00:00+08:00")),
    true,
  );
});

test("dates cross year boundaries and reject today, malformed or distant values", () => {
  const now = new Date("2026-12-31T23:59:00+08:00");
  assert.equal(getVisitDates(now)[0].value, "2027-01-01");
  assert.equal(getVisitDates(now)[6].value, "2027-01-07");
  for (const value of ["", "2026-12-31", "2027-01-08", "2027-1-1"]) {
    assert.equal(isAvailableVisitDate(value, now), false);
  }
});
