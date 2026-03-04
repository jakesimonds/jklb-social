// PDS Query utilities for fetching records directly from user PDSes
// Used for discovering non-Bluesky activity from chorus members
//
// Design: These are direct PDS queries (not relay/AppView). Each user's PDS
// is typically on a unique hostname, so we can parallelize freely.
// We only ever query ~30 people, so no rate limiting needed.

/** Per-request timeout — don't let a single slow PDS hang everything */
const REQUEST_TIMEOUT_MS = 10_000; // 10 seconds

/**
 * A resolved Player FM track with playable audio URL
 */
export interface PlayerFMTrack {
  uri: string;        // AT URI of the fm.plyr.track record
  title: string;
  artist: string;
  audioUrl: string;
  imageUrl?: string;
  album?: string;
  duration?: number;
}

/**
 * A record fetched from a PDS
 */
export interface PDSRecord {
  uri: string;
  cid: string;
  collection: string; // e.g., "blue.atmosphere.post", "com.whtwnd.blog.entry"
  createdAt: string;
  record: unknown;
}

/**
 * Fetch with a timeout — wraps native fetch with AbortController
 */
async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * DID Document structure (simplified for our needs)
 */
interface DIDDocument {
  id: string;
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
}

/**
 * Get a user's PDS URL from their DID document
 *
 * For did:plc DIDs, queries the PLC directory
 * For did:web DIDs, constructs the DID document URL
 *
 * @param did - The user's DID (did:plc:xxx or did:web:xxx)
 * @returns The PDS URL (e.g., "https://morel.us-east.host.bsky.network") or null if not found
 */
export async function getPdsUrl(did: string): Promise<string | null> {
  try {
    let didDocUrl: string;

    if (did.startsWith('did:plc:')) {
      didDocUrl = `https://plc.directory/${did}`;
    } else if (did.startsWith('did:web:')) {
      const domain = did.replace('did:web:', '');
      didDocUrl = `https://${domain}/.well-known/did.json`;
    } else {
      console.warn(`Unknown DID method: ${did}`);
      return null;
    }

    const response = await fetchWithTimeout(didDocUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch DID document for ${did}: ${response.status}`);
      return null;
    }

    const didDoc: DIDDocument = await response.json();

    const pdsService = didDoc.service?.find(
      (svc) => svc.id === '#atproto_pds' || svc.type === 'AtprotoPersonalDataServer'
    );

    if (!pdsService) {
      console.warn(`No PDS service found in DID document for ${did}`);
      return null;
    }

    return pdsService.serviceEndpoint;
  } catch (error) {
    // AbortError = timeout, don't spam console
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`Timeout resolving PDS URL for ${did}`);
      return null;
    }
    console.error(`Error resolving PDS URL for ${did}:`, error);
    return null;
  }
}

/**
 * Response from com.atproto.repo.listRecords
 */
interface ListRecordsResponse {
  cursor?: string;
  records: Array<{
    uri: string;
    cid: string;
    value: {
      $type?: string;
      createdAt?: string;
      [key: string]: unknown;
    };
  }>;
}

/**
 * Response from com.atproto.repo.describeRepo
 */
interface DescribeRepoResponse {
  handle: string;
  did: string;
  didDoc?: unknown;
  collections: string[];
  handleIsCorrect: boolean;
}

/**
 * Discover all collections a user has in their PDS using describeRepo
 *
 * @param pdsUrl - The user's PDS URL
 * @param did - The user's DID
 * @returns Array of collection NSIDs found in the user's repo
 */
export async function discoverCollections(
  pdsUrl: string,
  did: string
): Promise<string[]> {
  try {
    const url = `${pdsUrl}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.warn(`Failed to describe repo for ${did}: ${response.status}`);
      return [];
    }

    const data: DescribeRepoResponse = await response.json();
    return data.collections || [];
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`Timeout discovering collections for ${did}`);
      return [];
    }
    console.error(`Error discovering collections for ${did}:`, error);
    return [];
  }
}

/**
 * Filter collections to only include non-Bluesky user content
 * The atmosphere report shows what chorus members are doing OUTSIDE of Bluesky —
 * things published to their PDS via other ATProto apps (WhiteWind, Tangled, Grain, etc.)
 *
 * Simple rule: anything that's not app.bsky.* or chat.bsky.* is interesting.
 *
 * @param collections - Array of collection NSIDs from describeRepo
 * @returns Filtered array of non-Bluesky collections
 */
export function filterInterestingCollections(collections: string[]): string[] {
  return collections.filter((collection) =>
    !collection.startsWith('app.bsky.') && !collection.startsWith('chat.bsky.')
  );
}

/**
 * Fetch records from a single collection (single page, no pagination for atmosphere)
 */
