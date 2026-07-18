export async function getCoverArt(releaseId) {
  if (!releaseId) return null;

  try {
    const res = await fetch(`https://coverartarchive.org/release/${releaseId}`);
    if (!res.ok) return null;

    const data = await res.json();
    const front = data.images?.find((img) => img.front) ?? data.images?.[0];
    return front?.thumbnails?.["250"] ?? front?.image ?? null;
  } catch {
    return null;
  }
}