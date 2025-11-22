import type { Field } from 'payload'

import type { StreamAdapter } from '../../adapters/index.js'

export const streamPreviewField = (adapter: StreamAdapter): Field => {
  return {
    name: 'preview',
    type: 'ui',
    admin: {
      components: {
        Field: {
          path: 'payload-video-stream/rsc#getStreamPreviewField',
          serverProps: {
            adapter,
          },
        },
      },
    },
  }
}
