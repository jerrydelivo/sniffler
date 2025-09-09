-- SQL Server initialization script for testing
USE master;

GO
    -- Create test database if it doesn't exist
    IF NOT EXISTS (
        SELECT
            name
        FROM
            sys.databases
        WHERE
            name = 'testdb'
    ) BEGIN CREATE DATABASE testdb;

END
GO
    USE testdb;

GO
    -- Users table
    IF NOT EXISTS (
        SELECT
            *
        FROM
            sysobjects
        WHERE
            name = 'users'
            AND xtype = 'U'
    ) BEGIN CREATE TABLE users (
        id INT IDENTITY(1, 1) PRIMARY KEY,
        username NVARCHAR(50) UNIQUE NOT NULL,
        email NVARCHAR(100) UNIQUE NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        first_name NVARCHAR(50),
        last_name NVARCHAR(50),
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );

END
GO
    -- Categories table
    IF NOT EXISTS (
        SELECT
            *
        FROM
            sysobjects
        WHERE
            name = 'categories'
            AND xtype = 'U'
    ) BEGIN CREATE TABLE categories (
        id INT IDENTITY(1, 1) PRIMARY KEY,
        name NVARCHAR(50) NOT NULL,
        description NVARCHAR(MAX),
        parent_id INT REFERENCES categories(id),
        created_at DATETIME2 DEFAULT GETDATE()
    );

END
GO
    -- Products table
    IF NOT EXISTS (
        SELECT
            *
        FROM
            sysobjects
        WHERE
            name = 'products'
            AND xtype = 'U'
    ) BEGIN CREATE TABLE products (
        id INT IDENTITY(1, 1) PRIMARY KEY,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(MAX),
        price DECIMAL(10, 2) NOT NULL,
        stock_quantity INT DEFAULT 0,
        category_id INT REFERENCES categories(id),
        sku NVARCHAR(50) UNIQUE,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );

END
GO
    -- Orders table
    IF NOT EXISTS (
        SELECT
            *
        FROM
            sysobjects
        WHERE
            name = 'orders'
            AND xtype = 'U'
    ) BEGIN CREATE TABLE orders (
        id INT IDENTITY(1, 1) PRIMARY KEY,
        user_id INT REFERENCES users(id),
        total_amount DECIMAL(10, 2) NOT NULL,
        status NVARCHAR(20) DEFAULT 'pending',
        shipping_address NVARCHAR(MAX),
        billing_address NVARCHAR(MAX),
        created_at DATETIME2 DEFAULT GETDATE(),
        updated_at DATETIME2 DEFAULT GETDATE()
    );

END
GO
    -- Order items table
    IF NOT EXISTS (
        SELECT
            *
        FROM
            sysobjects
        WHERE
            name = 'order_items'
            AND xtype = 'U'
    ) BEGIN CREATE TABLE order_items (
        id INT IDENTITY(1, 1) PRIMARY KEY,
        order_id INT REFERENCES orders(id),
        product_id INT REFERENCES products(id),
        quantity INT NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL
    );

END
GO
    -- Insert seed data
    IF NOT EXISTS (
        SELECT
            *
        FROM
            categories
    ) BEGIN
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
    ('Sports', 'Sports equipment and gear');

END
GO
    IF NOT EXISTS (
        SELECT
            *
        FROM
            users
    ) BEGIN
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
    );

END
GO
    IF NOT EXISTS (
        SELECT
            *
        FROM
            products
    ) BEGIN
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
    );

END
GO
    IF NOT EXISTS (
        SELECT
            *
        FROM
            orders
    ) BEGIN
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
    );

END
GO
    IF NOT EXISTS (
        SELECT
            *
        FROM
            order_items
    ) BEGIN
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
    (5, 5, 1, 89.99, 89.99);

END
GO
    -- Create indexes for better performance during testing
    CREATE NONCLUSTERED INDEX IX_users_email ON users(email);

CREATE NONCLUSTERED INDEX IX_users_username ON users(username);

CREATE NONCLUSTERED INDEX IX_products_sku ON products(sku);

CREATE NONCLUSTERED INDEX IX_products_category ON products(category_id);

CREATE NONCLUSTERED INDEX IX_orders_user_id ON orders(user_id);

CREATE NONCLUSTERED INDEX IX_orders_status ON orders(status);

CREATE NONCLUSTERED INDEX IX_order_items_order_id ON order_items(order_id);

CREATE NONCLUSTERED INDEX IX_order_items_product_id ON order_items(product_id);

GO