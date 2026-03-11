// Sparse claim page — standalone (no React)
// Reads ?nomination=at://... param, fetches record, lets winner claim their award.

import {
  BrowserOAuthClient,
  atprotoLoopbackClientMetadata,
} from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';

// ── Types ──────────────────────────────────────────────────

/** Shape of the nomination record stored on the giver's PDS */
interface NominationRecord {
  $type: string;
  subject: string;      // AT URI of the nominated post
  recipient: string;    // DID of the winner
  exitPost?: string;    // AT URI of the announcement post
  postsViewed?: number;
  createdAt: string;
}

// ── OAuth client ───────────────────────────────────────────

let oauthClient: BrowserOAuthClient | null = null;
let currentAgent: Agent | null = null;
let currentDid: string | null = null;
let currentHandle: string | null = null;

function isLoopback(): boolean {
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function buildLocalhostClientId(): string {
  const { port } = window.location;
  const redirectUri = `http://127.0.0.1:${port}/claimAward/`;
  const scope = 'atproto transition:generic';
  return `http://localhost?redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
}

async function getOAuthClient(): Promise<BrowserOAuthClient> {
  if (oauthClient) return oauthClient;

  if (isLoopback()) {
    const clientId = buildLocalhostClientId();
    const metadata = atprotoLoopbackClientMetadata(clientId);
    oauthClient = new BrowserOAuthClient({
      handleResolver: 'https://bsky.social',
      clientMetadata: metadata,
    });
  } else {
    const clientId = `${window.location.origin}/oauth-client-metadata.json`;
    oauthClient = await BrowserOAuthClient.load({
      clientId,
      handleResolver: 'https://bsky.social',
    });
  }

  return oauthClient;
}

// ── DOM references ─────────────────────────────────────────

const stateLoading = document.getElementById('stateLoading') as HTMLDivElement;
const stateError = document.getElementById('stateError') as HTMLDivElement;
const stateNomination = document.getElementById('stateNomination') as HTMLDivElement;
const stateSuccess = document.getElementById('stateSuccess') as HTMLDivElement;
const nominationText = document.getElementById('nominationText') as HTMLParagraphElement;
const postLink = document.getElementById('postLink') as HTMLAnchorElement;
const nomDate = document.getElementById('nomDate') as HTMLDivElement;
const claimBtn = document.getElementById('claimBtn') as HTMLButtonElement;
const authBar = document.getElementById('authBar') as HTMLDivElement;
const authHandle = document.getElementById('authHandle') as HTMLSpanElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;

// ── State ──────────────────────────────────────────────────

let nominationUri: string | null = null;
let nominationRecord: NominationRecord | null = null;
let awarderDid: string | null = null;
let awarderHandle: string | null = null;

// ── UI helpers ─────────────────────────────────────────────

function showState(el: HTMLElement) {
  stateLoading.classList.add('hidden');
  stateError.classList.add('hidden');
  stateNomination.classList.add('hidden');
  stateSuccess.classList.add('hidden');
  el.classList.remove('hidden');
}

function showError(msg: string) {
  stateError.innerHTML = '<p>' + escapeHtml(msg) + '</p>';
  showState(stateError);
}

function showAuthBar(handle: string) {
  authHandle.textContent = '@' + handle;
  authBar.classList.remove('hidden');
}

function hideAuthBar() {
  authBar.classList.add('hidden');
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function atUriToBskyUrl(atUri: string): string {
  if (!atUri) return '#';
  const parts = atUri.replace('at://', '').split('/');
  if (parts.length < 3) return '#';
  return 'https://bsky.app/profile/' + encodeURIComponent(parts[0]) + '/post/' + encodeURIComponent(parts[2]);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// ── Parse AT URI ───────────────────────────────────────────

function parseAtUri(uri: string): { repo: string; collection: string; rkey: string } | null {
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return { repo: match[1], collection: match[2], rkey: match[3] };
}

// ── Fetch nomination record from public AT Proto API ───────

async function fetchNominationRecord(uri: string): Promise<{ record: NominationRecord; repo: string }> {
  const parsed = parseAtUri(uri);
  if (!parsed) throw new Error('Invalid nomination URI');

  const url = `https://bsky.social/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(parsed.repo)}&collection=${encodeURIComponent(parsed.collection)}&rkey=${encodeURIComponent(parsed.rkey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error((errBody as { message?: string }).message || 'Could not fetch nomination record');
  }
  const data = await res.json() as { value: NominationRecord };
  return { record: data.value, repo: parsed.repo };
}

// ── Resolve DID to handle ──────────────────────────────────

async function resolveHandle(did: string): Promise<string> {
  try {
    const url = `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`;
    const res = await fetch(url);
    if (!res.ok) return did;
    const data = await res.json() as { handle?: string };
    return data.handle || did;
  } catch {
    return did;
  }
}

// ── Display nomination ─────────────────────────────────────

function displayNomination() {
  if (!nominationRecord || !awarderHandle) return;

  const displayHandle = awarderHandle.startsWith('did:') ? awarderHandle : '@' + awarderHandle;
  const awarderProfileUrl = 'https://bsky.app/profile/' + encodeURIComponent(awarderHandle);
  nominationText.innerHTML =
    'You\'ve been nominated for a <strong>Best Thing I Saw</strong> award by <a href="' +
    escapeAttr(awarderProfileUrl) + '" target="_blank" rel="noopener">' +
    escapeHtml(displayHandle) + '</a>';

  const bskyUrl = atUriToBskyUrl(nominationRecord.subject);
  postLink.href = bskyUrl;

  const date = formatDate(nominationRecord.createdAt);
  if (date) {
    nomDate.textContent = date;
  } else {
    nomDate.classList.add('hidden');
  }

  // Update button state based on auth
  if (currentAgent) {
    claimBtn.textContent = 'Claim Award';
    claimBtn.classList.remove('needs-login');
  } else {
    claimBtn.textContent = 'Sign In to Claim';
    claimBtn.classList.add('needs-login');
  }

  showState(stateNomination);
}

