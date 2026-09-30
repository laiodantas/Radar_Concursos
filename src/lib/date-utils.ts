const timeZone = "America/Sao_Paulo";
export function calendarDay(value: Date | string): string {
  // Uma data civil já representa o dia local; não a interprete como meia-noite UTC.
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}
export function daysRemaining(end: Date | string, now: Date | string = new Date()): number {
  const a = calendarDay(end).split("-").map(Number); const b = calendarDay(now).split("-").map(Number);
  return Math.round((Date.UTC(a[0], a[1]-1, a[2]) - Date.UTC(b[0], b[1]-1, b[2])) / 86_400_000);
}
