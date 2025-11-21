# Payload Video Streaming Plugin

A [Payload CMS](https://payloadcms.com) plugin that enables seamless video uploads directly to streaming providers from Payload upload collections. This plugin automatically handles video file uploads to streaming platforms, providing optimized video delivery for your Payload CMS applications.

## Features

- 🎥 Direct video uploads to streaming providers from Payload upload collections
- ☁️ **Cloudflare Stream** support (currently available)
- 🔌 Extensible adapter architecture for adding more streaming providers
- 🔄 Automatic video processing and optimization
- 📊 Stream metadata integration with Payload documents
- 🎯 Type-safe configuration with TypeScript support

## Supported Providers

Currently supported:
- **Cloudflare Stream** - Complete integration with Cloudflare's video streaming platform

Planned support:
- Mux
- AWS MediaConvert
- Azure Media Services
- Other streaming API providers

## Installation

```bash
npm install payload-video-stream
# or
yarn add payload-video-stream
# or
pnpm add payload-video-stream
```

## Quick Start

### 1. Configure the Plugin

Add the plugin to your `payload.config.ts`:

```ts
import { buildConfig } from 'payload/config'
import { videoStream } from 'payload-video-stream'
import { cloudflareStreamAdapter } from 'payload-video-stream/adapters'

export default buildConfig({
  plugins: [
    // configure your s3 storage configuration
    s3Storage({
      bucket: process.env.S3_BUCKET ?? 'romonoa',
      clientUploads: true, // enable client-side uploads
      collections: {
        video: true,
      },
      config: {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
        },
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        // ... Other S3 configuration
      },
      signedDownloads: {
        // expires in 24 hours
        expiresIn: 60 * 60 * 24,
      }, // enable signed download URLs
    }),    

    // configure video stream plugin
    videoStream({
      collections: {
        media: true,
      },

      // configure default adapter, currently only support cloudflare stream adapter
      defaultAdapter: cloudflareStreamAdapter({
        accountId: process.env.CLOUDFLARE_STREAM_ACCOUNT_ID || '',
        apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || '',
        requiresSignedURLs: true // OPTIONAL: enable this if you enabled the signed downloads on your storage so the plugin will use the signed s3 url to the cloudflare stream copy video url function
      }),
    }),
  ],
  // ... rest of your config
})
```

### 2. Environment Variables

Create a `.env` file with your streaming provider credentials:

```env
CLOUDFLARE_STREAM_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_STREAM_ACCOUNT_ID=your_cloudflare_account_id
```

### 3. Create a Video Collection

The plugin works with Payload upload collections:

```ts
import type { CollectionConfig } from 'payload/types'

export const Videos: CollectionConfig = {
  slug: 'videos',
  upload: {
    mimeTypes: ['video/*'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
    },
  ],
}
```

## Configuration Options

### Plugin Options

```ts
type VideoStreamConfig = {
  collections?: {
    [collectionSlug: string]: boolean
  }
  enabled?: boolean
  defaultAdapter: StreamAdapter
  disabled?: boolean
  requiresSignedURLs?: boolean
}
```

### Cloudflare Stream Configuration

To use Cloudflare Stream:

1. Sign up for [Cloudflare Stream](https://www.cloudflare.com/products/cloudflare-stream/)
2. Get your Account ID from the Cloudflare dashboard
3. Create an API token with Stream permissions
4. Add credentials to your environment variables

## Development

### Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm/yarn
- A Payload CMS project for testing

### Setup

1. Clone the repository:
```bash
git clone https://github.com/webowodev/payload-video-stream.git
cd payload-video-streaming
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up the dev environment:
```bash
cd dev
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
DATABASE_URI=postgres://root:secret@127.0.0.1:5432/videostream
PAYLOAD_SECRET=your-secret-key
CLOUDFLARE_STREAM_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_STREAM_ACCOUNT_ID=your_cloudflare_account_id
```

5. Start the development server:
```bash
pnpm dev
```

The dev server will be available at [http://localhost:3000](http://localhost:3000)

### Project Structure

```
payload-video-streaming/
├── src/
│   ├── index.ts              # Main plugin export
│   ├── adapters/
│   │   ├── streamAdapter.ts  # Base adapter interface
│   │   ├── cloudflareStream.ts # Cloudflare implementation
│   │   └── types.ts          # Adapter type definitions
│   ├── fields/
│   │   └── stream.ts         # Custom field definitions
│   └── hooks/
│       └── afterOperation.ts # Upload hooks
├── dev/                      # Development Payload instance
│   ├── payload.config.ts
│   └── app/                  # Next.js app router
└── test-results/             # Test output
```

### Testing

Run the test suite:

```bash
pnpm test
```

Run tests in watch mode:
```bash
pnpm test:watch
```

Run integration tests:
```bash
pnpm test:int
```

Run E2E tests:
```bash
pnpm test:e2e
```

### Building

Build the plugin for production:

```bash
pnpm build
```

## Contributing

We welcome contributions! Here's how you can help:

### Adding a New Streaming Provider

1. Create a new adapter in `src/adapters/`:
```ts
// src/adapters/yourProvider.ts
import type { StreamAdapter } from './streamAdapter'

export class YourProviderAdapter implements StreamAdapter {
  async upload(file: File): Promise<StreamResult> {
    // Implement upload logic
  }
  
  async delete(videoId: string): Promise<void> {
    // Implement delete logic
  }
}
```

2. Export your adapter in `src/adapters/index.ts`

3. Add configuration types in `src/adapters/types.ts`

4. Write tests for your adapter

5. Update documentation

### Contribution Guidelines

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `pnpm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Style

- Follow the existing code style
- Use TypeScript for all new code
- Add JSDoc comments for public APIs
- Run `pnpm lint` before committing

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `test:` Test additions or changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## Roadmap

- [x] Cloudflare Stream adapter
- [ ] Mux adapter
- [ ] AWS MediaConvert adapter
- [ ] Azure Media Services adapter
- [ ] Video thumbnail generation
- [ ] Webhook support for processing status
- [ ] Custom video player integration
- [ ] Analytics integration

## License

MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Support

- 📖 [Documentation](https://github.com/webowodev/payload-video-stream#readme)
- 🐛 [Issue Tracker](https://github.com/webowodev/payload-video-stream/issues)
- 💬 [Discussions](https://github.com/webowodev/payload-video-stream/discussions)

## Acknowledgments

Built with [Payload CMS](https://payloadcms.com) - The most powerful TypeScript headless CMS.

---

Made with ❤️ by [webowodev](https://webowo.dev)
