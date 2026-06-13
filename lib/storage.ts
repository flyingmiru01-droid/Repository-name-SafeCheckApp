import * as FileSystem from "expo-file-system/legacy";

export async function uploadImageAsync(uri: string, folder: string) {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return `data:image/jpeg;base64,${base64}`;
}
