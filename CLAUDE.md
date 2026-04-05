# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Payload CMS plugin that streams video uploads to cloud providers (currently Cloudflare Stream). When a video is uploaded to a Payload collection, the plugin copies it to the streaming provider, tracks processing status via background jobs, and renders an embedded player preview in the admin UI.

## Commands

```bash
pnpm dev              # Run dev server (Next.js + Payload) on localhost:3000
pnpm build            # Full build: copyfiles → tsc types → swc transpile
pnpm lint             # ESLint (uses @payloadcms/eslint-config)
pnpm lint:fix         # ESLint with auto-fix
pnpm test:int         # Integration tests via vitest (uses MongoMemoryReplSet)
pnpm test:e2e         # E2E tests via Playwright (starts dev server automatically)
pnpm test             # Runs both int + e2e
```

Run a single integration test:
```bash
pnpm vitest run dev/int.spec.ts -t "test name"
```

## Architecture

### Plugin entry point (`src/index.ts`)

`videoStream()` is a Payload config function that:
1. Injects a `stream` group field into configured collections
2. Adds `afterOperation` hooks (copy video on create, update status on findByID)
3. Adds `beforeDelete` hook (delete video from provider)
4. Registers a background job task per adapter for polling stream readiness

Collections can use the default adapter or specify a per-collection adapter override.

### Adapter pattern (`src/adapters/`)

`StreamAdapter` is an abstract class defining the provider interface: `copyVideo`, `delete`, `getStatus`, `getHTMLVideoPlayer`, `getSignedToken`. `CloudflareStreamAdapter` is the only implementation. New providers implement this abstract class.

The adapter's `providerName` is used to generate unique job task slugs: `payloadStreamUpdateStatusFor${providerName}`.

### Lifecycle flow

1. **Upload** → `afterOperation` hook fires on `create` → `streamingService.copyVideoToStreamingPlatform()` runs after 1s delay via `setTimeout` → queues a `updateStreamStatus` background job
2. **Status polling** → background job fetches status from provider → if not `readyToStream`, re-queues itself (up to 3 retries)
3. **View** → `afterOperation` hook fires on `findByID` → if not `readyToStream`, fetches latest status and updates the document
4. **Delete** → `beforeDelete` hook removes the video from the streaming provider

### Field & UI components (`src/fields/`)

The `stream` group field is conditionally shown only for `video/*` mimeTypes, positioned in the sidebar. It contains a `ui` type preview field that uses Payload's RSC component pattern:

- `server.component.tsx` → exported via `payload-video-stream/rsc` → calls `adapter.getHTMLVideoPlayer()` server-side
- `client.component.tsx` → exported via `payload-video-stream/client` → renders the iframe or processing/error state

### Export paths

- `payload-video-stream` — main plugin function + types
- `payload-video-stream/adapters` — adapter classes and types
- `payload-video-stream/services` — streaming service
- `payload-video-stream/client` — client components
- `payload-video-stream/rsc` — server components

### Dev environment (`dev/`)

A full Payload + Next.js app used for development and testing. Uses PostgreSQL by default, falls back to MongoMemoryReplSet for `NODE_ENV=test`. Configured with S3 storage and Cloudflare Stream adapter. Env vars needed: `DATABASE_URI`, `CLOUDFLARE_STREAM_*`, `S3_*`, `PAYLOAD_SECRET`.

## Key conventions

- ESM throughout (`"type": "module"` in package.json, `NodeNext` module resolution)
- All internal imports use `.js` extensions (even for `.ts` files) per NodeNext convention
- Build output goes to `dist/` via SWC with separate type declaration pass
- Vitest integration tests spin up a real Payload instance with in-memory MongoDB
- Plugin follows Payload's config function pattern: `(pluginOptions) => (config) => config`
