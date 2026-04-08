'use client'

import { useConfirmationModalConsumer } from '../contexts/confirmation-modal-provider'

export type { ConfirmOptions } from '../contexts/confirmation-modal-provider'

export function useConfirmModal() {
  return useConfirmationModalConsumer()
}
