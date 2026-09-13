export type CronFields = { minute: number[]; hour: number[]; day: number[]; month: number[]; weekday: number[] };

function expand(field: string, min: number, max: number): number[] {
  const out = new Set<number>();
  for (const raw of field.split(",")) {
    const [rangePart, stepPart] = raw.split("/");
    const step = stepPart ? Number(stepPart) : 1;
    if (!Number.isInteger(step) || step < 1) throw new Error("invalid_cron_step");
    const [aRaw, bRaw] = rangePart === "*" ? [String(min), String(max)] : rangePart.split("-");
    const a = aRaw === "*" ? min : Number(aRaw);
    const b = bRaw == null ? a : Number(bRaw);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < min || b > max || a > b) throw new Error("invalid_cron_range");
    for (let n = a; n <= b; n += step) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

export function parseCron5(schedule: string): CronFields {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error("cron_requires_five_fields");
  return {
    minute: expand(fields[0], 0, 59),
    hour: expand(fields[1], 0, 23),
    day: expand(fields[2], 1, 31),
    month: expand(fields[3], 1, 12),
    weekday: expand(fields[4], 0, 6),
  };
}

function zonedParts(date: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    }).formatToParts(date);
  } catch {
    throw new Error("invalid_cron_timezone");
  }
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minute: Number(values.minute),
    hour: Number(values.hour),
    day: Number(values.day),
    month: Number(values.month),
    weekday: weekdayMap[String(values.weekday)],
  };
}

export function matchesCron(schedule: string, date: Date, timeZone = "UTC"): boolean {
  const c = parseCron5(schedule);
  const local = zonedParts(date, timeZone);
  return c.minute.includes(local.minute) && c.hour.includes(local.hour) && c.month.includes(local.month) && c.day.includes(local.day) && c.weekday.includes(local.weekday);
}

export function nextCronRun(schedule: string, from = new Date(), timeZone = "UTC", maxMinutes = 366 * 24 * 60): Date | null {
  parseCron5(schedule);
  zonedParts(from, timeZone);
  const cursor = new Date(from);
  cursor.setUTCSeconds(0, 0);
  cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  for (let i = 0; i < maxMinutes; i++) {
    if (matchesCron(schedule, cursor, timeZone)) return new Date(cursor);
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
  }
  return null;
}
