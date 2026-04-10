-- Add description column to categories table for subcategory descriptions
ALTER TABLE categories ADD COLUMN description LONGTEXT NULL AFTER slug;

-- Create index for faster queries
CREATE INDEX idx_category_description ON categories(id);
