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
} as const;
