export type CalendarJob = {
  id: string;
  number: string;
  name: string;
  status: string;
  startDate: Date;
  expectedCompletionDate: Date | null;
};

export function icsEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function icsDate(value: Date) {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function icsStamp(value: Date) {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, "0");
  const d = String(value.getUTCDate()).padStart(2, "0");
  const h = String(value.getUTCHours()).padStart(2, "0");
  const min = String(value.getUTCMinutes()).padStart(2, "0");
  const s = String(value.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

export function buildJobCalendarIcs(input: { companyName: string; jobs: CalendarJob[]; generatedAt?: Date }) {
  const now = input.generatedAt ?? new Date();
  const events = input.jobs
    .map((job) => {
      const start = icsDate(job.startDate);
      const endSource = job.expectedCompletionDate && job.expectedCompletionDate > job.startDate ? job.expectedCompletionDate : job.startDate;
      const end = new Date(endSource);
      end.setUTCDate(end.getUTCDate() + 1);
      return [
        "BEGIN:VEVENT",
        `UID:job-${job.id}@zonecam`,
        `DTSTAMP:${icsStamp(now)}`,
        `DTSTART;VALUE=DATE:${start}`,
        `DTEND;VALUE=DATE:${icsDate(end)}`,
        `SUMMARY:${icsEscape(`${job.number} ${job.name}`)}`,
        `DESCRIPTION:${icsEscape(`Status: ${job.status}`)}`,
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ZoneCam//Job Calendar//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(`${input.companyName} jobs`)}`,
    events,
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}
