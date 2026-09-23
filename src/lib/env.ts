import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z
    .string()
    .min(16)
    .refine((value) => process.env.NODE_ENV !== "production" || value.length >= 32, {
      message: "AUTH_SECRET must be at least 32 characters in production.",
    })
    .refine((value) => process.env.NODE_ENV !== "production" || !value.startsWith("dev-only"), {
      message: "Replace the development AUTH_SECRET before production.",
    }),
  APP_URL: z.string().url().default("http://localhost:3001"),
  STORAGE_DRIVER: z.enum(["local", "s3", "azure", "r2"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  MEDIA_MAX_BYTES: z.coerce.number().default(80 * 1024 * 1024),
  EMAIL_DRIVER: z.enum(["console"]).default("console"),
  JOBS_DRIVER: z.enum(["inline"]).default("inline"),
  AI_DRIVER: z.enum(["none", "internal"]).default("internal"),
  PAYMENTS_DRIVER: z.enum(["none", "internal"]).default("internal"),
  SEARCH_DRIVER: z.enum(["sql"]).default("sql"),
  REALTIME_DRIVER: z.enum(["memory"]).default("memory"),
  TRUST_CLOUDFLARE: z
    .enum(["true", "false", "1", "0", ""])
    .optional()
    .transform((value) => value === "true" || value === "1"),
  R2_ACCOUNT_ID: z.string().optional().default(""),
  R2_BUCKET: z.string().optional().default(""),
  R2_ACCESS_KEY_ID: z.string().optional().default(""),
  R2_SECRET_ACCESS_KEY: z.string().optional().default(""),
  R2_ENDPOINT: z.string().optional().default(""),
});

export type AppEnv = z.infer<typeof schema>;

/** Public company signup. Closed unless OPEN_REGISTRATION is exactly true. Never enable this on the production server. */
export function openRegistrationEnabled() {
  const flag = process.env.OPEN_REGISTRATION?.trim().toLowerCase();
  return flag === "true" || flag === "1";
}

export function getEnv(): AppEnv {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  return parsed.data;
}
