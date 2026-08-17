-- Contract dual signature (Phase 1): parent-level flag set only once BOTH
-- signer roles (professional + patient) have signed. Never written directly
-- by the application — only by the contract_signatures completion trigger
-- and by the one-time backfill for pre-existing signed contracts.
ALTER TABLE public.contracts
  ADD COLUMN fully_signed_at timestamptz;
