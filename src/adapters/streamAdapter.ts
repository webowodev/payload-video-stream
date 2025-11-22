import type { CopyVideoRequest, StreamFieldData, StreamResponse } from './types.js'

export abstract class StreamAdapter {
  /**
   * provider name
   */
  abstract readonly providerName: string

  /**
   * Copy video to streaming service by video url
   *
   * @param params
   */
  abstract copyVideo(params: CopyVideoRequest): Promise<StreamResponse>

  /**
   * Delete a video by its ID
   *
   * @param videoId
   */
  abstract delete(videoId: string): Promise<void>

  /**
   * Render the video player HTML by video ID
   *
   * @param videoId
   */
  abstract getHTMLVideoPlayer(stream: StreamFieldData): Promise<null | string>

  /**
   * Get signed token by video ID
   *
   * @param videoId
   */
  abstract getSignedToken(videoId: string): Promise<null | string>

  /**
   * Get the status of a video by its ID
   *
   * @param videoId
   */
  abstract getStatus(videoId: string): Promise<StreamResponse>
}
