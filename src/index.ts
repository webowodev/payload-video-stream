import type { CollectionSlug, Config } from 'payload'

import type { StreamAdapter } from './adapters/streamAdapter.js'

import { streamField } from './fields/stream.js'
import { copyVideo, deleteVideo, updateStatusHook } from './hooks/afterOperation.js'
import { updateStreamStatusTask } from './tasks/updateStreamStatus.js'

export type VideoStreamConfig = {
  /**
   * List of collections to add a custom field
   */
  collections?: Partial<Record<CollectionSlug, { adapter?: StreamAdapter } | true>>
  defaultAdapter: StreamAdapter
  disabled?: boolean
  requireSignedURLs?: boolean
}

export const videoStream =
  (pluginOptions: VideoStreamConfig) =>
  (config: Config): Config => {
    config.collections ??= []

    const { collections, defaultAdapter } = pluginOptions

    if (collections) {
      for (const collectionSlug in collections) {
        const collection = config.collections.find(
          (collection) => collection.slug === collectionSlug,
        )

        const collectionOptions = collections[collectionSlug]

        if (collection) {
          const adapter =
            typeof collectionOptions != 'boolean' && collectionOptions?.adapter
              ? collectionOptions.adapter
              : defaultAdapter

          // inject stream field
          collection.fields.push(streamField({ adapter }))

          const afterOperationHooks = collection.hooks?.afterOperation || []

          // START INJECT AFTER OPERATION COLLECTION HOOKS

          // inject update status hook
          afterOperationHooks.push(
            // this will update the stream status after fetching the document by ID
            updateStatusHook(adapter, collectionSlug),
          )

          // inject copy video hook
          afterOperationHooks.push(
            // this will copy the video to the streaming service after fetching the document by ID
            // when the video is not yet ready to stream
            copyVideo(
              adapter,
              collectionSlug,
              // if the upload adapter requires signed URLs to access the video,
              // we need to fetch a signed URL before copying the video
              // e.g. S3 with private files
              pluginOptions.requireSignedURLs || false,
            ),
          )

          // END INJECT AFTER OPERATION COLLECTION HOOKS

          // START INJECT BEFORE DELETE COLLECTION HOOKS
          const beforeDeleteHooks = collection.hooks?.beforeDelete || []

          // inject delete video hook
          beforeDeleteHooks.push(
            // this will delete the video from the streaming service before deleting the document
            deleteVideo(adapter, collectionSlug),
          )
          // END INJECT BEFORE DELETE COLLECTION HOOKS

          // re-assign hooks
          collection.hooks = {
            ...collection.hooks,
            afterOperation: afterOperationHooks,
            beforeDelete: beforeDeleteHooks,
          }
        }
      }
    }

    const getAllAdapters = () => {
      const adapters: StreamAdapter[] = [pluginOptions.defaultAdapter]
      if (collections) {
        for (const collectionSlug in collections) {
          const collectionOptions = collections[collectionSlug]
          if (typeof collectionOptions != 'boolean' && collectionOptions?.adapter) {
            adapters.push(collectionOptions.adapter)
          } else {
            adapters.push(defaultAdapter)
          }
        }
      }
      return adapters
    }

    // inject jobs
    config.jobs = {
      ...config.jobs,
      // inject tasks
      tasks: [
        ...(config.jobs?.tasks || []),
        ...getAllAdapters().map((adapter) => updateStreamStatusTask(adapter)),
      ],
    }

    /**
     * If the plugin is disabled, we still want to keep added collections/fields so the database schema is consistent which is important for migrations.
     * If your plugin heavily modifies the database schema, you may want to remove this property.
     */
    if (pluginOptions.disabled) {
      return config
    }

    const incomingOnInit = config.onInit

    config.onInit = async (payload) => {
      // Ensure we are executing any existing onInit functions before running our own.
      if (incomingOnInit) {
        await incomingOnInit(payload)
      }
    }

    return config
  }
