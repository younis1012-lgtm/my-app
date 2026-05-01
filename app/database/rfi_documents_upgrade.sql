-- RFI documents support
-- Safe to run more than once.

ALTER TABLE rfi_records
ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;

UPDATE rfi_records
SET documents = '[]'::jsonb
WHERE documents IS NULL;

COMMENT ON COLUMN rfi_records.documents IS 'Attached RFI files saved as JSON array: name, type, dataUrl, uploadedAt.';
