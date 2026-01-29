import type { CollectionAfterOperationHook, CollectionBeforeDeleteHook } from 'payload'

import type { StreamAdapter } from '../adapters/streamAdapter.js'

import { streamingService } from '../services/streamingService.js'

export const updateStatusHook = (
  adapter: StreamAdapter,
  collectionSlug: string,
): CollectionAfterOperationHook => {
  return async ({ operation, req, result }) => {
    if (
      operation === 'findByID' &&
      !result.stream.readyToStream &&
      result.mimeType?.startsWith('video/') &&
      result.stream.videoId
    ) {
      await streamingService({ adapter, req }).updateStatus({
        collectionSlug,
        doc: result,
      })
    }

    return result
  }
}

export const copyVideo = (
  adapter: StreamAdapter,
  collectionSlug: string,
  requireSignedURLs = false,
): CollectionAfterOperationHook => {
  return ({ operation, req, result }) => {
    if (
      operation === 'create' &&
      !result.stream.readyToStream &&
      !result.stream.videoId &&
      result.mimeType?.startsWith('video/')
    ) {
      setTimeout(async () => {
        await streamingService({ adapter, req }).copyVideoToStreamingPlatform({
          collectionSlug,
          doc: result,
          requireSignedURLs,
        })
      }, 1000) // delay to allow initial create operation to complete
    }

    return result
  }
}

// hook to delete video before delete hook
export const deleteVideo = (
  adapter: StreamAdapter,
  collectionSlug: string,
): CollectionBeforeDeleteHook => {
  return async ({ id, req }) => {
    // fetch the document to get the stream videoId
    req.payload.logger.info({ id, msg: 'Fetching document to delete video from streaming service' })

    const doc = await req.payload.findByID({
      id,
      collection: collectionSlug,
      req,
    })

    // delete video from streaming service if videoId exists
    await streamingService({ adapter, req }).delete(doc)
  }
}
