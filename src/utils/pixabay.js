export async function searchPixabayImages(query) {
  const key = import.meta.env.VITE_PIXABAY_API_KEY;
  if (!key) {
    throw new Error("Missing VITE_PIXABAY_API_KEY");
  }
  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query || "community");
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("safesearch", "true");
  url.searchParams.set("per_page", "24");
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Pixabay request failed (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data?.hits) ? data.hits.map((item) => ({
    id: String(item.id),
    name: item.tags || `Pixabay ${item.id}`,
    previewUrl: item.webformatURL || item.previewURL,
    fullUrl: item.largeImageURL || item.webformatURL || item.previewURL,
    width: item.imageWidth || 1600,
    height: item.imageHeight || 900,
    tags: item.tags || "",
  })) : [];
}
