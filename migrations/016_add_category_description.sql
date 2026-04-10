-- Add description field to categories table
ALTER TABLE categories ADD COLUMN description LONGTEXT DEFAULT NULL AFTER description;
ALTER TABLE categories ADD COLUMN full_description LONGTEXT DEFAULT NULL AFTER description;

-- Create index for better query performance
CREATE INDEX idx_category_description ON categories(id);
