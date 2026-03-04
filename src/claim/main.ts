// Claim page entry point — standalone (no React)
// Handles OAuth login and writing social.jklb.award records

import {
  BrowserOAuthClient,
  atprotoLoopbackClientMetadata,
} from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';

// ── Types ──────────────────────────────────────────────────

interface Nomination {
  awarderDid: string;
  awarderHandle: string;
  recipientDid: string;
  nominationUri: string;
  subjectUri: string;
  exitPostUri: string;
  createdAt: string;
}

// ── OAuth client ───────────────────────────────────────────

let oauthClient: BrowserOAuthClient | null = null;
let currentAgent: Agent | null = null;
let currentDid: string | null = null;
let currentHandle: string | null = null;

// Track nominations so we can re-render after login
let lastNominations: Nomination[] = [];
let lastSearchHandle: string = '';

function isLoopback(): boolean {
  const { hostname } = window.location;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function buildLocalhostClientId(): string {
  const { port } = window.location;
  // Redirect back to the claim page path on localhost
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
    // Production: use the same oauth-client-metadata.json but it now includes /claimAward/ redirect
    const clientId = `${window.location.origin}/oauth-client-metadata.json`;
    oauthClient = await BrowserOAuthClient.load({
      clientId,
      handleResolver: 'https://bsky.social',
    });
  }

  return oauthClient;
}

// ── DOM references ─────────────────────────────────────────

const form = document.getElementById('searchForm') as HTMLFormElement;
const input = document.getElementById('handleInput') as HTMLInputElement;
const resultsDiv = document.getElementById('results') as HTMLDivElement;
const searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;
const authBar = document.getElementById('authBar') as HTMLDivElement;
const authHandleSpan = document.getElementById('authHandle') as HTMLSpanElement;
const logoutBtn = document.getElementById('logoutBtn') as HTMLButtonElement;

// ── Auth UI ────────────────────────────────────────────────

function showAuthBar(handle: string) {
  authHandleSpan.textContent = `@${handle}`;
  authBar.classList.remove('hidden');
}

function hideAuthBar() {
  authBar.classList.add('hidden');
}

// ── Init: check for existing session or OAuth callback ─────

async function initAuth() {
  try {
    const client = await getOAuthClient();
    const result = await client.init();

    if (result?.session) {
      // Clean URL after OAuth callback
      if (window.location.hash || window.location.search) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }

      currentDid = result.session.did;
      currentAgent = new Agent(result.session);

      // Fetch handle for display
      try {
        const profile = await currentAgent.getProfile({ actor: currentDid });
        currentHandle = profile.data.handle;
      } catch {
        currentHandle = currentDid;
      }

      showAuthBar(currentHandle);

      // If we saved state before redirect, restore the search
      const savedState = sessionStorage.getItem('jklb-claim-state');
      if (savedState) {
        sessionStorage.removeItem('jklb-claim-state');
        try {
          const state = JSON.parse(savedState) as { handle: string; nominationUri: string };
          input.value = state.handle;
          // Re-run the search and then auto-accept
          await searchNominations(state.handle, state.nominationUri);
        } catch {
          // Ignore bad state
        }
      }
    }
  } catch (err) {
    console.error('Auth init failed:', err);
  }
}

// ── OAuth login (redirect flow) ────────────────────────────

async function startLogin(handle: string, nominationUri: string) {
  // Save state so we can resume after OAuth redirect
  sessionStorage.setItem('jklb-claim-state', JSON.stringify({
    handle: lastSearchHandle,
    nominationUri,
  }));

  const client = await getOAuthClient();
  const cleanHandle = handle.startsWith('@') ? handle.slice(1) : handle;

  await client.signInRedirect(cleanHandle, {
    state: JSON.stringify({ returnTo: '/claimAward/' }),
  });
}

// ── Logout ─────────────────────────────────────────────────

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
  // Re-render results without auth
  if (lastNominations.length > 0) {
    renderNominations(lastNominations);
  }
});

// ── Accept award ───────────────────────────────────────────

async function acceptAward(nom: Nomination, btn: HTMLButtonElement) {
  if (!currentAgent || !currentDid) {
    // Need to log in first — prompt for handle
    const recipientHandle = lastSearchHandle;
    if (!recipientHandle) {
      btn.textContent = 'ERROR';
      return;
    }
    // Start OAuth flow — this redirects the browser
    await startLogin(recipientHandle, nom.nominationUri);
    return;
  }

  // Check that the logged-in user matches the recipient
  if (currentDid !== nom.recipientDid) {
    btn.textContent = 'WRONG ACCOUNT';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = 'Accept Award';
      btn.disabled = false;
    }, 3000);
    return;
  }

  btn.disabled = true;
  btn.textContent = 'WRITING...';

  try {
    await currentAgent.com.atproto.repo.createRecord({
      repo: currentDid,
      collection: 'social.jklb.award',
      record: {
        $type: 'social.jklb.award',
        nomination: nom.nominationUri,
        nominatedBy: nom.awarderDid,
        subject: nom.subjectUri,
        createdAt: new Date().toISOString(),
      },
    });

    // Replace the entire nomination card with congrats view
    const card = btn.closest('.nomination-card');
    if (card) {
      const pdslsUrl = 'https://pdsls.dev/at://' + encodeURIComponent(currentDid) + '/social.jklb.award';
      card.innerHTML =
        '<div class="congrats-view">' +
        '<span class="claimed-badge">AWARD CLAIMED</span>' +
        '<p class="congrats-text">congrats! your <code>social.jklb.award</code> record has been written to your PDS.</p>' +
        '<p class="congrats-text"><a href="' + escapeAttr(pdslsUrl) + '" target="_blank" rel="noopener" class="pdsls-link">view it on pdsls</a></p>' +
        '</div>';
    }
  } catch (err) {
    console.error('Failed to write award:', err);
    btn.textContent = 'FAILED — TRY AGAIN';
    btn.disabled = false;
  }
}

