const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// GraphQL-like API structure (simplified for testing)
let database = {
  users: [
    { id: 1, name: "Alice Johnson", email: "alice@example.com", posts: [1, 3] },
    { id: 2, name: "Bob Smith", email: "bob@example.com", posts: [2] },
    { id: 3, name: "Carol Williams", email: "carol@example.com", posts: [] },
  ],
  posts: [
    {
      id: 1,
      title: "GraphQL Basics",
      content: "Learning GraphQL...",
      authorId: 1,
      comments: [1, 2],
    },
    {
      id: 2,
      title: "API Design",
      content: "Best practices for API design...",
      authorId: 2,
      comments: [3],
    },
    {
      id: 3,
      title: "Testing APIs",
      content: "How to test your APIs effectively...",
      authorId: 1,
      comments: [],
    },
  ],
  comments: [
    { id: 1, content: "Great post!", postId: 1, authorId: 2 },
    { id: 2, content: "Very helpful", postId: 1, authorId: 3 },
    { id: 3, content: "Thanks for sharing", postId: 2, authorId: 1 },
  ],
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "TestAPI2",
    timestamp: new Date().toISOString(),
  });
});

// GraphQL-style query endpoint
app.post("/graphql", (req, res) => {
  const { query, variables = {} } = req.body;

  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  try {
    const result = parseAndExecuteQuery(query, variables);
    res.json({ data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    res
      .status(400)
      .json({ error: error.message, timestamp: new Date().toISOString() });
  }
});

// Simple GraphQL query parser (for testing purposes)
function parseAndExecuteQuery(query, variables) {
  const trimmedQuery = query.trim();

  // Handle user queries
  if (trimmedQuery.includes("users")) {
    if (trimmedQuery.includes("user(id:")) {
      const idMatch = trimmedQuery.match(/user\(id:\s*(\d+)\)/);
      if (idMatch) {
        const userId = parseInt(idMatch[1]);
        const user = database.users.find((u) => u.id === userId);
        if (!user) {
          throw new Error(`User with id ${userId} not found`);
        }
        return resolveUser(user, trimmedQuery);
      }
    } else {
      const users = database.users.map((user) =>
        resolveUser(user, trimmedQuery)
      );
      return { users };
    }
  }

  // Handle post queries
  if (trimmedQuery.includes("posts")) {
    if (trimmedQuery.includes("post(id:")) {
      const idMatch = trimmedQuery.match(/post\(id:\s*(\d+)\)/);
      if (idMatch) {
        const postId = parseInt(idMatch[1]);
        const post = database.posts.find((p) => p.id === postId);
        if (!post) {
          throw new Error(`Post with id ${postId} not found`);
        }
        return resolvePost(post, trimmedQuery);
      }
    } else {
      const posts = database.posts.map((post) =>
        resolvePost(post, trimmedQuery)
      );
      return { posts };
    }
  }

  // Handle mutations
  if (trimmedQuery.includes("createUser")) {
    return handleCreateUser(trimmedQuery, variables);
  }

  if (trimmedQuery.includes("createPost")) {
    return handleCreatePost(trimmedQuery, variables);
  }

  if (trimmedQuery.includes("updateUser")) {
    return handleUpdateUser(trimmedQuery, variables);
  }

  if (trimmedQuery.includes("deleteUser")) {
    return handleDeleteUser(trimmedQuery, variables);
  }

  throw new Error("Unsupported query type");
}

function resolveUser(user, query) {
  const result = { id: user.id };

  if (query.includes("name")) result.name = user.name;
  if (query.includes("email")) result.email = user.email;

  if (query.includes("posts")) {
    result.posts = user.posts.map((postId) => {
      const post = database.posts.find((p) => p.id === postId);
      return resolvePost(post, query);
    });
  }

  return result;
}

function resolvePost(post, query) {
  const result = { id: post.id };

  if (query.includes("title")) result.title = post.title;
  if (query.includes("content")) result.content = post.content;
  if (query.includes("authorId")) result.authorId = post.authorId;

  if (query.includes("author") && !query.includes("authorId")) {
    const author = database.users.find((u) => u.id === post.authorId);
    result.author = resolveUser(author, query);
  }

  if (query.includes("comments")) {
    result.comments = post.comments.map((commentId) => {
      const comment = database.comments.find((c) => c.id === commentId);
      return resolveComment(comment, query);
    });
  }

  return result;
}

function resolveComment(comment, query) {
  const result = { id: comment.id };

  if (query.includes("content")) result.content = comment.content;
  if (query.includes("postId")) result.postId = comment.postId;
  if (query.includes("authorId")) result.authorId = comment.authorId;

  return result;
}

function handleCreateUser(query, variables) {
  const nameMatch = query.match(/name:\s*"([^"]+)"/);
  const emailMatch = query.match(/email:\s*"([^"]+)"/);

  if (!nameMatch || !emailMatch) {
    throw new Error("Name and email are required for createUser");
  }

  const newUser = {
    id: Math.max(...database.users.map((u) => u.id)) + 1,
    name: nameMatch[1],
    email: emailMatch[1],
    posts: [],
  };

  database.users.push(newUser);

  return { createUser: newUser };
}

