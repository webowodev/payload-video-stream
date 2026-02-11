import type { JsonObject, PayloadRequest, TypeWithID } from 'payload'
import type { StreamResponse } from 'src/adapters/types.js'

import type { StreamAdapter } from '../adapters/streamAdapter.js'

const getVideoUrl = async (
  req: PayloadRequest,
  doc: JsonObject & TypeWithID,
  requireSignedURLs?: boolean,
): Promise<string> => {
  let videoUrl = doc.url

  // when videoUrl doesn't start with protocol e.g http or https, prepend host
  if (!/^https?:\/\//i.test(videoUrl)) {
    videoUrl = `${req.protocol}//${req.host}${doc.url}`
  }

  if (requireSignedURLs) {
    // get signed URL for video
    const signedVideoUrl = await fetch(videoUrl, {
      headers: {
        accept: 'application/json',
        cookie: req.headers.get('cookie') || '',
      },
      method: 'GET',
      redirect: 'manual',
    }).then((r) => r.headers.get('location') || '')
    videoUrl = signedVideoUrl
  }

  return videoUrl
}

export const streamingService = ({
  adapter,
  req,
}: {
  adapter: StreamAdapter
  req: PayloadRequest
}) => {
  return {
    /**
     *
     * Update stream status
     *
     * @param param0
     */
    updateStatus: async ({
      collectionSlug,
      doc,
    }: {
      collectionSlug: string
      doc: JsonObject & TypeWithID
    }): Promise<null | StreamResponse> => {
      try {
        req.payload.logger.info({
          msg: 'Fetching latest stream status for videoId: ' + doc.stream.videoId,
        })

        const response = await adapter.getStatus(doc.stream.videoId)

        // update video document with latest stream status
        req.payload.logger.info({
          id: doc.id,
          msg: 'Updating video document with latest stream status: collection=' + collectionSlug,
          response,
        })

        await req.payload.update({
          id: doc.id,
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

        req.payload.logger.info({
          msg:
            'Video document updated with latest stream status for videoId: ' + doc.stream.videoId,
          stream: doc.stream,
        })

        return response
      } catch (error) {
        req.payload.logger.error({ err: error, msg: 'Error fetching stream status' })
        return null
      }
    },

    /**
     *
     * Copy video to streaming platform
     *
     * @param param0
     */
    copyVideoToStreamingPlatform: async ({
      collectionSlug,
      doc,
      requireSignedURLs,
    }: {
      collectionSlug: string
      doc: JsonObject & TypeWithID
      requireSignedURLs?: boolean
    }): Promise<{ error?: string; success: boolean }> => {
      if (!doc.mimeType?.startsWith('video/')) {
        return { error: 'Not a video file', success: false }
      }
      try {
        req.payload.logger.info({
          doc,
          msg: 'Preparing to copy video to streaming service',
        })

        const videoUrl = await getVideoUrl(req, doc, requireSignedURLs)

        req.payload.logger.info({ msg: 'Copying video to streaming service', videoUrl })

        // copy video to stream
        const response = await adapter.copyVideo({
          meta: {
            name: doc.filename,
          },
          url: videoUrl,
        })

        // update video document with stream uid and thumbnail url
        if (response.result) {
          req.payload.logger.info({ msg: 'Video copied to streaming service', response })

          const stream = {
            provider: adapter.providerName || '',
            readyToStream: response.result.readyToStream,
            requireSignedURLs: response.result.requireSignedURLs || false,
            thumbnailUrl: response.result.thumbnail,
            videoId: response.result.videoId,
          }

          req.payload.logger.info({
            msg:
              'Updating video document with streaming info: collection=' +
              collectionSlug +
              ', id=' +
              doc.id,
            stream,
          })

          // update collection stream data
          await req.payload.update({
            id: doc.id,
            collection: collectionSlug,
            data: {
              stream,
            },
            req,
          })
        }

        return {
          success: true,
        }
      } catch (error) {
        req.payload.logger.error({ err: error, msg: 'Error copying video to streaming service' })

        // update video document with error
        await req.payload.update({
          id: doc.id,
          collection: collectionSlug,
          data: {
            stream: {
              error: 'Error copying video to streaming service',
            },
          },
          req,
        })

        return {
          error: 'Error copying video to streaming service',
          success: false,
        }
      }
    },

    delete: async (doc: JsonObject & TypeWithID): Promise<void> => {
      try {
        if (doc?.stream?.videoId) {
          throw new Error('No videoId found in document stream data')
        }
        req.payload.logger.info({
          msg: 'Deleting video from streaming service',
          stream: doc.stream,
        })
        // delete video from streaming service
        await adapter.delete(doc.stream.videoId)

        req.payload.logger.info({
          msg: 'Video deleted from streaming service',
          stream: doc.stream,
        })
      } catch (e) {
        req.payload.logger.error({ err: e, msg: 'Error deleting video from streaming service' })
      }
    },

    queueUpdateStatusTask: async ({
      collectionSlug,
      documentId,
    }: {
      collectionSlug: string
      documentId: string
    }): Promise<void> => {
      try {
        req.payload.logger.info({ collectionSlug, documentId, msg: 'Queueing update status task' })

        const task = `payloadStreamUpdateStatusFor${adapter.providerName}`

        // queue the update status task
        await req.payload.jobs.queue({
          input: {
            collectionSlug,
            documentId,
          },
          queue: 'payloadVideoStream',
          task,
        })

        req.payload.logger.info({ documentId, msg: 'Update status task queued', task })
      } catch (error) {
        req.payload.logger.error({ err: error, msg: 'Error queueing update status task' })
      }
    },
  }
}
