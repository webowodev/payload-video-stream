# GitHub Copilot Instructions: payload-video-stream

## Project Overview

This is a **Payload CMS plugin** (v3.x) that enables video uploads directly to streaming service providers (e.g., Cloudflare Stream) from Payload upload collections. The plugin acts as a bridge between Payload's file upload system and external video streaming platforms, handling video processing, optimization, and metadata synchronization automatically.

**Key Capabilities:**

- Seamless integration with Payload CMS upload collections
- Adapter pattern for multiple streaming providers (currently Cloudflare Stream)
- Automatic video status tracking and metadata synchronization
- Support for private S3 buckets with signed URLs
- Conditional field display based on MIME types

## Tech Stack

- **Payload CMS**: v3.64.0+ (peer dependency)
- **Next.js**: v15.4+ (App Router for dev environment)
- **React**: v19.1+
- **TypeScript**: v5.7+ (strict mode enabled)
- **Node.js**: ^18.20.2 || >=20.9.0
- **pnpm**: ^9 || ^10 (required package manager)
- **Build Tools**: SWC (transpilation), TypeScript (type declarations only)
- **Testing**: Vitest (integration), Playwright (E2E)
- **Storage Adapters**: `@payloadcms/storage-s3`, `@payloadcms/storage-r2`

## Architecture Patterns

### 1. Plugin Architecture (Higher-Order Function Pattern)

The main export `videoStream` is a function that returns a config transformer:

```typescript
export const videoStream = (pluginOptions: VideoStreamConfig) => (config: Config) => Config
```

**Key Behaviors:**

- Mutates Payload config by injecting custom fields and lifecycle hooks
- Preserves existing hooks by spreading them and appending new ones
- Respects the `disabled` flag but maintains schema for migration safety
- Injects hooks into all collections specified in `pluginOptions.collections`

### 2. Adapter Pattern (Strategy Pattern)

All streaming service integrations use the adapter pattern:

**Abstract Base Class:**

```typescript
export abstract class StreamAdapter {
  abstract copy(request: CopyVideoRequest): Promise<StreamResponse>
  abstract getStatus(videoId: string): Promise<StreamResponse>
}
```

**Implementation Guidelines:**

- New adapters MUST extend `StreamAdapter`
- Use factory functions (e.g., `cloudflareStreamAdapter()`) instead of `new` keyword
- Transform provider-specific responses to generic `StreamResponse` type
- Handle errors gracefully with descriptive messages
- Support both direct URLs and signed URL callbacks

**Example Structure:**

```typescript
export const myProviderAdapter = (config: MyProviderConfig) => {
  return new MyProviderAdapter(config)
}

class MyProviderAdapter extends StreamAdapter {
  constructor(private config: MyProviderConfig) {
    super()
  }

  async copy(request: CopyVideoRequest): Promise<StreamResponse> {
    // Implementation
  }

  async getStatus(videoId: string): Promise<StreamResponse> {
    // Implementation
  }
}
```

**Per-Collection Adapter Configuration:**

The plugin supports different adapters for different collections:

```typescript
import { videoStream } from 'payload-video-stream'
import { cloudflareStreamAdapter } from 'payload-video-stream/adapters'

export default buildConfig({
  plugins: [
    videoStream({
      // Default adapter for all collections
      defaultAdapter: cloudflareStreamAdapter({
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
      }),

      collections: {
        // Use default adapter
        media: true,

        // Override with custom adapter for this collection
        privateVideos: {
          adapter: cloudflareStreamAdapter({
            accountId: process.env.CLOUDFLARE_PRIVATE_ACCOUNT_ID,
            apiToken: process.env.CLOUDFLARE_PRIVATE_API_TOKEN,
            requireSignedURLs: true,
          }),
        },
      },
    }),
  ],
})
```

**Type Definition:**

```typescript
type VideoStreamConfig = {
  collections?: Partial<Record<CollectionSlug, { adapter?: StreamAdapter } | true>>
  defaultAdapter?: StreamAdapter
  getSignedUrl?: (url: string) => Promise<string>
  disabled?: boolean
}
```

### 3. Hook-Based Lifecycle Management

