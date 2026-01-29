'use client'

import React from 'react'

import styles from './preview.module.css'

type Props = {
  error?: string
  html: null | string
  readyToStream?: boolean
}
export function StreamPreviewer({ error, html, readyToStream }: Props) {
  return (
    <div className={styles.container}>
      {error ? (
        <div className={styles.error}>
          <div className={styles.errorIcon}>
            <svg
              fill="none"
              height="48"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="48"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
          </div>
          <p className={styles.errorText}>Video processing failed</p>
          <p className={styles.errorMessage}>{error}</p>
        </div>
      ) : readyToStream ? (
        html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <p>Video preview not available.</p>
        )
      ) : (
        <div className={styles.placeholder}>
          <div className={styles.placeholderIcon}>
            <svg
              fill="none"
              height="48"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="48"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <p className={styles.placeholderText}>Video is being processed</p>
          <p className={styles.placeholderSubtext}>Please check back in a few moments</p>
        </div>
      )}
    </div>
  )
}
