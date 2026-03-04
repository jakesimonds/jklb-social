// Embed transformation utilities
// Copied from src/lib/embed-utils.ts — pure TypeScript, 100% portable
// Shared between feed.ts and thread.ts to avoid code duplication

import type { PostEmbed, PostImage, PostVideo, PostExternal, PostAuthor, QuotedPost } from './types';

/**
 * Extract link URIs from ATproto richtext facets.
 * Facets contain the actual resolved URLs (not truncated display text).
 */
export function extractLinkFacets(facets: unknown): string[] {
  if (!Array.isArray(facets)) return [];
  const urls: string[] = [];
  for (const facet of facets) {
    const f = facet as { features?: Array<{ $type?: string; uri?: string }> };
    if (!Array.isArray(f.features)) continue;
    for (const feature of f.features) {
      if (feature.$type === 'app.bsky.richtext.facet#link' && feature.uri) {
        urls.push(feature.uri);
      }
    }
  }
  return urls;
}

/**
 * Transform an API embed to our PostEmbed type
 * Handles images, video, external links, records (quotes), and recordWithMedia
 */
export function transformEmbed(apiEmbed: unknown): PostEmbed | undefined {
  if (!apiEmbed || typeof apiEmbed !== 'object') return undefined;

  const embed = apiEmbed as { $type?: string; [key: string]: unknown };
  const type = embed.$type;

  // Images embed
  if (type === 'app.bsky.embed.images#view') {
    const imagesEmbed = embed as {
      images?: Array<{
        thumb?: string;
        fullsize?: string;
        alt?: string;
        aspectRatio?: { width: number; height: number };
      }>;
    };
    if (imagesEmbed.images && Array.isArray(imagesEmbed.images)) {
      const images: PostImage[] = imagesEmbed.images.map((img) => ({
        thumb: img.thumb || '',
        fullsize: img.fullsize || '',
        alt: img.alt || '',
        aspectRatio: img.aspectRatio,
      }));
      return { type: 'images', images };
    }
  }

  // Video embed
  if (type === 'app.bsky.embed.video#view') {
    const videoEmbed = embed as {
      playlist?: string;
      thumbnail?: string;
      aspectRatio?: { width: number; height: number };
    };
    if (videoEmbed.playlist) {
      const video: PostVideo = {
        playlist: videoEmbed.playlist,
        thumbnail: videoEmbed.thumbnail,
        aspectRatio: videoEmbed.aspectRatio,
      };
      return { type: 'video', video };
    }
  }

  // External link embed
  if (type === 'app.bsky.embed.external#view') {
    const externalEmbed = embed as {
      external?: {
        uri?: string;
        title?: string;
        description?: string;
        thumb?: string;
      };
    };
    if (externalEmbed.external) {
      const external: PostExternal = {
        uri: externalEmbed.external.uri || '',
        title: externalEmbed.external.title || '',
        description: externalEmbed.external.description || '',
        thumb: externalEmbed.external.thumb,
      };
      return { type: 'external', external };
    }
  }

  // Record embed (quote post)
  if (type === 'app.bsky.embed.record#view') {
    const recordEmbed = embed as {
      record?: {
        $type?: string;
        uri?: string;
        cid?: string;
        author?: {
          did?: string;
          handle?: string;
          displayName?: string;
          avatar?: string;
        };
        value?: { text?: string; facets?: unknown };
        indexedAt?: string;
        embeds?: unknown[];
      };
    };
    // Only handle viewRecord type (actual quoted posts)
    if (recordEmbed.record && recordEmbed.record.$type === 'app.bsky.embed.record#viewRecord') {
      const rec = recordEmbed.record;
      const author: PostAuthor = {
        did: rec.author?.did || '',
        handle: rec.author?.handle || '',
        displayName: rec.author?.displayName,
        avatar: rec.author?.avatar,
      };

      // Extract media from the quoted post's embeds
      let quotedImages: PostImage[] | undefined;
      let quotedVideo: PostVideo | undefined;
      let quotedExternal: PostExternal | undefined;
      if (rec.embeds && Array.isArray(rec.embeds)) {
        for (const quotedEmbed of rec.embeds) {
          const transformedEmbed = transformEmbed(quotedEmbed);
          if (transformedEmbed?.images) {
            quotedImages = transformedEmbed.images;
          }
          if (transformedEmbed?.video) {
            quotedVideo = transformedEmbed.video;
          }
          if (transformedEmbed?.external) {
            quotedExternal = transformedEmbed.external;
          }
        }
      }

      const linkFacets = extractLinkFacets(rec.value?.facets);
      const quotedPost: QuotedPost = {
        uri: rec.uri || '',
        cid: rec.cid || '',
        author,
        text: rec.value?.text || '',
        indexedAt: rec.indexedAt || '',
        images: quotedImages,
        video: quotedVideo,
        external: quotedExternal,
        ...(linkFacets.length > 0 ? { linkFacets } : {}),
      };
      return { type: 'record', record: quotedPost };
    }
  }

  // Record with media embed (quote + images/video)
  if (type === 'app.bsky.embed.recordWithMedia#view') {
    const rwmEmbed = embed as {
      record?: { record?: unknown };
      media?: unknown;
    };
    // Extract the quoted record
    let quotedPost: QuotedPost | undefined;
    if (rwmEmbed.record?.record) {
      const rec = rwmEmbed.record.record as {
        $type?: string;
        uri?: string;
        cid?: string;
        author?: {
          did?: string;
          handle?: string;
          displayName?: string;
          avatar?: string;
        };
        value?: { text?: string; facets?: unknown };
        indexedAt?: string;
        embeds?: unknown[];
      };
      if (rec.$type === 'app.bsky.embed.record#viewRecord') {
        const author: PostAuthor = {
          did: rec.author?.did || '',
          handle: rec.author?.handle || '',
          displayName: rec.author?.displayName,
          avatar: rec.author?.avatar,
        };

        // Extract media from the quoted post's embeds
        let quotedImages: PostImage[] | undefined;
        let quotedVideo: PostVideo | undefined;
        let quotedExternal: PostExternal | undefined;
        if (rec.embeds && Array.isArray(rec.embeds)) {
          for (const quotedEmbed of rec.embeds) {
            const transformedEmbed = transformEmbed(quotedEmbed);
            if (transformedEmbed?.images) {
              quotedImages = transformedEmbed.images;
            }
            if (transformedEmbed?.video) {
              quotedVideo = transformedEmbed.video;
            }
            if (transformedEmbed?.external) {
              quotedExternal = transformedEmbed.external;
            }
          }
        }

        const linkFacets = extractLinkFacets(rec.value?.facets);
        quotedPost = {
          uri: rec.uri || '',
          cid: rec.cid || '',
          author,
          text: rec.value?.text || '',
          indexedAt: rec.indexedAt || '',
          images: quotedImages,
          video: quotedVideo,
          external: quotedExternal,
          ...(linkFacets.length > 0 ? { linkFacets } : {}),
        };
      }
    }
    // Extract media (images or video) from the main post
    const mediaEmbed = transformEmbed(rwmEmbed.media);
    return {
      type: 'recordWithMedia',
      record: quotedPost,
      images: mediaEmbed?.images,
      video: mediaEmbed?.video,
    };
  }

  return undefined;
}
