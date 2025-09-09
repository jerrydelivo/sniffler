// MongoDB initialization script for testing
// Create collections and seed data

// Switch to the test database
db = db.getSiblingDB("testdb");

// Create users collection
db.users.insertMany([
  {
    _id: ObjectId(),
    username: "john_doe",
    email: "john@example.com",
    passwordHash: "$2b$10$hash1",
    firstName: "John",
    lastName: "Doe",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    username: "jane_smith",
    email: "jane@example.com",
    passwordHash: "$2b$10$hash2",
    firstName: "Jane",
    lastName: "Smith",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    username: "bob_wilson",
    email: "bob@example.com",
    passwordHash: "$2b$10$hash3",
    firstName: "Bob",
    lastName: "Wilson",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    username: "alice_brown",
    email: "alice@example.com",
    passwordHash: "$2b$10$hash4",
    firstName: "Alice",
    lastName: "Brown",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    username: "charlie_davis",
    email: "charlie@example.com",
    passwordHash: "$2b$10$hash5",
    firstName: "Charlie",
    lastName: "Davis",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]);

// Create categories collection
db.categories.insertMany([
  {
    _id: ObjectId(),
    name: "Electronics",
    description: "Electronic devices and accessories",
    parentId: null,
    createdAt: new Date(),
  },
  {
    _id: ObjectId(),
    name: "Books",
    description: "Physical and digital books",
    parentId: null,
    createdAt: new Date(),
  },
  {
    _id: ObjectId(),
    name: "Clothing",
    description: "Apparel and accessories",
    parentId: null,
    createdAt: new Date(),
  },
  {
    _id: ObjectId(),
    name: "Home & Garden",
    description: "Home improvement and gardening supplies",
    parentId: null,
    createdAt: new Date(),
  },
  {
    _id: ObjectId(),
    name: "Sports",
    description: "Sports equipment and gear",
    parentId: null,
    createdAt: new Date(),
  },
]);

// Get category IDs for reference
const electronicsCategory = db.categories.findOne({ name: "Electronics" });
const booksCategory = db.categories.findOne({ name: "Books" });
const sportsCategory = db.categories.findOne({ name: "Sports" });
const homeCategory = db.categories.findOne({ name: "Home & Garden" });

// Create products collection
db.products.insertMany([
  {
    _id: ObjectId(),
    name: "Laptop Pro 15",
    description: "High-performance laptop for professionals",
    price: 1299.99,
    stockQuantity: 50,
    categoryId: electronicsCategory._id,
    sku: "LAP-PRO-15",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    name: "Wireless Headphones",
    description: "Noise-cancelling wireless headphones",
    price: 249.99,
    stockQuantity: 100,
    categoryId: electronicsCategory._id,
    sku: "WH-NC-001",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    name: "Programming Book",
    description: "Learn advanced programming concepts",
    price: 49.99,
    stockQuantity: 200,
    categoryId: booksCategory._id,
    sku: "BOOK-PROG-001",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    name: "Running Shoes",
    description: "Comfortable running shoes for athletes",
    price: 129.99,
    stockQuantity: 75,
    categoryId: sportsCategory._id,
    sku: "SHOE-RUN-001",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    name: "Garden Tools Set",
    description: "Complete set of gardening tools",
    price: 89.99,
    stockQuantity: 30,
    categoryId: homeCategory._id,
    sku: "TOOLS-GARDEN-001",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]);

// Get user and product IDs for reference
const user1 = db.users.findOne({ username: "john_doe" });
const user2 = db.users.findOne({ username: "jane_smith" });
const user3 = db.users.findOne({ username: "bob_wilson" });
const user4 = db.users.findOne({ username: "alice_brown" });
const user5 = db.users.findOne({ username: "charlie_davis" });

const laptop = db.products.findOne({ sku: "LAP-PRO-15" });
const headphones = db.products.findOne({ sku: "WH-NC-001" });
const book = db.products.findOne({ sku: "BOOK-PROG-001" });
const shoes = db.products.findOne({ sku: "SHOE-RUN-001" });
const tools = db.products.findOne({ sku: "TOOLS-GARDEN-001" });

// Create orders collection
db.orders.insertMany([
  {
    _id: ObjectId(),
    userId: user1._id,
    totalAmount: 1549.98,
    status: "completed",
    shippingAddress: "123 Main St, City, State 12345",
    billingAddress: "123 Main St, City, State 12345",
    items: [
      {
        productId: laptop._id,
        productName: "Laptop Pro 15",
        quantity: 1,
        unitPrice: 1299.99,
        totalPrice: 1299.99,
      },
      {
        productId: headphones._id,
        productName: "Wireless Headphones",
        quantity: 1,
        unitPrice: 249.99,
        totalPrice: 249.99,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    userId: user2._id,
    totalAmount: 249.99,
    status: "pending",
    shippingAddress: "456 Oak Ave, Town, State 67890",
    billingAddress: "456 Oak Ave, Town, State 67890",
    items: [
      {
        productId: headphones._id,
        productName: "Wireless Headphones",
        quantity: 1,
        unitPrice: 249.99,
        totalPrice: 249.99,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    userId: user3._id,
    totalAmount: 179.98,
    status: "shipped",
    shippingAddress: "789 Pine Rd, Village, State 13579",
    billingAddress: "789 Pine Rd, Village, State 13579",
    items: [
      {
        productId: shoes._id,
        productName: "Running Shoes",
        quantity: 1,
        unitPrice: 129.99,
        totalPrice: 129.99,
      },
      {
        productId: book._id,
        productName: "Programming Book",
        quantity: 1,
        unitPrice: 49.99,
        totalPrice: 49.99,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    userId: user4._id,
    totalAmount: 49.99,
    status: "completed",
    shippingAddress: "321 Elm St, Borough, State 24680",
    billingAddress: "321 Elm St, Borough, State 24680",
    items: [
      {
        productId: book._id,
        productName: "Programming Book",
        quantity: 1,
        unitPrice: 49.99,
        totalPrice: 49.99,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    _id: ObjectId(),
    userId: user5._id,
    totalAmount: 89.99,
    status: "processing",
    shippingAddress: "654 Maple Dr, Hamlet, State 97531",
    billingAddress: "654 Maple Dr, Hamlet, State 97531",
    items: [
      {
        productId: tools._id,
        productName: "Garden Tools Set",
        quantity: 1,
        unitPrice: 89.99,
        totalPrice: 89.99,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  },
]);

// Create indexes for better performance during testing
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ username: 1 }, { unique: true });
db.products.createIndex({ sku: 1 }, { unique: true });
db.products.createIndex({ categoryId: 1 });
db.orders.createIndex({ userId: 1 });
db.orders.createIndex({ status: 1 });
db.categories.createIndex({ name: 1 });

print(
  "MongoDB test database initialized successfully with collections: users, categories, products, orders"
);
