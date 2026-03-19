export async function encryptBlob(data) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(data))));
}

export async function decryptBlob(data) {
  return JSON.parse(decodeURIComponent(escape(atob(data))));
}
