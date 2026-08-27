-- Contract dual signature (Phase 1): backfill historical single-signer
-- contracts into the new model. Pre-existing signed contracts represent
-- "fully signed" under the old single-signer world, so fully_signed_at is
-- set explicitly here rather than relying on the completion trigger (which
-- only fires once BOTH roles exist — never true for these historical rows).
INSERT INTO public.contract_signatures (contract_id, signer_role, signer_id, signed_at, signed_ip, signed_user_agent, verification_code)
SELECT id, 'professional', signed_by, signed_at, signed_ip, signed_user_agent, verification_code
FROM public.contracts
WHERE is_signed = true AND signed_by IS NOT NULL
ON CONFLICT (contract_id, signer_role) DO NOTHING;

UPDATE public.contracts
SET fully_signed_at = signed_at
WHERE is_signed = true AND fully_signed_at IS NULL;