// ── Claim flow ─────────────────────────────────────────────

async function claimAward() {
  if (!nominationRecord || !nominationUri || !awarderDid) return;

  // If not logged in, start OAuth
  if (!currentAgent || !currentDid) {
    // Save state for after OAuth redirect
    sessionStorage.setItem('jklb-claim-state', JSON.stringify({ nominationUri }));

    const client = await getOAuthClient();
    // Use the recipient DID to resolve their handle for login
    const recipientHandle = await resolveHandle(nominationRecord.recipient);
    const cleanHandle = recipientHandle.startsWith('@') ? recipientHandle.slice(1) : recipientHandle;

    await client.signInRedirect(cleanHandle, {
      state: JSON.stringify({ returnTo: '/claimAward/' }),
    });
    return;
  }

  // Verify the logged-in user is the recipient
  if (currentDid !== nominationRecord.recipient) {
    claimBtn.textContent = 'WRONG ACCOUNT';
    claimBtn.disabled = true;
    setTimeout(() => {
      claimBtn.textContent = 'Claim Award';
      claimBtn.disabled = false;
    }, 3000);
    return;
  }

  claimBtn.disabled = true;
  claimBtn.textContent = 'WRITING...';

  try {
    // Write social.jklb.bestThingISawAwardWinner to the winner's PDS
    await currentAgent.com.atproto.repo.createRecord({
      repo: currentDid,
      collection: 'social.jklb.bestThingISawAwardWinner',
      record: {
        $type: 'social.jklb.bestThingISawAwardWinner',
        nomination: nominationUri,
        nominatedBy: awarderDid,
        subject: nominationRecord.subject,
        createdAt: new Date().toISOString(),
      },
    });

    // POST to /api/best-thing with action: 'win' (fire-and-forget)
    fetch('/api/best-thing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'win',
        winnerDid: currentDid,
        winnerHandle: currentHandle || currentDid,
        nominatedByDid: awarderDid,
        subjectUri: nominationRecord.subject,
      }),
    }).catch((err) => {
      console.error('Failed to notify best-thing worker:', err);
    });

    // Show success
    const pdslsUrl = 'https://pdsls.dev/at://' + encodeURIComponent(currentDid) + '/social.jklb.bestThingISawAwardWinner';
    stateSuccess.innerHTML =
      '<span class="success-badge">You Won!</span>' +
      '<p class="success-text">Your <code>social.jklb.bestThingISawAwardWinner</code> record has been written to your PDS.</p>' +
      '<p class="success-text"><a href="' + escapeAttr(pdslsUrl) + '" target="_blank" rel="noopener" class="pdsls-link">view on pdsls.dev</a></p>';
    showState(stateSuccess);
  } catch (err) {
    console.error('Failed to write award:', err);
    claimBtn.textContent = 'FAILED — TRY AGAIN';
    claimBtn.disabled = false;
  }
}

// ── Event listeners ────────────────────────────────────────

claimBtn.addEventListener('click', () => { claimAward(); });

logoutBtn.addEventListener('click', async () => {
  if (currentDid) {
    try {
      const client = await getOAuthClient();
      await client.revoke(currentDid);
    } catch {
      // Best effort
    }
  }
  currentAgent = null;
  currentDid = null;
  currentHandle = null;
  hideAuthBar();
  displayNomination(); // Re-render with sign-in button
});

// ── Init ───────────────────────────────────────────────────

async function init() {
  // Read ?nomination= param
  const params = new URLSearchParams(window.location.search);
  nominationUri = params.get('nomination');

  if (!nominationUri) {
    showError('No nomination URI provided. Check the link you followed.');
    return;
  }

  // Check for OAuth session (may be returning from redirect)
  try {
    const client = await getOAuthClient();
    const result = await client.init();

    if (result?.session) {
      // Clean URL but preserve nomination param
      const cleanUrl = window.location.origin + window.location.pathname + '?nomination=' + encodeURIComponent(nominationUri);
      window.history.replaceState({}, '', cleanUrl);

      currentDid = result.session.did;
      currentAgent = new Agent(result.session);

      try {
        const profile = await currentAgent.getProfile({ actor: currentDid });
        currentHandle = profile.data.handle;
      } catch {
        currentHandle = currentDid;
      }

      showAuthBar(currentHandle);
    }
  } catch (err) {
    console.error('Auth init failed:', err);
  }

  // Fetch the nomination record
  try {
    const { record, repo } = await fetchNominationRecord(nominationUri);
    nominationRecord = record;
    awarderDid = repo;
    awarderHandle = await resolveHandle(repo);
  } catch (err) {
    showError('Could not load nomination. The record may not exist or the link may be invalid.');
    console.error('Nomination fetch failed:', err);
    return;
  }

  displayNomination();

  // If returning from OAuth with saved state, auto-claim
  const savedState = sessionStorage.getItem('jklb-claim-state');
  if (savedState && currentAgent) {
    sessionStorage.removeItem('jklb-claim-state');
    try {
      const state = JSON.parse(savedState) as { nominationUri: string };
      if (state.nominationUri === nominationUri) {
        await claimAward();
      }
    } catch {
      // Ignore bad state
    }
  }
}

init();
