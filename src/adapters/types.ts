export type StreamVideoMeta = {
  [key: string]: boolean | null | number | string // More specific types for metadata
  name: string
}

export type CopyVideoRequest = {
  meta: StreamVideoMeta
  url: string
}

export type StreamResponse = {
  errors?: { code: number; message: string }[]
  messages?: string[]
  result?: {
    created?: string
    durationInSeconds?: number
    height?: number
    meta?: StreamVideoMeta
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
    videoId: string
    width?: number
  }
  success: boolean
}

export type StreamFieldData = {
  downloadable?: boolean
  durationInSeconds?: number
  error: string
  errorAt?: string
  height?: number
  provider: string
  readyToStream: boolean
  readyToStreamAt?: string
  requireSignedURLs: boolean
  size?: number
  thumbnailUrl: string
  videoId: string
  width?: number
}