Two key `afterOperation` hooks are injected:

**`updateStatusHook`**: Updates stream status when fetching a video by ID

- Only runs on `findByID` operations
- Updates document with latest status from streaming provider
- Gracefully logs errors without throwing

**`copyVideo`**: Initiates video copy to streaming service

- Runs on `create` and `update` operations
- Only processes if video exists but isn't streamed yet
- Handles signed URLs when needed
- Updates document with stream metadata

**Hook Injection Pattern:**

```typescript
collection.hooks = {
  ...collection.hooks,
  afterOperation: [...(collection.hooks?.afterOperation || []), updateStatusHook, copyVideo],
}
```

### 4. Conditional Field Display

The `stream` field group uses Payload's `admin.condition` feature:

- Only visible for video MIME types (`video/*`)
- Placed in sidebar for supplementary information
- Read-only fields for system-managed data

**Complete Stream Field Structure:**

```typescript
// From src/fields/stream.ts
{
  name: 'stream',
  type: 'group',
  admin: {
    position: 'sidebar',
    condition: (data) => data?.mimeType?.startsWith('video/'),
  },
  fields: [
    {
      name: 'videoId',
      type: 'text',
      admin: { readOnly: true },
      // Provider's unique video identifier
    },
    {
      name: 'status',
      type: 'text',
      admin: { readOnly: true },
      // Values: 'pending', 'ready', 'error'
    },
    {
      name: 'streamed',
      type: 'checkbox',
      admin: { readOnly: true, hidden: true },
      // Internal flag tracking copy completion
    },
    {
      name: 'metadata',
      type: 'textarea',
      admin: { readOnly: true, hidden: true },
      // JSON string of provider-specific metadata
    },
  ],
}
```

**TypeScript Note**: The `stream` field is dynamically injected and may not appear in generated Payload types. Cast when accessing:

```typescript
const stream = doc.stream as {
  videoId?: string
  status?: string
  thumbnailUrl?: string
  playbackUrl?: string
  streamed?: boolean
  metadata?: string
}
```

## Code Organization

### Directory Structure

```
src/                          # Plugin source code
├── index.ts                  # Main plugin export (videoStream function)
├── adapters/                 # Streaming service adapters
│   ├── streamAdapter.ts      # Abstract base class
│   ├── cloudflareStream.ts   # Cloudflare implementation
│   └── types.ts              # Shared adapter types
├── fields/                   # Custom Payload fields
│   └── stream.ts             # Stream metadata field group
└── hooks/                    # Payload lifecycle hooks
    └── afterOperation.ts     # Post-operation hooks

dev/                          # Development/testing environment
├── payload.config.ts         # Payload config for testing
├── seed.ts                   # Database seeding
├── e2e.spec.ts               # Playwright E2E tests
├── int.spec.ts               # Vitest integration tests
└── app/                      # Next.js App Router
    └── (payload)/            # Payload admin UI routes
```

### Module System

**CRITICAL: Use `.js` extensions in all imports** (ESM requirement):

```typescript
// ✅ CORRECT
import { streamField } from './fields/stream.js'
import { cloudflareStreamAdapter } from './adapters/cloudflareStream.js'

// ❌ INCORRECT
import { streamField } from './fields/stream'
import { streamField } from './fields/stream.ts'
```

## Coding Standards

### TypeScript Configuration

- **Strict Mode**: All strict checks enabled
- **Module System**: `NodeNext` (ESM with Node.js resolution)
- **Composite Project**: Enabled for incremental builds
- **Declaration Only**: `emitDeclarationOnly: true` (SWC handles transpilation)

### Import/Export Patterns

**Package Exports:**

```json
{
  ".": "./src/index.ts",
  "./adapters": "./src/adapters/index.ts"
}
```

**Note**: `/client` and `/rsc` exports are planned for future releases (see Future Considerations).

**Usage in Published Package:**

```typescript
// Main plugin
import { videoStream } from 'payload-video-stream'

// Adapters
import { cloudflareStreamAdapter } from 'payload-video-stream/adapters'
```

**Usage in Development:**

