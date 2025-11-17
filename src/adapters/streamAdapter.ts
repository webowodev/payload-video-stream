import type { CopyVideoRequest, StreamResponse } from './types.js'

export abstract class StreamAdapter {
  /**
   * Copy video to streaming service by video url
   *
   * @param params
   */
  abstract copyVideo(params: CopyVideoRequest): Promise<StreamResponse>

  /**
   * Get the status of a video by its ID
   *
   * @param videoId
   */
  abstract getStatus(videoId: string): Promise<StreamResponse>
}
