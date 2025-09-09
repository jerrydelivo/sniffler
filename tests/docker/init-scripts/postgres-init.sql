-- PostgreSQL initialization script for testing
-- Create test tables and seed data
-- Simple users table for integration tests
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    age INTEGER,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    category_id INTEGER,
    sku VARCHAR(50) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    shipping_address TEXT,
    billing_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    product_id INTEGER REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL
);

-- Insert seed data
INSERT INTO
    categories (name, description)
VALUES
    (
        'Electronics',
        'Electronic devices and accessories'
    ),
    ('Books', 'Physical and digital books'),
    ('Clothing', 'Apparel and accessories'),
    (
        'Home & Garden',
        'Home improvement and gardening supplies'
    ),
    ('Sports', 'Sports equipment and gear') ON CONFLICT DO NOTHING;

INSERT INTO
    users (
        username,
        email,
        password_hash,
        first_name,
        last_name
    )
VALUES
    (
        'john_doe',
        'john@example.com',
        '$2b$10$hash1',
        'John',
        'Doe'
    ),
    (
        'jane_smith',
        'jane@example.com',
        '$2b$10$hash2',
        'Jane',
        'Smith'
    ),
    (
        'bob_wilson',
        'bob@example.com',
        '$2b$10$hash3',
        'Bob',
        'Wilson'
    ),
    (
        'alice_brown',
        'alice@example.com',
        '$2b$10$hash4',
        'Alice',
        'Brown'
    ),
    (
        'charlie_davis',
        'charlie@example.com',
        '$2b$10$hash5',
        'Charlie',
        'Davis'
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    products (
        name,
        description,
        price,
        stock_quantity,
        category_id,
        sku
    )
VALUES
    (
        'Laptop Pro 15',
        'High-performance laptop for professionals',
        1299.99,
        50,
        1,
        'LAP-PRO-15'
    ),
    (
        'Wireless Headphones',
        'Noise-cancelling wireless headphones',
        249.99,
        100,
        1,
        'WH-NC-001'
    ),
    (
        'Programming Book',
        'Learn advanced programming concepts',
        49.99,
        200,
        2,
        'BOOK-PROG-001'
    ),
    (
        'Running Shoes',
        'Comfortable running shoes for athletes',
        129.99,
        75,
        5,
        'SHOE-RUN-001'
    ),
    (
        'Garden Tools Set',
        'Complete set of gardening tools',
        89.99,
        30,
        4,
        'TOOLS-GARDEN-001'
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    orders (
        user_id,
        total_amount,
        status,
        shipping_address,
        billing_address
    )
VALUES
    (
        1,
        1549.98,
        'completed',
        '123 Main St, City, State 12345',
        '123 Main St, City, State 12345'
    ),
    (
        2,
        249.99,
        'pending',
        '456 Oak Ave, Town, State 67890',
        '456 Oak Ave, Town, State 67890'
    ),
    (
        3,
        179.98,
        'shipped',
        '789 Pine Rd, Village, State 13579',
        '789 Pine Rd, Village, State 13579'
    ),
    (
        4,
        49.99,
        'completed',
        '321 Elm St, Borough, State 24680',
        '321 Elm St, Borough, State 24680'
    ),
    (
        5,
        89.99,
        'processing',
        '654 Maple Dr, Hamlet, State 97531',
        '654 Maple Dr, Hamlet, State 97531'
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    order_items (
        order_id,
        product_id,
        quantity,
        unit_price,
        total_price
    )
VALUES
    (1, 1, 1, 1299.99, 1299.99),
    (1, 2, 1, 249.99, 249.99),
    (2, 2, 1, 249.99, 249.99),
    (3, 4, 1, 129.99, 129.99),
    (3, 3, 1, 49.99, 49.99),
    (4, 3, 1, 49.99, 49.99),
    (5, 5, 1, 89.99, 89.99) ON CONFLICT DO NOTHING;

-- Create some indexes for better performance during testing
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);