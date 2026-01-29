import type { TaskConfig } from 'payload'

import type { StreamAdapter } from '../adapters/streamAdapter.js'

import { streamingService } from '../services/streamingService.js'

export const updateStreamStatusTask: (adapter: StreamAdapter) => TaskConfig = (adapter) => {
  const slug = `payloadStreamUpdateStatusFor${adapter.providerName}`

  return {
    slug,
    handler: async ({ input, req }) => {
      req.payload.logger.info({ input, msg: `Starting task: ${slug}` })
      const service = streamingService({
        adapter,
        req,
      })

      const { collectionSlug, documentId } = input as { collectionSlug: string; documentId: string }

      req.payload.logger.info({
        msg: `${slug}: find document by ID ${documentId} in collection ${collectionSlug}`,
      })

      const doc = await req.payload.findByID({
        id: documentId,
        collection: collectionSlug,
        req,
      })

      req.payload.logger.info({
        doc,
        msg: `${slug}: document fetched`,
      })

      if (doc?.stream?.readyToStream === false) {
        const response = await service.updateStatus({
          collectionSlug,
          doc,
        })

        if (response) {
          const { result } = response

          if (result?.readyToStream === false) {
            // re-queue task if not ready to stream yet
            req.payload.logger.info({
              msg: `${slug}: video not ready to stream yet, re-queuing task for document ID ${documentId}`,
            })

            await service.queueUpdateStatusTask({
              collectionSlug,
              documentId,
            })
          }
        }
      }

      return {
        output: {
          data: {
            collectionSlug,
            documentId,
          },
          message: 'Update stream status task executed',
        },
      }
    },
    inputSchema: [
      {
        name: 'collectionSlug',
        type: 'text',
        required: true,
      },
      {
        name: 'documentId',
        type: 'text',
        required: true,
      },
    ],
    retries: 3,
  }
}