// ── Render nominations ─────────────────────────────────────

function renderNominations(nominations: Nomination[], autoAcceptUri?: string) {
  lastNominations = nominations;

  if (!nominations.length) {
    resultsDiv.innerHTML =
      '<p class="status-msg empty">we do not have @' +
      escapeHtml(lastSearchHandle) +
      ' in our system as eligible for a JKLBie. This may be an error! Make a bug report with a link to the post where someone gave you the JKLBie here: ' +
      '<a href="https://skyboard.dev/board/did:plc:aurnkk6uy6axy66uqaq6dqy6/3mf5cn2qnn22m" target="_blank" rel="noopener" style="color: #00bcd4; text-decoration: underline;">skyboard bug report</a></p>';
    return;
  }

  let html = '<p class="results-header">' +
    nominations.length +
    ' nomination' + (nominations.length !== 1 ? 's' : '') +
    ' for @' + escapeHtml(lastSearchHandle) +
    '</p>';

  for (let i = 0; i < nominations.length; i++) {
    const nom = nominations[i];
    const awarderProfile = 'https://bsky.app/profile/' + encodeURIComponent(nom.awarderHandle || nom.awarderDid);
    const postUrl = atUriToBskyUrl(nom.subjectUri);
    const date = nom.createdAt ? formatDate(nom.createdAt) : '';

    const isLoggedIn = !!currentAgent;
    const btnClass = isLoggedIn ? 'accept-btn' : 'accept-btn needs-login';
    const btnText = isLoggedIn ? 'Accept Award' : 'Sign In to Accept';

    html += '<div class="nomination-card" data-index="' + i + '">' +
      '<div class="awarded-by">Nominated by <a href="' + escapeAttr(awarderProfile) + '" target="_blank" rel="noopener">@' + escapeHtml(nom.awarderHandle || nom.awarderDid) + '</a></div>' +
      '<div class="for-post">For your post: <a href="' + escapeAttr(postUrl) + '" target="_blank" rel="noopener">view on Bluesky</a></div>' +
      (date ? '<div class="nom-date">' + escapeHtml(date) + '</div>' : '') +
      '<button class="' + btnClass + '" data-nom-index="' + i + '">' + btnText + '</button>' +
      '</div>';
  }

  resultsDiv.innerHTML = html;

  // Attach click handlers to accept buttons
  const buttons = resultsDiv.querySelectorAll('[data-nom-index]');
  buttons.forEach((btn) => {
    const idx = parseInt((btn as HTMLElement).dataset.nomIndex || '0', 10);
    btn.addEventListener('click', () => acceptAward(nominations[idx], btn as HTMLButtonElement));
  });

  // If we came back from OAuth with a specific nomination to accept, auto-accept it
  if (autoAcceptUri && currentAgent) {
    const idx = nominations.findIndex(n => n.nominationUri === autoAcceptUri);
    if (idx >= 0) {
      const btn = resultsDiv.querySelector(`[data-nom-index="${idx}"]`) as HTMLButtonElement | null;
      if (btn) {
        acceptAward(nominations[idx], btn);
      }
    }
  }
}

// ── Search nominations ─────────────────────────────────────

async function searchNominations(handle: string, autoAcceptUri?: string) {
  lastSearchHandle = handle;
  searchBtn.disabled = true;
  resultsDiv.innerHTML = '<p class="status-msg loading">Looking up nominations...</p>';

  try {
    const res = await fetch(
      '/api/nominations?handle=' + encodeURIComponent(handle)
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || 'Request failed (' + res.status + ')');
    }

    const nominations = await res.json() as Nomination[];
    renderNominations(nominations, autoAcceptUri);
  } catch (err) {
    resultsDiv.innerHTML =
      '<p class="status-msg error">' + escapeHtml(err instanceof Error ? err.message : String(err)) + '</p>';
  } finally {
    searchBtn.disabled = false;
  }
}

// ── Form handler ───────────────────────────────────────────

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const handle = input.value.trim();
  if (!handle) return;
  await searchNominations(handle);
});

// ── Helpers ────────────────────────────────────────────────

function atUriToBskyUrl(atUri: string): string {
  if (!atUri) return '#';
  const parts = atUri.replace('at://', '').split('/');
  if (parts.length < 3) return '#';
  const did = parts[0];
  const rkey = parts[2];
  return 'https://bsky.app/profile/' + encodeURIComponent(did) + '/post/' + encodeURIComponent(rkey);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Start ──────────────────────────────────────────────────

initAuth();
