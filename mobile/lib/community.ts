// Community photo posting helper
// Posts photos to jklb.social community account via CF Pages Function

const COMMUNITY_POST_URL = 'https://jklb.social/api/community-post';

export async function postToCommunity(
  imageUri: string,
  caption: string,
  userHandle: string,
  dimensions?: { width: number; height: number } | null,
  includeUsername: boolean = true,
): Promise<{ ok: boolean; uri?: string; error?: string }> {
  const formData = new FormData();
  // React Native FormData accepts { uri, type, name } objects for file fields
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'photo.jpg',
  } as unknown as Blob);
  formData.append('caption', caption);
  formData.append('userHandle', userHandle);
  formData.append('includeUsername', String(includeUsername));
  if (dimensions) {
    formData.append('imageWidth', String(dimensions.width));
    formData.append('imageHeight', String(dimensions.height));
  }

  console.log('[COMMUNITY] Posting to', COMMUNITY_POST_URL);
  console.log('[COMMUNITY] caption:', caption, 'handle:', userHandle);

  const res = await fetch(COMMUNITY_POST_URL, {
    method: 'POST',
    body: formData,
    // Don't set Content-Type — fetch sets it with the correct multipart boundary
  });

  console.log('[COMMUNITY] Response status:', res.status);
  const text = await res.text();
  console.log('[COMMUNITY] Response body:', text.slice(0, 500));

  if (!res.ok) {
    try {
      const errData = JSON.parse(text) as { error?: string };
      return { ok: false, error: errData.error || `HTTP ${res.status}` };
    } catch {
      return { ok: false, error: `HTTP ${res.status}: ${text.slice(0, 100)}` };
    }
  }

  try {
    return JSON.parse(text) as { ok: boolean; uri?: string };
  } catch {
    return { ok: false, error: 'Invalid JSON response' };
  }
}
