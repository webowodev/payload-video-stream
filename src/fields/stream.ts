import type { Field } from 'payload'

export const streamField: Field = {
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
    {
      name: 'videoId',
      type: 'text',
    },
    {
      name: 'thumbnailUrl',
      type: 'text',
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
      name: 'error',
      type: 'textarea',
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
  ],
}