```typescript
// Use .js extensions (ESM requirement)
import { videoStream } from './src/index.js'
import { cloudflareStreamAdapter } from './src/adapters/cloudflareStream.js'
```

**What to Export:**

- Main plugin function (`videoStream`)
- Adapter classes and factory functions
- Field definitions (`streamField`)
- Hook functions (if useful standalone)
- Type definitions used in public API

### Error Handling

**Hooks**: Graceful degradation with logging

```typescript
try {
  // Hook logic
} catch (error) {
  req.payload.logger.error({ err: error, msg: 'Hook failed' })
  // Don't throw - allow operation to complete
}
```

**Adapters**: Validate responses and throw descriptive errors

```typescript
if (!response.ok) {
  throw new Error(`Provider returned ${response.status}: ${errorMessage}`)
}
```

### Field Definitions

**Pattern for conditional fields:**

```typescript
{
  name: 'fieldName',
  type: 'text',
  admin: {
    condition: (data) => data?.mimeType?.startsWith('video/'),
    readOnly: true, // For system-managed fields
    position: 'sidebar', // For metadata
  },
}
```

### Adapter Implementation Checklist

When creating a new adapter:

1. ✅ Extend `StreamAdapter` abstract class
2. ✅ Implement `copy(request: CopyVideoRequest)` method
3. ✅ Implement `getStatus(videoId: string)` method
4. ✅ Create factory function that returns adapter instance
5. ✅ Transform provider response to `StreamResponse` type
6. ✅ Handle both direct URLs and signed URL callbacks
7. ✅ Validate HTTP responses with descriptive errors
8. ✅ Map provider-specific status to generic status strings
9. ✅ Export factory function from `src/adapters/index.ts`
10. ✅ Add TypeScript types to `src/adapters/types.ts`

### Signed URL Handling

The plugin supports private S3 buckets requiring signed URLs. When configured with `@payloadcms/storage-s3` or `@payloadcms/storage-r2`, the storage adapter exposes a signed URL endpoint.

**How It Works:**

1. Plugin checks if `getSignedUrl` is configured (adapter-level takes precedence)
2. Makes a fetch request to the S3 storage's signed URL endpoint
3. Passes the signed URL to the streaming adapter for video copy
4. Signed URL is temporary and used only for the copy operation

**Configuration:**

```typescript
import { videoStream } from 'payload-video-stream'
import { cloudflareStreamAdapter } from 'payload-video-stream/adapters'
import { s3Storage } from '@payloadcms/storage-s3'

export default buildConfig({
  plugins: [
    // S3 storage with signed URL generation
    s3Storage({
      collections: {
        media: true,
      },
      bucket: process.env.S3_BUCKET,
      config: {
        credentials: {
          /* ... */
        },
        region: process.env.S3_REGION,
      },
    }),

    // Video streaming with signed URL support
    videoStream({
      collections: { media: true },
      defaultAdapter: cloudflareStreamAdapter({
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
        apiToken: process.env.CLOUDFLARE_API_TOKEN,
      }),

      // Plugin-level: applies to all collections
      getSignedUrl: async (url) => {
        const response = await fetch(`${url}?payload-s3-signature=true`)
        if (!response.ok) throw new Error('Failed to get signed URL')
        return response.url
      },
    }),
  ],
})
```

**Adapter-Level Override:**

```typescript
videoStream({
  collections: {
    privateVideos: {
      adapter: cloudflareStreamAdapter({
        // Adapter-level: only for this collection
        getSignedUrl: async (url) => {
          // Custom signed URL logic
          return getCustomSignedUrl(url)
        },
      }),
    },
  },
})
```

**Priority**: Adapter-level `getSignedUrl` takes precedence over plugin-level.

**Fetch Mechanism in Hooks:**

```typescript
// From src/hooks/afterOperation.ts
const videoUrl = adapter.getSignedUrl
  ? await adapter.getSignedUrl(doc.url)
  : pluginOptions.getSignedUrl
    ? await pluginOptions.getSignedUrl(doc.url)
    : doc.url
```

## Testing Conventions

### Integration Tests (Vitest)

**Location**: `dev/int.spec.ts`

**Setup Pattern:**

