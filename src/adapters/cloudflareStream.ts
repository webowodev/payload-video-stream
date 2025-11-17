import type { StreamAdapter } from './streamAdapter.js'
import type { CopyVideoRequest, StreamResponse } from './types.js'
type CloudflareStreamAPIResponse = {
  errors?: { code: number; message: string }[]
  messages?: string[]
  result: {
    created?: string
    meta?: {
      [key: string]: boolean | null | number | string
    }
    modified?: string
    playback?: {
      dash?: string
      hls?: string
    }
    readyToStream: boolean
    requiresSignedURLs?: boolean
    size?: number
    status?: {
      errorReasonCode?: string
      errorReasonText?: string
      progress?: number
      state: string
    }
    thumbnail?: string
    uid: string
  }
  success: boolean
}

const streamResponseFromCloudflareStreamAPI = (
  response: CloudflareStreamAPIResponse,
): StreamResponse => {
  // Map Cloudflare Stream response to our StreamResponse type
  return {
    errors: response.errors,
    messages: response.messages,
    result: response.result
      ? {
          ...response.result,
          meta: response.result.meta
            ? {
                name:
                  typeof response.result.meta.name === 'string' ? response.result.meta.name : '',
                ...response.result.meta,
              }
            : undefined,
          videoId: response.result.uid,
        }
      : undefined,
    success: response.success,
  }
}

class CloudflareStreamAdapter implements StreamAdapter {
  private readonly accountId: string
  private readonly apiToken: string
  private readonly baseUrl: string
  private readonly requiresSignedURLs: boolean

  constructor(apiToken: string, accountId: string, requiresSignedURLs = false) {
    this.apiToken = apiToken
    this.accountId = accountId
    this.baseUrl = 'https://api.cloudflare.com/client/v4'
    this.requiresSignedURLs = requiresSignedURLs
  }

  /**
   * Copies a video within Cloudflare Stream.
   *
   * @param params
   * @returns
   */
  async copyVideo(params: CopyVideoRequest): Promise<StreamResponse> {
    console.log('CloudflareStreamAdapter: copyVideo called with params', params)
    const url = `${this.baseUrl}/accounts/${this.accountId}/stream/copy`

    const response = await fetch(url, {
      body: JSON.stringify(params),
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    const body = await response.json()

    if (!response.ok) {
      throw new Error(`Failed to copy video: ${response.statusText}`, body)
    }

    // If configured, mark the video as requiring signed URLs
    if (this.requiresSignedURLs && body.result) {
      return await this.markRequiresSignedURLs(body.result.uid)
    }

    return streamResponseFromCloudflareStreamAPI(body)
  }

  /**
   * Get the status of a video by its ID
   *
   * @param videoId
   * @returns
   */
  async getStatus(videoId: string): Promise<StreamResponse> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/stream/${videoId}`

    console.log('CloudflareStreamAdapter: getStatus called for videoId', videoId, url)

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`Failed to get video status: ${response.statusText}`)
    }

    const body = await response.json()

    return streamResponseFromCloudflareStreamAPI(body)
  }

  /**
   * Tag a video as requiring signed URLs
   *
   * @param videoId
   * @returns
   */
  async markRequiresSignedURLs(videoId: string): Promise<StreamResponse> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/stream/${videoId}`

    const response = await fetch(url, {
      body: JSON.stringify({
        requiresSignedURLs: true,
      }),
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    })

    if (!response.ok) {
      throw new Error(`Failed to mark video as requiring signed URLs: ${response.statusText}`)
    }

    const body = await response.json()

    return streamResponseFromCloudflareStreamAPI(body)
  }
}

export const cloudflareStreamAdapter = ({
  accountId,
  apiToken,
  requiresSignedURLs,
}: {
  accountId: string
  apiToken: string
  requiresSignedURLs?: boolean
}): StreamAdapter => {
  return new CloudflareStreamAdapter(apiToken, accountId, requiresSignedURLs)
}
