/**
 * EXPO_PUBLIC_* values are inlined at export time, so they must be set in the
 * build environment. Nothing secret belongs here: everything ships in the app.
 */
const DEV_API = process.env.EXPO_PUBLIC_API_URL_DEV || "http://localhost:5020/api/v1";
const PROD_API = process.env.EXPO_PUBLIC_API_URL || DEV_API;

export const environment = {
  apiUrl: __DEV__ ? DEV_API : PROD_API,
  isDev: __DEV__,
  // working brand — keep in step with landing/src/config.ts and app.json "name"
  appName: "Ringwise",
  /** Help & Support. A blank one hides its button; "Send log file" always works (logs go to the API). */
  supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL || "",
  /** Digits with country code, e.g. 919800000000. */
  supportWhatsApp: process.env.EXPO_PUBLIC_SUPPORT_WHATSAPP || "",
  websiteUrl: process.env.EXPO_PUBLIC_WEBSITE_URL || "https://oscall28octfront.vercel.app",
} as const;
