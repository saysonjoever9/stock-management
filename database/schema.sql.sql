-- =====================================================
-- Stock Management System - PostgreSQL Schema
-- =====================================================

-- If you want to reset, uncomment:
-- DROP DATABASE IF EXISTS stock_management;
-- CREATE DATABASE stock_management;
-- \c stock_management

-- ---------- ROLES ----------
CREATE TABLE IF NOT EXISTS roles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(30) UNIQUE NOT NULL,
    description TEXT
);

INSERT INTO roles (name, description) VALUES
    ('admin', 'Full system access'),
    ('staff', 'Limited operational access')
ON CONFLICT (name) DO NOTHING;

-- ---------- USERS ----------
CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    username       VARCHAR(50) UNIQUE NOT NULL,
    email          VARCHAR(120) UNIQUE NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    full_name      VARCHAR(120) NOT NULL,
    role_id        INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    last_login     TIMESTAMPTZ,
    failed_logins  INTEGER NOT NULL DEFAULT 0,
    locked_until   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);

-- ---------- CATEGORIES ----------
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- SUPPLIERS ----------
CREATE TABLE IF NOT EXISTS suppliers (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL,
    contact_person VARCHAR(120),
    email          VARCHAR(120),
    phone          VARCHAR(30),
    address        TEXT,
    notes          TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ---------- PRODUCTS ----------
CREATE TABLE IF NOT EXISTS products (
    id                SERIAL PRIMARY KEY,
    sku               VARCHAR(60) UNIQUE NOT NULL,
    barcode           VARCHAR(60) UNIQUE,
    name              VARCHAR(150) NOT NULL,
    description       TEXT,
    category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    supplier_id       INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    unit              VARCHAR(20) NOT NULL DEFAULT 'pcs',
    cost_price        NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    selling_price     NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
    current_stock     INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
    min_stock_level   INTEGER NOT NULL DEFAULT 0 CHECK (min_stock_level >= 0),
    max_stock_level   INTEGER NOT NULL DEFAULT 0 CHECK (max_stock_level >= 0),
    status            VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

-- ---------- STOCK TRANSACTIONS ----------
CREATE TABLE IF NOT EXISTS stock_transactions (
    id             SERIAL PRIMARY KEY,
    product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type           VARCHAR(20) NOT NULL CHECK (type IN ('in','out','adjustment')),
    quantity       INTEGER NOT NULL CHECK (quantity >= 0),
    previous_stock INTEGER NOT NULL,
    new_stock      INTEGER NOT NULL,
    unit_cost      NUMERIC(12,2),
    supplier_id    INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    reason         VARCHAR(100),
    reference      VARCHAR(100),
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tx_product ON stock_transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_tx_type ON stock_transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_user ON stock_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tx_created ON stock_transactions(created_at);

-- ---------- AUDIT LOGS ----------
CREATE TABLE IF NOT EXISTS audit_logs (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action       VARCHAR(80) NOT NULL,
    resource     VARCHAR(80),
    resource_id  VARCHAR(80),
    status       VARCHAR(20) NOT NULL DEFAULT 'success',
    ip_address   VARCHAR(64),
    user_agent   VARCHAR(255),
    details      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ---------- TRIGGER: updated_at ----------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated ON categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_suppliers_updated ON suppliers;
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- SEED DATA ----------
-- Default admin: username = admin / password = Admin@123
-- bcrypt hash of "Admin@123"
INSERT INTO users (username, email, password_hash, full_name, role_id)
SELECT 'admin', 'admin@example.com',
       '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewqR1mvMY1rKP7Uu',
       'System Administrator', r.id
FROM roles r WHERE r.name = 'admin'
ON CONFLICT (username) DO NOTHING;

INSERT INTO categories (name, description) VALUES
    ('Electronics', 'Electronic devices and accessories'),
    ('Groceries', 'Food and groceries'),
    ('Stationery', 'Office and school supplies')
ON CONFLICT (name) DO NOTHING;

INSERT INTO suppliers (name, contact_person, email, phone, address) VALUES
    ('Acme Corp', 'John Doe', 'john@acme.com', '+1-555-0100', '123 Acme Way'),
    ('Globex', 'Jane Smith', 'jane@globex.com', '+1-555-0200', '45 Globex Blvd')
ON CONFLICT DO NOTHING;