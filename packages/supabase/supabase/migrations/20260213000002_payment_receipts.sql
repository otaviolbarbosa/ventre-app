-- Add receipt_path column to payments table
ALTER TABLE payments ADD COLUMN receipt_path text;

-- Create storage bucket for payment receipts
INSERT INTO storage.buckets (id, name, public)
VALUES ('payments', 'payments', false);

-- Upload: authenticated users can upload to their own folder
CREATE POLICY "Users can upload payment receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Delete: users can delete their own receipts
CREATE POLICY "Users can delete own payment receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
