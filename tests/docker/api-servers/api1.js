const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// In-memory data store for testing
let users = [
  { id: 1, name: "John Doe", email: "john@example.com", role: "admin" },
  { id: 2, name: "Jane Smith", email: "jane@example.com", role: "user" },
  { id: 3, name: "Bob Wilson", email: "bob@example.com", role: "user" },
];

let products = [
  { id: 1, name: "Laptop", price: 999.99, category: "Electronics", stock: 10 },
  { id: 2, name: "Mouse", price: 29.99, category: "Electronics", stock: 50 },
  { id: 3, name: "Book", price: 19.99, category: "Education", stock: 25 },
];

let orders = [
  { id: 1, userId: 1, productIds: [1, 2], total: 1029.98, status: "completed" },
  { id: 2, userId: 2, productIds: [3], total: 19.99, status: "pending" },
];

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "api1",
    timestamp: new Date().toISOString(),
  });
});

// Users endpoints
app.get("/users", (req, res) => {
  const { role, limit } = req.query;
  let filteredUsers = users;

  if (role) {
    filteredUsers = users.filter((u) => u.role === role);
  }

  if (limit) {
    filteredUsers = filteredUsers.slice(0, parseInt(limit));
  }

  res.json({
    users: filteredUsers,
    total: filteredUsers.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/users/:id", (req, res) => {
  const userId = parseInt(req.params.id);
  const user = users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  res.json({ user, timestamp: new Date().toISOString() });
});

app.post("/users", (req, res) => {
  const { name, email, role = "user" } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const newUser = {
    id: Math.max(...users.map((u) => u.id)) + 1,
    name,
    email,
    role,
  };

  users.push(newUser);

  res.status(201).json({
    user: newUser,
    message: "User created successfully",
    timestamp: new Date().toISOString(),
  });
});

app.put("/users/:id", (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const { name, email, role } = req.body;

  if (name) users[userIndex].name = name;
  if (email) users[userIndex].email = email;
  if (role) users[userIndex].role = role;

  res.json({
    user: users[userIndex],
    message: "User updated successfully",
    timestamp: new Date().toISOString(),
  });
});

app.patch("/users/:id", (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  // Patch allows partial updates
  Object.assign(users[userIndex], req.body);

  res.json({
    user: users[userIndex],
    message: "User patched successfully",
    timestamp: new Date().toISOString(),
  });
});

app.delete("/users/:id", (req, res) => {
  const userId = parseInt(req.params.id);
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  const deletedUser = users.splice(userIndex, 1)[0];

  res.json({
    user: deletedUser,
    message: "User deleted successfully",
    timestamp: new Date().toISOString(),
  });
});

// Products endpoints
app.get("/products", (req, res) => {
  const { category, minPrice, maxPrice, limit } = req.query;
  let filteredProducts = products;

  if (category) {
    filteredProducts = filteredProducts.filter(
      (p) => p.category.toLowerCase() === category.toLowerCase()
    );
  }

  if (minPrice) {
    filteredProducts = filteredProducts.filter(
      (p) => p.price >= parseFloat(minPrice)
    );
  }

  if (maxPrice) {
    filteredProducts = filteredProducts.filter(
      (p) => p.price <= parseFloat(maxPrice)
    );
  }

  if (limit) {
    filteredProducts = filteredProducts.slice(0, parseInt(limit));
  }

  res.json({
    products: filteredProducts,
    total: filteredProducts.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/products/:id", (req, res) => {
  const productId = parseInt(req.params.id);
  const product = products.find((p) => p.id === productId);

  if (!product) {
    return res.status(404).json({ error: "Product not found" });
  }

  res.json({ product, timestamp: new Date().toISOString() });
});

app.post("/products", (req, res) => {
  const { name, price, category, stock = 0 } = req.body;

  if (!name || !price || !category) {
    return res
      .status(400)
      .json({ error: "Name, price, and category are required" });
  }

  const newProduct = {
    id: Math.max(...products.map((p) => p.id)) + 1,
    name,
    price: parseFloat(price),
    category,
    stock: parseInt(stock),
  };

  products.push(newProduct);

  res.status(201).json({
    product: newProduct,
    message: "Product created successfully",
    timestamp: new Date().toISOString(),
  });
});

app.put("/products/:id", (req, res) => {
  const productId = parseInt(req.params.id);
  const productIndex = products.findIndex((p) => p.id === productId);

  if (productIndex === -1) {
    return res.status(404).json({ error: "Product not found" });
  }

  const { name, price, category, stock } = req.body;

  if (name) products[productIndex].name = name;
  if (price) products[productIndex].price = parseFloat(price);
  if (category) products[productIndex].category = category;
  if (stock !== undefined) products[productIndex].stock = parseInt(stock);

  res.json({
    product: products[productIndex],
    message: "Product updated successfully",
    timestamp: new Date().toISOString(),
  });
});

app.delete("/products/:id", (req, res) => {
  const productId = parseInt(req.params.id);
  const productIndex = products.findIndex((p) => p.id === productId);

  if (productIndex === -1) {
    return res.status(404).json({ error: "Product not found" });
  }

  const deletedProduct = products.splice(productIndex, 1)[0];

  res.json({
    product: deletedProduct,
    message: "Product deleted successfully",
    timestamp: new Date().toISOString(),
  });
});

// Orders endpoints
app.get("/orders", (req, res) => {
  const { status, userId, limit } = req.query;
  let filteredOrders = orders;

  if (status) {
    filteredOrders = filteredOrders.filter((o) => o.status === status);
  }

  if (userId) {
    filteredOrders = filteredOrders.filter(
      (o) => o.userId === parseInt(userId)
    );
  }

  if (limit) {
    filteredOrders = filteredOrders.slice(0, parseInt(limit));
  }

  res.json({
    orders: filteredOrders,
    total: filteredOrders.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/orders/:id", (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = orders.find((o) => o.id === orderId);

  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  res.json({ order, timestamp: new Date().toISOString() });
});

app.post("/orders", (req, res) => {
  const { userId, productIds, status = "pending" } = req.body;

  if (!userId || !productIds || !Array.isArray(productIds)) {
    return res
      .status(400)
      .json({ error: "UserId and productIds array are required" });
  }

  // Calculate total from products
  const orderProducts = products.filter((p) => productIds.includes(p.id));
  const total = orderProducts.reduce((sum, product) => sum + product.price, 0);

  const newOrder = {
    id: Math.max(...orders.map((o) => o.id)) + 1,
    userId: parseInt(userId),
    productIds,
    total: parseFloat(total.toFixed(2)),
    status,
  };

  orders.push(newOrder);

  res.status(201).json({
    order: newOrder,
    message: "Order created successfully",
    timestamp: new Date().toISOString(),
  });
});

app.patch("/orders/:id/status", (req, res) => {
  const orderId = parseInt(req.params.id);
  const orderIndex = orders.findIndex((o) => o.id === orderId);

  if (orderIndex === -1) {
    return res.status(404).json({ error: "Order not found" });
  }

  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  orders[orderIndex].status = status;

  res.json({
    order: orders[orderIndex],
    message: "Order status updated successfully",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint for different response types
app.get("/test/response-types", (req, res) => {
  const { type } = req.query;

  switch (type) {
    case "xml":
      res.set("Content-Type", "application/xml");
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
                <response>
                    <status>success</status>
                    <message>XML response</message>
                    <timestamp>${new Date().toISOString()}</timestamp>
                </response>`);
      break;
    case "plain":
      res.set("Content-Type", "text/plain");
      res.send(`Plain text response at ${new Date().toISOString()}`);
      break;
    case "html":
      res.set("Content-Type", "text/html");
      res.send(
        `<html><body><h1>HTML Response</h1><p>Timestamp: ${new Date().toISOString()}</p></body></html>`
      );
      break;
    case "error":
      res.status(500).json({
        error: "Simulated server error",
        timestamp: new Date().toISOString(),
      });
      break;
    case "slow":
      // Simulate slow response
      setTimeout(() => {
        res.json({
          message: "Slow response completed",
          timestamp: new Date().toISOString(),
        });
      }, 2000);
      break;
    default:
      res.json({
        message: "Default JSON response",
        timestamp: new Date().toISOString(),
      });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Test API 1 (RESTful) running on port ${port}`);
});

module.exports = app;
