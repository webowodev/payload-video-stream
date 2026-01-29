import type { ServerComponentProps } from 'payload'

import { StreamPreviewer } from 'payload-video-stream/client'
import React, { Suspense } from 'react'

import type { StreamAdapter, StreamFieldData } from '../../adapters/index.js'

type Props = {
  adapter: StreamAdapter
} & ServerComponentProps

function LoadingIndicator() {
  return (
    <div style={{ color: '#666', padding: '1rem', textAlign: 'center' }}>
      <div style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
        <div
          style={{
            animation: 'spin 1s linear infinite',
            border: '3px solid #f3f3f3',
            borderRadius: '50%',
            borderTop: '3px solid #333',
            height: '24px',
            width: '24px',
          }}
        />
      </div>
      <p style={{ fontSize: '0.875rem', margin: 0 }}>Loading video player...</p>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}

async function StreamPreview(props: Props) {
  const stream = props.siblingData as StreamFieldData | undefined

  let html = null

  if (stream?.readyToStream && stream.videoId) {
    html = (await props.adapter.getHTMLVideoPlayer(stream)) || '<p>Video preview not available.</p>'
  }

  return <StreamPreviewer error={stream?.error} html={html} readyToStream={stream?.readyToStream} />
}

export function getStreamPreviewField(props: Props) {
  return (
    <Suspense fallback={<LoadingIndicator />}>
      <StreamPreview {...props} />
    </Suspense>
  )
}
