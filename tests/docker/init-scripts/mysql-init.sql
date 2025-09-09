-- MySQL initialization script for testing
-- Create test tables and seed data
-- Simple users table for integration tests
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(100),
    age INT,
    username VARCHAR(50) UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    parent_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    category_id INT,
    sku VARCHAR(50) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    shipping_address TEXT,
    billing_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT,
    product_id INT,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert seed data
INSERT
    IGNORE INTO categories (name, description)
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
    ('Sports', 'Sports equipment and gear');

INSERT
    IGNORE INTO users (
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
    );

INSERT
    IGNORE INTO products (
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
    );

INSERT
    IGNORE INTO orders (
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
    );

INSERT
    IGNORE INTO order_items (
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
    (5, 5, 1, 89.99, 89.99);

-- Create indexes for better performance during testing
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_users_username ON users(username);

CREATE INDEX idx_products_sku ON products(sku);

CREATE INDEX idx_products_category ON products(category_id);

CREATE INDEX idx_orders_user_id ON orders(user_id);

CREATE INDEX idx_orders_status ON orders(status);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE INDEX idx_order_items_product_id ON order_items(product_id);