function handleCreatePost(query, variables) {
  const titleMatch = query.match(/title:\s*"([^"]+)"/);
  const contentMatch = query.match(/content:\s*"([^"]+)"/);
  const authorIdMatch = query.match(/authorId:\s*(\d+)/);

  if (!titleMatch || !contentMatch || !authorIdMatch) {
    throw new Error("Title, content, and authorId are required for createPost");
  }

  const newPost = {
    id: Math.max(...database.posts.map((p) => p.id)) + 1,
    title: titleMatch[1],
    content: contentMatch[1],
    authorId: parseInt(authorIdMatch[1]),
    comments: [],
  };

  database.posts.push(newPost);

  // Add post to user's posts array
  const user = database.users.find((u) => u.id === newPost.authorId);
  if (user) {
    user.posts.push(newPost.id);
  }

  return { createPost: newPost };
}

function handleUpdateUser(query, variables) {
  const idMatch = query.match(/id:\s*(\d+)/);
  const nameMatch = query.match(/name:\s*"([^"]+)"/);
  const emailMatch = query.match(/email:\s*"([^"]+)"/);

  if (!idMatch) {
    throw new Error("ID is required for updateUser");
  }

  const userId = parseInt(idMatch[1]);
  const userIndex = database.users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    throw new Error(`User with id ${userId} not found`);
  }

  if (nameMatch) database.users[userIndex].name = nameMatch[1];
  if (emailMatch) database.users[userIndex].email = emailMatch[1];

  return { updateUser: database.users[userIndex] };
}

function handleDeleteUser(query, variables) {
  const idMatch = query.match(/id:\s*(\d+)/);

  if (!idMatch) {
    throw new Error("ID is required for deleteUser");
  }

  const userId = parseInt(idMatch[1]);
  const userIndex = database.users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    throw new Error(`User with id ${userId} not found`);
  }

  const deletedUser = database.users.splice(userIndex, 1)[0];

  // Remove user's posts and comments
  database.posts = database.posts.filter((p) => p.authorId !== userId);
  database.comments = database.comments.filter((c) => c.authorId !== userId);

  return { deleteUser: deletedUser };
}

// REST-like endpoints for comparison
app.get("/rest/users", (req, res) => {
  res.json({
    users: database.users,
    total: database.users.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/rest/users/:id", (req, res) => {
  const userId = parseInt(req.params.id);
  const user = database.users.find((u) => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Include posts in REST response
  const userWithPosts = {
    ...user,
    posts: user.posts.map((postId) =>
      database.posts.find((p) => p.id === postId)
    ),
  };

  res.json({ user: userWithPosts, timestamp: new Date().toISOString() });
});

app.post("/rest/users", (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  const newUser = {
    id: Math.max(...database.users.map((u) => u.id)) + 1,
    name,
    email,
    posts: [],
  };

  database.users.push(newUser);

  res.status(201).json({
    user: newUser,
    message: "User created successfully",
    timestamp: new Date().toISOString(),
  });
});

app.get("/rest/posts", (req, res) => {
  const { authorId } = req.query;
  let filteredPosts = database.posts;

  if (authorId) {
    filteredPosts = database.posts.filter(
      (p) => p.authorId === parseInt(authorId)
    );
  }

  // Include author information
  const postsWithAuthors = filteredPosts.map((post) => ({
    ...post,
    author: database.users.find((u) => u.id === post.authorId),
  }));

  res.json({
    posts: postsWithAuthors,
    total: postsWithAuthors.length,
    timestamp: new Date().toISOString(),
  });
});

app.post("/rest/posts", (req, res) => {
  const { title, content, authorId } = req.body;

  if (!title || !content || !authorId) {
    return res
      .status(400)
      .json({ error: "Title, content, and authorId are required" });
  }

  const newPost = {
    id: Math.max(...database.posts.map((p) => p.id)) + 1,
    title,
    content,
    authorId: parseInt(authorId),
    comments: [],
  };

  database.posts.push(newPost);

  // Add post to user's posts array
  const user = database.users.find((u) => u.id === newPost.authorId);
  if (user) {
    user.posts.push(newPost.id);
  }

  res.status(201).json({
    post: newPost,
    message: "Post created successfully",
    timestamp: new Date().toISOString(),
  });
});

// Introspection endpoint (simplified GraphQL introspection)
app.get("/graphql/schema", (req, res) => {
  const schema = {
    types: {
      User: {
        fields: ["id", "name", "email", "posts"],
      },
      Post: {
        fields: ["id", "title", "content", "authorId", "author", "comments"],
      },
      Comment: {
        fields: ["id", "content", "postId", "authorId"],
      },
    },
    queries: ["users", "user(id: Int)", "posts", "post(id: Int)"],
    mutations: ["createUser", "createPost", "updateUser", "deleteUser"],
  };

  res.json({ schema, timestamp: new Date().toISOString() });
});

// Start server
app.listen(port, () => {
  console.log(`Test API 2 (GraphQL-like) running on port ${port}`);
});

module.exports = app;