async function fetchCollectionRecords(
  pdsUrl: string,
  did: string,
  collection: string,
  since: string,
  limit: number = 50
): Promise<PDSRecord[]> {
  const records: PDSRecord[] = [];

  // Single fetch — for atmosphere we only need recent records, no pagination needed
  const params = new URLSearchParams({
    repo: did,
    collection,
    limit: String(Math.min(limit, 100)),
  });

  const url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      // Collection might not exist for this user, that's OK
      return records;
    }

    const data: ListRecordsResponse = await response.json();

    for (const record of data.records) {
      const createdAt = record.value.createdAt || '';

      // Skip records without a valid createdAt — we can't verify they're recent
      if (!createdAt) {
        continue;
      }

      // Stop if we've gone past our 'since' timestamp
      if (createdAt < since) {
        break;
      }

      records.push({
        uri: record.uri,
        cid: record.cid,
        collection,
        createdAt,
        record: record.value,
      });

      if (records.length >= limit) {
        break;
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`Timeout fetching ${collection} from ${pdsUrl}`);
    } else {
      console.error(`Error fetching ${collection} from ${pdsUrl}:`, error);
    }
  }

  return records;
}

/**
 * Fetch all non-Bluesky records from a user's PDS since a timestamp
 *
 * Uses describeRepo to discover collections, filters to non-Bluesky ones,
 * then fetches records from each. All requests have 10-second timeouts.
 *
 * @param pdsUrl - The user's PDS URL
 * @param did - The user's DID
 * @param since - ISO timestamp to fetch records since
 * @returns Array of PDSRecord objects, sorted newest first
 */
export async function fetchRecentRecords(
  pdsUrl: string,
  did: string,
  since: string,
): Promise<PDSRecord[]> {
  // Discover collections, filter to non-Bluesky
  const allCollections = await discoverCollections(pdsUrl, did);
  const collectionsToQuery = filterInterestingCollections(allCollections);

  // For most Bluesky-only users this is empty — fast return
  if (collectionsToQuery.length === 0) {
    return [];
  }

  // Fetch all collections in parallel (they're on the same PDS, but separate endpoints)
  const results = await Promise.all(
    collectionsToQuery.map((collection) =>
      fetchCollectionRecords(pdsUrl, did, collection, since)
    )
  );

  const allRecords = results.flat();

  // Sort by createdAt (newest first)
  allRecords.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  return allRecords;
}

/**
 * Fetch a user's Player FM liked songs from their PDS
 *
 * Lists fm.plyr.like records and extracts the subject (track) references.
 * Returns empty array if the collection doesn't exist or the user has no likes.
 *
 * @param pdsUrl - The user's PDS URL
 * @param did - The user's DID
 * @param limit - Max number of likes to fetch (default 20)
 * @returns Array of { uri, cid } pointing to fm.plyr.track records
 */
export async function fetchPlayerFMLikes(
  pdsUrl: string,
  did: string,
  limit: number = 20
): Promise<{ uri: string; cid: string }[]> {
  try {
    const params = new URLSearchParams({
      repo: did,
      collection: 'fm.plyr.like',
      limit: String(limit),
    });
    const url = `${pdsUrl}/xrpc/com.atproto.repo.listRecords?${params}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return [];
    }

    const data: ListRecordsResponse = await response.json();

    return data.records
      .map((record) => {
        const subject = record.value.subject as { uri?: string; cid?: string } | undefined;
        if (!subject?.uri || !subject?.cid) return null;
        return { uri: subject.uri, cid: subject.cid };
      })
      .filter((item): item is { uri: string; cid: string } => item !== null);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`Timeout fetching Player FM likes for ${did}`);
    } else {
      console.error(`Error fetching Player FM likes for ${did}:`, error);
    }
    return [];
  }
}

/**
 * Resolve a Player FM track from its AT URI
 *
 * Two network hops: parse DID from URI → getPdsUrl() → fetch track record.
 * Returns null on any failure (PDS unreachable, record deleted, missing audioUrl).
 *
 * @param subjectUri - AT URI of the fm.plyr.track record (e.g. at://did:plc:xxx/fm.plyr.track/rkey)
 * @returns Resolved track with audio URL, or null on failure
 */
export async function resolveTrack(subjectUri: string): Promise<PlayerFMTrack | null> {
  try {
    // Parse DID and rkey from AT URI: at://did:plc:xxx/fm.plyr.track/rkey
    const match = subjectUri.match(/^at:\/\/(did:[^/]+)\/fm\.plyr\.track\/(.+)$/);
    if (!match) {
      console.warn(`Invalid fm.plyr.track URI: ${subjectUri}`);
      return null;
    }
    const [, did, rkey] = match;

    // Resolve the track author's PDS
    const pdsUrl = await getPdsUrl(did);
    if (!pdsUrl) return null;

    // Fetch the track record
    const params = new URLSearchParams({
      repo: did,
      collection: 'fm.plyr.track',
      rkey,
    });
    const url = `${pdsUrl}/xrpc/com.atproto.repo.getRecord?${params}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) return null;

    const data = await response.json();
    const value = data.value as Record<string, unknown>;

    // audioUrl is required — skip tracks without it
    if (typeof value.audioUrl !== 'string' || !value.audioUrl) return null;

    return {
      uri: subjectUri,
      title: typeof value.title === 'string' ? value.title : 'Unknown',
      artist: typeof value.artist === 'string' ? value.artist : 'Unknown',
      audioUrl: value.audioUrl,
      imageUrl: typeof value.imageUrl === 'string' ? value.imageUrl : undefined,
      album: typeof value.album === 'string' ? value.album : undefined,
      duration: typeof value.duration === 'number' ? value.duration : undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.warn(`Timeout resolving track: ${subjectUri}`);
    } else {
      console.error(`Error resolving track: ${subjectUri}`, error);
    }
    return null;
  }
}
