# Deployment Spec

## Command
When user says **"deploy"**, execute the full deployment pipeline.

## Prerequisites (one-time setup)
1. Install wrangler: `npm install -g wrangler`
2. Authenticate: `wrangler login` (opens browser)
3. First deploy creates the project: `wrangler pages deploy dist --project-name=jklb`
4. Add custom domain in Cloudflare Pages dashboard: `jklb.social`
5. (Domain bought through Cloudflare - DNS auto-configured)

## Deployment Pipeline
```bash
# 1. Build
npm run build

# 2. Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=jklb --commit-dirty=true
```

## Target
- **URL**: https://jklb.social
- **Preview URL**: https://jklb.pages.dev

## Notes
- Direct uploads via wrangler are **unlimited** (no 500/month cap)
- The 500 builds/month limit only applies to Cloudflare's CI/CD (Git integration)
- We use direct upload, so deploy as often as needed
- Deployment typically completes in ~30 seconds
- Cloudflare handles SSL automatically

## Agent Instructions
After deploying, report: **"Deployed to https://jklb.social"**

Do NOT report the per-deployment preview URL (e.g., `abc123.jklb.pages.dev`) as the primary result - that confuses users into thinking a new project was created. The preview URL is just for debugging specific deploys.
