// Cloudflare Pages Function: /api/nominations
// DEPRECATED — thin redirect to /api/best-thing for backwards compatibility.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

export const onRequest: PagesFunction = async (context) => {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Redirect to /api/best-thing preserving method, headers, and body
  const url = new URL(request.url);
  url.pathname = '/api/best-thing';

  return jsonResponse(
    {
      error: 'This endpoint has moved to /api/best-thing',
      redirect: url.toString(),
    },
    301,
  );
};
