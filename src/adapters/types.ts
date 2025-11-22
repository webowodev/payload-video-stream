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
    meta?: StreamVideoMeta
    modified?: string
    playback?: {
      dash?: string
      hls?: string
    }
    readyToStream: boolean
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
  }
  success: boolean
}

export type StreamFieldData = {
  error: string
  provider: string
  readyToStream: boolean
  requireSignedURLs: boolean
  thumbnailUrl: string
  videoId: string
}