```typescript
import { getPayload } from 'payload'
import config from './payload.config.js'

describe('Feature', () => {
  let payload: Payload

  beforeAll(async () => {
    payload = await getPayload({ config })
  }, 30000) // 30-second timeout

  afterAll(async () => {
    await payload.db.destroy()
  })
})
```

**Testing Focus:**

- Plugin integration with Payload
- Field injection verification
- Hook execution logic
- Collection creation and seeding
- Video copy workflow
- Status update mechanism

**Database Configuration:**

- **Development**: PostgreSQL adapter (`@payloadcms/db-postgres`) for actual dev work
- **Tests**: MongoDB Memory Server (`mongodb-memory-server`) when `process.env.NODE_ENV === 'test'`
- Conditional setup in `dev/payload.config.ts` switches between databases

**Current Test Status:**

⚠️ **Note**: The existing tests in `dev/int.spec.ts` contain template/example code from a plugin starter that tests non-existent features (custom endpoints, plugin-created collections). These should be updated to test actual plugin functionality:

**Recommended Test Cases:**

```typescript
// Test field injection
test('should inject stream field into collections', async () => {
  const mediaConfig = payload.collections['media'].config
  const streamField = mediaConfig.fields.find((f) => f.name === 'stream')
  expect(streamField).toBeDefined()
})

// Test hook registration
test('should register afterOperation hooks', async () => {
  const hooks = payload.collections['media'].config.hooks?.afterOperation
  expect(hooks).toBeDefined()
  expect(hooks?.length).toBeGreaterThan(0)
})

// Test conditional field display
test('stream field should only show for video MIME types', async () => {
  // Test admin.condition logic
})
```

### E2E Tests (Playwright)

**Location**: `dev/e2e.spec.ts`

**Pattern:**

```typescript
import { test, expect } from '@playwright/test'

test.describe('Admin Panel', () => {
  test('feature works', async ({ page }) => {
    await page.goto('/admin')
    await expect(page.locator('selector')).toBeVisible()
  })
})
```

**Testing Focus:**

- Admin panel UI interactions
- Login functionality
- Visual element rendering
- Form submissions
- Navigation flows

**Configuration:**

- Auto-starts dev server on `http://localhost:3000`
- Runs on Chromium only
- 2 retries on CI environments
- HTML reports in `playwright-report/`

### Test Isolation

Each test suite should:

- Get a fresh Payload instance
- Use in-memory database for speed
- Clean up resources in `afterAll`
- Set `NODE_ENV=test` when appropriate
- Use 30-second timeouts for hooks with async operations

## Build and Dependency Patterns

### Build Process

**Order**: `clean` → `copyfiles` → `build:types` → `build:swc`

```bash
# Full build
pnpm build

# Individual steps
pnpm copyfiles              # Copy non-TS assets
pnpm build:types            # Generate .d.ts files with tsc
pnpm build:swc              # Transpile with SWC
```

**Key Points:**

- TypeScript generates declarations only (`emitDeclarationOnly`)
- SWC handles transpilation (20x faster than tsc)
- Output format: ES6 modules in `dist/`
- Non-code assets copied with `copyfiles` utility
- Pre-publish runs: `pnpm clean && pnpm build` (via `prepublishOnly` script)

**SWC Configuration** (`.swcrc`):

```json
{
  "jsc": {
    "target": "esnext",
    "parser": {
      "syntax": "typescript",
      "tsx": true,
      "dts": true
    },
    "transform": {
      "react": {
        "runtime": "automatic"
      }
    }
  },
  "module": {
    "type": "es6"
  }
}
```

**Why SWC?**

- 20x faster than TypeScript compiler for transpilation
- Handles JSX/TSX transformation automatically
- Preserves ESM module format
- TypeScript still used for type checking and declaration generation

### Dependency Management

**Peer Dependencies:**

```json
{
  "payload": "^3.0.0" // Must be peer dep for plugin
}
```

**Dev Dependencies Only:**

- Database adapters (`@payloadcms/db-*`)
- Storage adapters (`@payloadcms/storage-*`)
- Next.js and React (for dev environment)
- Testing frameworks

