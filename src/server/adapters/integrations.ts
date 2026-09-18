import { AppError } from "@/server/http";
import { randomToken, sha256 } from "@/server/crypto";
import { getEnv } from "@/lib/env";

export type IntegrationProviderKey = "quickbooks" | "jobber" | "servicetitan" | "google" | "email" | "calendar";

export type IntegrationConnectResult = {
  settings: Record<string, unknown>;
  credentialPlain?: string;
  reveal?: { feedUrl?: string };
  log: string;
};

export interface IntegrationConnector {
  readonly key: IntegrationProviderKey;
  readonly name: string;
  readonly description: string;
  readonly available: boolean;
  connect(): IntegrationConnectResult;
  syncHint(): string;
}

class UnconfiguredConnector implements IntegrationConnector {
  readonly available = false;
  constructor(
    readonly key: IntegrationProviderKey,
    readonly name: string,
    readonly description: string,
  ) {}
  connect(): never {
    throw new AppError(400, `${this.name} is not connected yet. ZoneCam does not pretend this vendor is live.`);
  }
  syncHint() {
    return `${this.name} stays unconnected until a real vendor adapter exists.`;
  }
}

class ConsoleEmailConnector implements IntegrationConnector {
  readonly key = "email" as const;
  readonly name = "Email";
  readonly description = "Uses the console mail adapter already running in this environment. SMTP providers can replace it later.";
  readonly available = true;
  connect() {
    return {
      settings: { driver: getEnv().EMAIL_DRIVER },
      credentialPlain: JSON.stringify({ driver: getEnv().EMAIL_DRIVER, connectedAt: new Date().toISOString() }),
      log: `Email connected via ${getEnv().EMAIL_DRIVER} driver.`,
    };
  }
  syncHint() {
    return "Sends a test message through the configured mail adapter.";
  }
}

class InternalCalendarConnector implements IntegrationConnector {
  readonly key = "calendar" as const;
  readonly name = "Calendar";
  readonly description = "Publishes dated jobs as an iCalendar feed. Google Calendar OAuth is a separate connector and is not live.";
  readonly available = true;
  connect() {
    const token = randomToken(24);
    return {
      settings: { feedTokenHash: sha256(token), includeCompleted: true },
      credentialPlain: JSON.stringify({ kind: "ics-feed" }),
      reveal: { feedUrl: `${getEnv().APP_URL}/share/c/${token}` },
      log: "Calendar feed created from job start dates.",
    };
  }
  syncHint() {
    return "Rebuilds the job calendar feed from current project dates.";
  }
}

const CONNECTORS: Record<IntegrationProviderKey, IntegrationConnector> = {
  quickbooks: new UnconfiguredConnector("quickbooks", "QuickBooks", "Accounting sync is not implemented."),
  jobber: new UnconfiguredConnector("jobber", "Jobber", "Jobber sync is not implemented."),
  servicetitan: new UnconfiguredConnector("servicetitan", "ServiceTitan", "ServiceTitan sync is not implemented."),
  google: new UnconfiguredConnector("google", "Google", "Google account OAuth is not implemented."),
  email: new ConsoleEmailConnector(),
  calendar: new InternalCalendarConnector(),
};

export const INTEGRATION_PROVIDER_KEYS = Object.keys(CONNECTORS) as IntegrationProviderKey[];

export function getIntegrationConnector(key: string): IntegrationConnector {
  const connector = CONNECTORS[key as IntegrationProviderKey];
  if (!connector) throw new AppError(404, "Unknown integration.");
  return connector;
}

export function listIntegrationConnectors() {
  return INTEGRATION_PROVIDER_KEYS.map((key) => CONNECTORS[key]);
}
