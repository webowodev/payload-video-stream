import type { CollectionAfterOperationHook } from 'payload'
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
      const status = await adapter.getStatus(result.stream.videoId)

      // update video document with latest stream status
      await req.payload.update({
        id: result.id,
        collection: collectionSlug,
        data: {
          stream: {
            error: status.result?.status?.errorReasonText || '',
            readyToStream: status.result?.readyToStream,
            thumbnailUrl: status.result?.thumbnail || '',
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
  requiresSignedURLs = false,
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

        if (requiresSignedURLs) {
          // get signed URL for video.
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
                readyToStream: response.result.readyToStream,
                thumbnailUrl: response.result.thumbnail,
                videoId: response.result.videoId,
              },
            },
            req,
          })
        }
      } catch (e) {
        console.log('Error copying video to streaming service:', e)
      }
    }

    return result
  }
}