**Production Dependencies:**

- Minimal - keep plugin lightweight
- Only runtime requirements

### NPM Scripts Patterns

```json
{
  "dev": "next dev --turbo", // Development server
  "build": "build pipeline", // Production build
  "test": "all tests", // Run full test suite
  "test:int": "vitest run", // Integration tests only
  "test:e2e": "playwright test", // E2E tests only
  "lint": "eslint .", // Check code style
  "lint:fix": "eslint . --fix" // Auto-fix issues
}
```

## Plugin-Specific Guidance

### Admin Thumbnail Integration

The plugin supports displaying video thumbnails from streaming providers in the Payload admin UI:

```typescript
import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  upload: {
    adminThumbnail: ({ doc }) => {
      // Access the stream field's thumbnail URL
      return ((doc?.stream as { thumbnailUrl?: string })?.thumbnailUrl as string) || null
    },
  },
}
```

**Key Points:**

- The `adminThumbnail` callback receives the document with the `stream` field
- Cast to appropriate type since `stream` is dynamically added by the plugin
- Return `null` if no thumbnail is available (fallback to default)
- Thumbnails are automatically generated by streaming providers (e.g., Cloudflare Stream)

**Accessing Stream Metadata:**

```typescript
// The stream field structure:
type StreamField = {
  videoId: string // Provider's video ID
  status: string // 'pending' | 'ready' | 'error'
  thumbnailUrl?: string // Provider's thumbnail URL
  playbackUrl?: string // Provider's playback URL
  streamed: boolean // Whether video was successfully copied
  metadata?: string // JSON string of provider-specific metadata
}

// Access in hooks or components:
const stream = doc.stream as StreamField
if (stream?.status === 'ready') {
  const videoUrl = stream.playbackUrl
}
```

### Config Mutation Safety

**Preserving Existing Hooks:**

```typescript
// ✅ CORRECT - Preserves existing hooks
collection.hooks = {
  ...collection.hooks,
  afterOperation: [...(collection.hooks?.afterOperation || []), newHook],
}

// ❌ INCORRECT - Overwrites existing hooks
collection.hooks = {
  afterOperation: [newHook],
}
```

**Field Injection:**

- Always add new fields, never remove
- Maintain DB schema consistency
- Fields remain even when plugin is disabled

### Disabled Flag Behavior

```typescript
if (pluginOptions.disabled) {
  return config // Early return but schema changes persist
}
```

**Rationale**: Prevents migration issues when toggling plugin on/off.

### Metadata Transformation

When implementing adapters, map provider-specific responses:

```typescript
// Cloudflare-specific
{
  uid: 'abc123',
  status: { state: 'ready' },
  thumbnail: 'https://...',
  playback: { hls: 'https://...' }
}

// Transforms to generic StreamResponse
{
  id: 'abc123',
  status: 'ready',
  thumbnailUrl: 'https://...',
  playbackUrl: 'https://...'
}
```

**Benefits**:

- Consistent API across providers
- Easier to add new providers
- Simplified hook logic

### Admin UI Customization

**Custom Components:**

- Use Payload's `components` prop for thumbnails
- Server components for admin UI (RSC)
- Client components marked with `'use client'` directive

**Placement:**

- Primary fields: Top of form
- Metadata fields: Sidebar with `position: 'sidebar'`
- System fields: Read-only to prevent user modification

### Common Patterns

**Hook Context Access:**

```typescript
const { doc, req, collection, operation } = args
const payload = req.payload
const logger = payload.logger
```

**Document Updates:**

```typescript
await payload.update({
  collection: collection.slug,
  id: doc.id,
  data: { streamField: updatedData },
})
```

**Async Processing:**

```typescript
// Don't await if non-critical
copyVideoToStream(doc).catch((err) => {
  logger.error({ err, msg: 'Background process failed' })
})
```

## Development Workflow

**Current Branch**: `feat/stream-preview` (feature branch for video preview enhancements)

### Local Development

1. **Start dev server**: `pnpm dev`
2. **Generate types**: `pnpm dev:generate-types` (when schema changes)
3. **Run tests**: `pnpm test:int` or `pnpm test:e2e`
4. **Lint code**: `pnpm lint:fix`

