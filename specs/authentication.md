# Spec: Authentication

## Job to Be Done
Allow any ATProtocol user to log into russAbbot using their handle, regardless of which PDS hosts their account.

## Requirements

### Handle-Based Login Flow
1. User sees login modal with single input field for handle
2. User enters their handle (e.g., `alice.bsky.social`, `bob.example.com`)
3. App resolves handle to find user's PDS via DID document lookup
4. App initiates OAuth flow with discovered PDS
5. On success, app stores session and shows main interface
6. On failure, app shows error message and allows retry

### OAuth Implementation
- Use ATProtocol OAuth (not app passwords)
- Handle the full OAuth redirect flow
- Support both bsky.social and custom PDS endpoints
- Store tokens securely in localStorage

### Session Persistence
- Store session in localStorage under key `russabbot_session`
- On app load, check for existing session
- If valid session exists, resume without login prompt
- If session expired/invalid, show login modal
- Provide logout button that clears session

### Profile Display
- After login, display user's avatar in header/nav area
- Show handle as confirmation of logged-in account

## Acceptance Criteria
- [x] User can log in with bsky.social handle
- [x] User can log in with custom domain handle
- [x] Session persists across page refreshes
- [x] Session persists across browser close/reopen
- [x] Logout clears session and returns to login
- [x] Invalid handles show clear error message
- [x] OAuth errors show clear error message

## Technical Notes
- Implemented in `src/lib/auth.ts` and `src/lib/AuthContext.tsx`
- Uses `@atproto/oauth-client-browser` for OAuth
- Session stored in localStorage
- Profile fetching on login

## Dependencies
- None (this is foundational)

## Implementation Status
✅ COMPLETE - OAuth authentication working
