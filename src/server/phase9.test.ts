import { describe, expect, it } from "vitest";
import { AppError } from "./http";
import { getIntegrationConnector, listIntegrationConnectors } from "./adapters/integrations";
import { buildJobCalendarIcs, icsEscape } from "./integrations/ics";

describe("integration catalog", () => {
  it("lists the spec providers and does not fake vendor connections", () => {
    const keys = listIntegrationConnectors().map((item) => item.key);
    expect(keys).toEqual(["quickbooks", "jobber", "servicetitan", "google", "email", "calendar"]);
    expect(getIntegrationConnector("quickbooks").available).toBe(false);
    expect(getIntegrationConnector("email").available).toBe(true);
    expect(getIntegrationConnector("calendar").available).toBe(true);
    expect(() => getIntegrationConnector("quickbooks").connect()).toThrow(AppError);
  });
});

describe("job calendar ics", () => {
  it("escapes text and includes dated jobs", () => {
    expect(icsEscape("Roof, north; line")).toBe("Roof\\, north\\; line");
    const ics = buildJobCalendarIcs({
      companyName: "Harbor Roofing",
      generatedAt: new Date("2026-09-17T21:00:00Z"),
      jobs: [
        {
          id: "job1",
          number: "JOB-0001",
          name: "Phase 4 job",
          status: "Completed",
          startDate: new Date("2026-09-17T12:00:00Z"),
          expectedCompletionDate: null,
        },
      ],
    });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:JOB-0001 Phase 4 job");
    expect(ics).toContain("UID:job-job1@zonecam");
    expect(ics).toContain("DTSTART;VALUE=DATE:20260917");
    expect(ics).toContain("Harbor Roofing jobs");
  });
});