### Adding a New Feature

1. Implement in `src/` (adapters, fields, or hooks)
2. Export from appropriate index file
3. Add integration test in `dev/int.spec.ts`
4. Add E2E test in `dev/e2e.spec.ts` if UI changes
5. Update types in `dev/payload-types.ts` with `dev:generate-types`
6. Run full test suite: `pnpm test`

### Adding a New Streaming Provider

1. Create `src/adapters/newProvider.ts`
2. Extend `StreamAdapter` class
3. Implement `copy()` and `getStatus()` methods
4. Create factory function: `export const newProviderAdapter = (config) => new NewProviderAdapter(config)`
5. Add types to `src/adapters/types.ts`
6. Export from `src/adapters/index.ts`
7. Add integration tests
8. Update README with example usage

### Pre-Publish Checklist

- [ ] All tests passing (`pnpm test`)
- [ ] No lint errors (`pnpm lint`)
- [ ] Build succeeds (`pnpm build`)
- [ ] Types generated correctly
- [ ] README updated with new features
- [ ] CHANGELOG updated (if manual)
- [ ] Version bumped (semantic-release handles this)

## Code Style

- **Quotes**: Single quotes
- **Semicolons**: No semicolons (Prettier config)
- **Trailing Commas**: Always (Prettier config)
- **Line Length**: 100 characters
- **Indentation**: 2 spaces
- **Naming**:
  - camelCase for functions and variables
  - PascalCase for classes and types
  - kebab-case for file names

## Common Pitfalls to Avoid

1. ❌ **Using `.ts` extensions in imports** → Use `.js` (ESM requirement)
2. ❌ **Overwriting existing hooks** → Always spread existing hooks
3. ❌ **Throwing errors in hooks** → Log errors, allow operation to complete
4. ❌ **Making Payload CMS a regular dependency** → Must be peer dependency
5. ❌ **Running tsc for transpilation** → Use SWC, tsc only for types
6. ❌ **Forgetting to handle signed URLs** → Check both plugin and adapter config
7. ❌ **Not preserving config when disabled** → Return config, don't strip fields
8. ❌ **Running multiple terminal commands in parallel** → Run sequentially
9. ❌ **Assuming video fields exist** → Always check `doc?.url` before processing
10. ❌ **Hard-coding collection names** → Use `collection.slug` from context

## Future Considerations

### Planned Features

- **`/client` export**: Client-side utilities for video player integration
  - Currently declared in `package.json` exports but `src/exports/client.ts` does not exist
  - Will provide React hooks and components for video playback
  - Example: `useStreamVideo()`, `<StreamPlayer />` component
- **`/rsc` export**: React Server Components for admin UI
  - Currently declared in `package.json` exports but `src/exports/rsc.ts` does not exist
  - Will provide server-side rendering utilities
  - Example: Enhanced thumbnail components, video metadata displays
- **Additional streaming providers**:
  - Mux (https://mux.com)
  - AWS MediaConvert
  - Azure Media Services
  - Custom RTMP endpoints
- **Webhook support**: Listen for provider status updates instead of polling
  - Real-time status updates when video processing completes
  - Automatic metadata sync on provider events
- **Batch processing**: Handle multiple videos in single operation
  - Bulk upload to streaming service
  - Queue management for large video libraries

### Extension Points

When adding new capabilities:

- Maintain backward compatibility
- Add feature flags for opt-in behavior
- Document breaking changes clearly
- Provide migration guides
- Update TypeScript types

## Additional Resources

- [Payload Plugin Documentation](https://payloadcms.com/docs/plugins/overview)
- [Payload Hooks Reference](https://payloadcms.com/docs/hooks/overview)
- [Cloudflare Stream API](https://developers.cloudflare.com/stream/api/)
- [ESM in Node.js](https://nodejs.org/api/esm.html)

---

**Last Updated**: November 22, 2025
**Plugin Version**: 3.x (published as `payload-video-stream` v1.0.13)
**Payload Compatibility**: 3.64.0+
**Repository**: https://github.com/webowodev/payload-video-stream
