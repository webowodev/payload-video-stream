import type { CollectionAfterOperationHook, CollectionBeforeDeleteHook } from 'payload'
import type { StreamAdapter } from 'src/adapters/streamAdapter.js'

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
      // if there is a stream uid but not ready to stream, fetch latest status
      const response = await adapter.getStatus(result.stream.videoId)

      // update video document with latest stream status
      await req.payload.update({
        id: result.id,
        collection: collectionSlug,
        data: {
          stream: {
            durationInSeconds: response.result?.durationInSeconds,
            error: response.result?.status?.errorReasonText || '',
            height: response.result?.height,
            provider: adapter.providerName || '',
            readyToStream: response.result?.readyToStream,
            readyToStreamAt: response.result?.readyToStreamAt,
            requireSignedURLs: response.result?.requireSignedURLs || false,
            size: response.result?.size,
            thumbnailUrl: response.result?.thumbnail || '',
            width: response.result?.width,
          },
        },
        req,
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
  return async ({ operation, req, result }) => {
    if (
      operation === 'findByID' &&
      !result.stream.readyToStream &&
      !result.stream.videoId &&
      result.mimeType?.startsWith('video/')
    ) {
      try {
        let videoUrl = `${req.protocol}//${req.host}${result.url}`

        if (requireSignedURLs) {
          // get signed URL for video
          const signedVideoUrl = await fetch(`${req.protocol}//${req.host}${result.url}`, {
            headers: {
              accept: 'application/json',
              cookie: req.headers.get('cookie') || '',
            },
            method: 'GET',
          }).then((r) => r.url)
          videoUrl = signedVideoUrl
        }

        // copy video to stream
        const response = await adapter.copyVideo({
          meta: {
            name: result.filename,
          },
          url: videoUrl,
        })

        // update video document with stream uid and thumbnail url
        if (response.result) {
          await req.payload.update({
            id: result.id,
            collection: collectionSlug,
            data: {
              stream: {
                provider: adapter.providerName || '',
                readyToStream: response.result.readyToStream,
                requireSignedURLs: response.result.requireSignedURLs || false,
                thumbnailUrl: response.result.thumbnail,
                videoId: response.result.videoId,
              },
            },
            req,
          })
        }
      } catch (e) {
        req.payload.logger.error({ err: e, msg: 'Error copying video to streaming service' })
      }
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
    const doc = await req.payload.findByID({
      id,
      collection: collectionSlug,
      req,
    })

    if (doc?.stream?.videoId) {
      try {
        // delete video from streaming service
        await adapter.delete(doc.stream.videoId)
      } catch (e) {
        req.payload.logger.error({ err: e, msg: 'Error deleting video from streaming service' })
      }
    }
  }
}
