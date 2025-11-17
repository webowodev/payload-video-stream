import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { r2Storage } from '@payloadcms/storage-r2'
import { s3Storage } from '@payloadcms/storage-s3'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import path from 'path'
import { buildConfig } from 'payload'
import { payloadVideoStreaming } from 'payload-video-streaming'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { cloudflareStreamAdapter } from '../src/adapters/cloudflareStream.js'
import { testEmailAdapter } from './helpers/testEmailAdapter.js'
import { seed } from './seed.js'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (!process.env.ROOT_DIR) {
  process.env.ROOT_DIR = dirname
}

const buildConfigWithMemoryDB = async () => {
  if (process.env.NODE_ENV === 'test') {
    const memoryDB = await MongoMemoryReplSet.create({
      replSet: {
        count: 3,
        dbName: 'payloadmemory',
      },
    })

    process.env.DATABASE_URI = `${memoryDB.getUri()}&retryWrites=true`
  }

  return buildConfig({
    admin: {
      importMap: {
        baseDir: path.resolve(dirname),
      },
    },
    collections: [
      {
        slug: 'posts',
        fields: [],
      },
      {
        slug: 'media',
        fields: [],
        upload: {
          adminThumbnail: ({ doc }) => {
            // Return the URL from your custom `externalUrl` field
            return ((doc?.stream as { thumbnailUrl?: string })?.thumbnailUrl as string) || null
          },
          staticDir: path.resolve(dirname, 'media'),
        },
      },
    ],
    db: postgresAdapter({
      pool: {
        connectionString: process.env.DATABASE_URI || '',
      },
    }),
    editor: lexicalEditor(),
    email: testEmailAdapter,
    onInit: async (payload) => {
      await seed(payload)
    },
    plugins: [
      s3Storage({
        bucket: process.env.S3_BUCKET ?? 'romonoa',
        clientUploads: true, // enable client-side uploads
        collections: {
          media: {
            prefix: 'media',
            signedDownloads: {
              // expires in 24 hours
              expiresIn: 60 * 60 * 24,
            },
          },
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
      payloadVideoStreaming({
        collections: {
          media: true,
        },
        defaultAdapter: cloudflareStreamAdapter({
          accountId: process.env.CLOUDFLARE_STREAM_ACCOUNT_ID || '',
          apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || '',
          requiresSignedURLs:
            process.env.CLOUDFLARE_STREAM_REQUIRES_SIGNED_URLS === 'true' || false,
        }),
        requiresSignedURLs: true,
      }),
    ],
    secret: process.env.PAYLOAD_SECRET || 'test-secret_key',
    sharp,
    typescript: {
      outputFile: path.resolve(dirname, 'payload-types.ts'),
    },
  })
}

export default buildConfigWithMemoryDB()
