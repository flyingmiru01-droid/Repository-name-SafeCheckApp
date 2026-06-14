import * as FileSystem from "expo-file-system";

const STORAGE_BUCKET = "safecheck-89b25.firebasestorage.app";

export async function uploadImageAsync(uri: string, folder: string) {
  const filename = `${folder}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.jpg`;

  const uploadUrl =
    `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o` +
    `?uploadType=media&name=${encodeURIComponent(filename)}`;

  const result = await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      "Content-Type": "image/jpeg",
    },
  });

  console.log("Storage upload result", result.status, result.body);

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Storage upload failed: ${result.status} ${result.body}`);
  }

  const data = JSON.parse(result.body);
  const token = data.downloadTokens;

  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${encodeURIComponent(
    filename
  )}?alt=media&token=${token}`;
}
