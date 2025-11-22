import type { Field } from 'payload'

import type { StreamAdapter } from '../adapters/index.js'

import { streamPreviewField } from './preview/config.js'

export const streamField = ({ adapter }: { adapter: StreamAdapter }): Field => {
  return {
    name: 'stream',
    type: 'group',
    admin: {
      condition: (_, siblingData) => {
        return siblingData?.mimeType?.startsWith('video/')
      },
      hidden: false,
      position: 'sidebar',
    },
    fields: [
      streamPreviewField(adapter),
      {
        name: 'videoId',
        type: 'text',
        admin: {
          readOnly: true,
        },
      },
      {
        name: 'thumbnailUrl',
        type: 'text',
        admin: {
          readOnly: true,
        },
      },
      {
        name: 'readyToStream',
        type: 'checkbox',
        admin: {
          hidden: true,
          readOnly: true,
        },
        defaultValue: false,
      },
      {
        name: 'provider',
        type: 'text',
        admin: {
          readOnly: true,
        },
      },
      {
        name: 'error',
        type: 'textarea',
        admin: {
          hidden: true,
          readOnly: true,
        },
      },
      {
        name: 'requireSignedURLs',
        type: 'checkbox',
        admin: {
          description:
            'If enabled, the video stream URLs will require signed URLs for access, enhancing security.',
          // hidden: true,
          readOnly: true,
        },
        defaultValue: false,
        label: 'Require Signed URL for Streaming',
      },
    ],
  }
}

// generate types from field
