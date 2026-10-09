-- Create table for old QR code submissions
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS old_qr_submissions (
  id BIGSERIAL PRIMARY KEY,
  serial_number TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  submitted_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE old_qr_submissions ENABLE ROW LEVEL SECURITY;

-- Create policy for inserting data (public insert, authenticated users can read)
CREATE POLICY "Allow public insert" ON old_qr_submissions
  FOR INSERT WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_old_qr_serial ON old_qr_submissions(serial_number);
CREATE INDEX idx_old_qr_submitted_at ON old_qr_submissions(submitted_at);
