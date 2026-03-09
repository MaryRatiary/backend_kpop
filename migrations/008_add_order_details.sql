-- Migration: Add detailed order information
-- Description: Add shipping details, customer info, and GPS coordinates to orders table

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS firstName VARCHAR(100),
ADD COLUMN IF NOT EXISTS lastName VARCHAR(100),
ADD COLUMN IF NOT EXISTS email VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS city VARCHAR(100),
ADD COLUMN IF NOT EXISTS postalCode VARCHAR(10),
ADD COLUMN IF NOT EXISTS country VARCHAR(100),
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

