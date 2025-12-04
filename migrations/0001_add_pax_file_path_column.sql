-- Add pax_file_path column to generated_reports table if it doesn't exist
ALTER TABLE "generated_reports" 
ADD COLUMN IF NOT EXISTS "pax_file_path" text;

