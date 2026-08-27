-- Reverts the payment_proof_path column: receipts are already handled by the
-- existing payments.receipt_path / "payments" bucket pattern. The now-unused
-- "payment_proofs" bucket is removed separately via the Storage API.
ALTER TABLE "public"."installments"
    DROP COLUMN IF EXISTS "payment_proof_path";
