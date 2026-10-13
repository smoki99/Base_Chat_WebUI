-- PostgreSQL schema for product data
-- Story: postgres-mcp-products

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  sku         VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(200) NOT NULL,
  category    VARCHAR(50) NOT NULL,
  location    VARCHAR(50) NOT NULL,
  price       NUMERIC(10,2) NOT NULL,
  currency    CHAR(3) DEFAULT 'EUR',
  description TEXT,
  available   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN (
  to_tsvector('german', name || ' ' || coalesce(description, ''))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_location ON products(location);
