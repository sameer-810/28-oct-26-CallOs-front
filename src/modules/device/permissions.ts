import { PermissionsAndroid, Platform } from "react-native";

export type PermissionGroup = "callLog" | "recordings" | "contacts" | "notifications" | "callPhone";

/**
 * The Android permissions behind each checklist item. Built on use, not at
 * import: PermissionsAndroid doesn't exist on the web.
 */
function groupPermissions(g: PermissionGroup) {
  const P = PermissionsAndroid.PERMISSIONS;
  const v = Number(Platform.Version);
  switch (g) {
    case "callLog":
      return [P.READ_CALL_LOG, P.READ_PHONE_STATE, P.READ_PHONE_NUMBERS];
    case "recordings":
      return [v >= 33 ? P.READ_MEDIA_AUDIO : P.READ_EXTERNAL_STORAGE];
    case "contacts":
      return [P.READ_CONTACTS];
    case "notifications":
      return v >= 33 ? [P.POST_NOTIFICATIONS] : [];
    case "callPhone":
      return [P.CALL_PHONE];
  }
}

/** Asks for the groups; true when every permission in them was granted. */
export async function askPermissions(groups: PermissionGroup[]) {
  if (Platform.OS !== "android") return false;
  const perms = groups.flatMap(groupPermissions).filter(Boolean);
  if (perms.length === 0) return true;
  const result = await PermissionsAndroid.requestMultiple(perms);
  return perms.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

