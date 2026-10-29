const timeZone = "Asia/Hong_Kong";

function calendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getVisitDates(now = new Date()) {
  const base = new Date(`${calendarDate(now)}T12:00:00+08:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base.getTime() + (index + 1) * 86400000);
    return {
      value: calendarDate(date),
      label: new Intl.DateTimeFormat("zh-CN", {
        timeZone,
        month: "numeric",
        day: "numeric",
      }).format(date),
      weekday:
        index === 0
          ? "明天"
          : new Intl.DateTimeFormat("zh-CN", {
              timeZone,
              weekday: "short",
            }).format(date),
    };
  });
}

export function isAvailableVisitDate(value: string, now = new Date()): boolean {
  return getVisitDates(now).some((item) => item.value === value);
}
