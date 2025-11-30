import type { StreamAdapter } from './streamAdapter.js'
import type { CopyVideoRequest, StreamFieldData, StreamResponse } from './types.js'

type CloudflareStreamAPIResponse = {
  errors?: { code: number; message: string }[]
  messages?: string[]
  result: {
    created?: string
    duration?: number
    input?: {
      height: number
      width: number
    }
    meta?: {
      [key: string]: boolean | null | number | string
    }
    modified?: string
    playback?: {
      dash?: string
      hls?: string
    }
    readyToStream: boolean
    readyToStreamAt?: string
    requireSignedURLs?: boolean
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
          durationInSeconds: response.result.duration,
          height: response.result.input?.height,
          meta: response.result.meta
            ? {
                name:
                  typeof response.result.meta.name === 'string' ? response.result.meta.name : '',
                ...response.result.meta,
              }
            : undefined,
          readyToStreamAt: response.result.readyToStreamAt,
          videoId: response.result.uid,
          width: response.result.input?.width,
        }
      : undefined,
    success: response.success,
  }
}

class CloudflareStreamAdapter implements StreamAdapter {
  private readonly accountId: string
  private readonly apiToken: string
  private readonly baseUrl: string
  private readonly customerSubdomain: string
  private readonly generateDownloads: { audio?: boolean; video?: boolean } | boolean
  private readonly requireSignedURLs: boolean

  readonly providerName = 'cloudflare_stream'

  constructor(
    apiToken: string,
    accountId: string,
    customerSubdomain: string,
    requireSignedURLs = false,
    generateDownloads: { audio?: boolean; video?: boolean } | boolean = true,
  ) {
    this.apiToken = apiToken
    this.accountId = accountId
    this.baseUrl = 'https://api.cloudflare.com/client/v4'
    this.requireSignedURLs = requireSignedURLs
    this.generateDownloads = generateDownloads
    this.customerSubdomain = customerSubdomain
  }

  /**
   * Generate download links for a video or audio
   *
   * @param videoId
   */
  private async generateDownloadLinks(videoId: string): Promise<void> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/stream/${videoId}/downloads`

    const urls = []

    if (this.isGenerateAudioDownloadEnabled) {
      urls.push(`${url}/audio`)
    }

    if (this.isGenerateVideoDownloadEnabled) {
      urls.push(`${url}`)
    }

    try {
      await Promise.all(
        urls.map(async (endpoint) => {
          const response = await fetch(endpoint, {
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              'Content-Type': 'application/json',
            },
            method: 'POST',
          })

          if (!response.ok) {
            throw new Error(`Failed to generate download link: ${response.statusText}`)
          }
        }),
      )
    } catch (error) {
      console.error('Error generating download links:', error)
    }
  }

  /**
   * Copies a video within Cloudflare Stream.
   *
   * @param params
   * @returns
   */
  async copyVideo(params: CopyVideoRequest): Promise<StreamResponse> {
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
    if (this.requireSignedURLs && body.result) {
      return await this.markRequireSignedURLs(body.result.uid)
    }

    return streamResponseFromCloudflareStreamAPI(body)
  }

  /**
   * Deletes a video by its ID
   *
   * @param videoId
   */
  async delete(videoId: string): Promise<void> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/stream/${videoId}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
      },
      method: 'DELETE',
    })

    if (!response.ok) {
      throw new Error(`Failed to delete video: ${response.statusText}`)
    }
  }

  /**
   * Render the video player HTML by video ID
   *
   * @param videoId
   * @returns
   */
  async getHTMLVideoPlayer(stream: StreamFieldData): Promise<null | string> {
    const { requireSignedURLs, videoId } = stream

    let token = videoId

    if (requireSignedURLs) {
      const signedToken = await this.getSignedToken(videoId)
      token = signedToken || videoId
    }

    const videoUrl = `${this.customerSubdomain}/${token}/iframe`

    return `<iframe
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
        frameBorder="0"
        sandbox="allow-scripts allow-same-origin"
        src="${videoUrl}"
        title="Example Stream video"
        width="100%"
      />`
  }

  /**
   * Get the signed token by video ID
   *
   * @param videoId
   * @returns
   */
  async getSignedToken(videoId: string): Promise<null | string> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/stream/${videoId}/token`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Failed to get signed token: ${response.statusText}`)
    }

    const body = await response.json()

    if (body.result && body.result.token) {
      return body.result.token as string
    }

    return null
  }

  /**
   * Get the status of a video by its ID
   *
   * @param videoId
   * @returns
   */
  async getStatus(videoId: string): Promise<StreamResponse> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/stream/${videoId}`

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

    const result = streamResponseFromCloudflareStreamAPI(body)

    // Generate download links if enabled
    if (
      (this.isGenerateAudioDownloadEnabled || this.isGenerateVideoDownloadEnabled) &&
      result.result?.readyToStream
    ) {
      await this.generateDownloadLinks(videoId)
    }

    return result
  }

  /**
   * Tag a video as requiring signed URLs
   *
   * @param videoId
   * @returns
   */
  async markRequireSignedURLs(videoId: string): Promise<StreamResponse> {
    const url = `${this.baseUrl}/accounts/${this.accountId}/stream/${videoId}`

    const response = await fetch(url, {
      body: JSON.stringify({
        requireSignedURLs: true,
        uid: videoId,
      }),
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    })

    if (!response.ok) {
      throw new Error(`Failed to mark video as requiring signed URLs: ${response.statusText}`)
    }

    const body = await response.json()

    const result = streamResponseFromCloudflareStreamAPI(body)

    return result
  }

  private get isGenerateAudioDownloadEnabled(): boolean {
    if (typeof this.generateDownloads === 'boolean') {
      return this.generateDownloads
    }
    return this.generateDownloads.audio === true
  }

  private get isGenerateVideoDownloadEnabled(): boolean {
    if (typeof this.generateDownloads === 'boolean') {
      return this.generateDownloads
    }
    return this.generateDownloads.video === true
  }
}

export const cloudflareStreamAdapter = ({
  accountId,
  apiToken,
  customerSubdomain,
  generateDownloads,
  requireSignedURLs,
}: {
  accountId: string
  apiToken: string
  customerSubdomain: string
  generateDownloads?: { audio?: boolean; video?: boolean } | boolean
  requireSignedURLs?: boolean
}): StreamAdapter => {
  return new CloudflareStreamAdapter(
    apiToken,
    accountId,
    customerSubdomain,
    requireSignedURLs,
    generateDownloads ?? true,
  )
}
