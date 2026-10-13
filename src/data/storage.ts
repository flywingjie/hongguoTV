import AsyncStorage from "@react-native-async-storage/async-storage";
import { Library, Settings } from "../domain/model";
const empty: Library = { favorites: [], progress: {} };
let pending = Promise.resolve();
export async function loadState(): Promise<{
  settings: Settings;
  library: Library;
}> {
  const rows = await AsyncStorage.multiGet(["settings.v1", "library.v1"]);
  let settings: Settings = { baseUrl: "", token: "" };
  let library = empty;
  try {
    const data = JSON.parse(rows[0][1] || "{}");
    if (typeof data.baseUrl === "string")
      settings = {
        baseUrl: data.baseUrl,
        token: typeof data.token === "string" ? data.token : "",
      };
  } catch {}
  try {
    const data = JSON.parse(rows[1][1] || "{}");
    if (
      Array.isArray(data.favorites) &&
      data.progress &&
      typeof data.progress === "object"
    )
      library = data;
  } catch {}
  return { settings, library };
}
// Serialize disk writes so a delayed progress write cannot overwrite a newer episode.
export function saveLibrary(library: Library) {
  const value = JSON.stringify(library);
  pending = pending
    .catch(() => {})
    .then(() => AsyncStorage.setItem("library.v1", value));
  return pending;
}
export function saveSettings(settings: Settings) {
  return AsyncStorage.setItem("settings.v1", JSON.stringify(settings));
}
