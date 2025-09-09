const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// JSON API compliant data structure
let resources = {
  articles: [
    {
      type: "articles",
      id: "1",
      attributes: {
        title: "JSON API Best Practices",
        content: "Learn how to implement JSON API correctly...",
        publishedAt: "2023-01-15T10:00:00Z",
      },
      relationships: {
        author: { data: { type: "people", id: "1" } },
        comments: {
          data: [
            { type: "comments", id: "1" },
            { type: "comments", id: "2" },
          ],
        },
      },
    },
    {
      type: "articles",
      id: "2",
      attributes: {
        title: "API Design Patterns",
        content: "Exploring different API design patterns...",
        publishedAt: "2023-02-20T14:30:00Z",
      },
      relationships: {
        author: { data: { type: "people", id: "2" } },
        comments: {
          data: [{ type: "comments", id: "3" }],
        },
      },
    },
  ],
  people: [
    {
      type: "people",
      id: "1",
      attributes: {
        firstName: "Emma",
        lastName: "Wilson",
        email: "emma@example.com",
        bio: "Senior API Developer",
      },
      relationships: {
        articles: {
          data: [{ type: "articles", id: "1" }],
        },
      },
    },
    {
      type: "people",
      id: "2",
      attributes: {
        firstName: "David",
        lastName: "Chen",
        email: "david@example.com",
        bio: "Lead Software Engineer",
      },
      relationships: {
        articles: {
          data: [{ type: "articles", id: "2" }],
        },
      },
    },
  ],
  comments: [
    {
      type: "comments",
      id: "1",
      attributes: {
        body: "Excellent article! Very informative.",
        createdAt: "2023-01-16T09:15:00Z",
      },
      relationships: {
        article: { data: { type: "articles", id: "1" } },
        author: { data: { type: "people", id: "2" } },
      },
    },
    {
      type: "comments",
      id: "2",
      attributes: {
        body: "Thanks for sharing these insights.",
        createdAt: "2023-01-17T11:20:00Z",
      },
      relationships: {
        article: { data: { type: "articles", id: "1" } },
        author: { data: { type: "people", id: "1" } },
      },
    },
    {
      type: "comments",
      id: "3",
      attributes: {
        body: "Looking forward to more content like this.",
        createdAt: "2023-02-21T16:45:00Z",
      },
      relationships: {
        article: { data: { type: "articles", id: "2" } },
        author: { data: { type: "people", id: "1" } },
      },
    },
  ],
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "TestAPI3",
    timestamp: new Date().toISOString(),
  });
});

// JSON API Articles endpoints
app.get("/api/articles", (req, res) => {
  const {
    include,
    sort,
    "page[offset]": offset,
    "page[limit]": limit,
  } = req.query;

  let data = [...resources.articles];
  let included = [];

  // Handle sorting
  if (sort) {
    const sortField = sort.startsWith("-") ? sort.slice(1) : sort;
    const sortOrder = sort.startsWith("-") ? -1 : 1;

    data.sort((a, b) => {
      let aVal = a.attributes[sortField] || "";
      let bVal = b.attributes[sortField] || "";
      return aVal.localeCompare(bVal) * sortOrder;
    });
  }

  // Handle pagination
  const offsetNum = parseInt(offset) || 0;
  const limitNum = parseInt(limit) || data.length;
  const totalCount = data.length;
  data = data.slice(offsetNum, offsetNum + limitNum);

  // Handle includes
  if (include) {
    const includeTypes = include.split(",");

    if (includeTypes.includes("author")) {
      data.forEach((article) => {
        const authorId = article.relationships.author.data.id;
        const author = resources.people.find((p) => p.id === authorId);
        if (
          author &&
          !included.find((i) => i.type === "people" && i.id === authorId)
        ) {
          included.push(author);
        }
      });
    }

    if (includeTypes.includes("comments")) {
      data.forEach((article) => {
        article.relationships.comments.data.forEach((commentRef) => {
          const comment = resources.comments.find(
            (c) => c.id === commentRef.id
          );
          if (
            comment &&
            !included.find(
              (i) => i.type === "comments" && i.id === commentRef.id
            )
          ) {
            included.push(comment);
          }
        });
      });
    }
  }

  const response = {
    data,
    meta: {
      totalCount,
      offset: offsetNum,
      limit: limitNum,
    },
    links: {
      self: `/api/articles?page[offset]=${offsetNum}&page[limit]=${limitNum}`,
    },
  };

  if (included.length > 0) {
    response.included = included;
  }

  res.json(response);
});

app.get("/api/articles/:id", (req, res) => {
  const { include } = req.query;
  const article = resources.articles.find((a) => a.id === req.params.id);

  if (!article) {
    return res.status(404).json({
      errors: [
        {
          status: "404",
          title: "Resource not found",
          detail: `Article with id ${req.params.id} not found`,
        },
      ],
    });
  }

  let included = [];

  // Handle includes
  if (include) {
    const includeTypes = include.split(",");

    if (includeTypes.includes("author")) {
      const authorId = article.relationships.author.data.id;
      const author = resources.people.find((p) => p.id === authorId);
      if (author) {
        included.push(author);
      }
    }

    if (includeTypes.includes("comments")) {
      article.relationships.comments.data.forEach((commentRef) => {
        const comment = resources.comments.find((c) => c.id === commentRef.id);
        if (comment) {
          included.push(comment);
        }
      });
    }
  }

  const response = { data: article };
  if (included.length > 0) {
    response.included = included;
  }

  res.json(response);
});

app.post("/api/articles", (req, res) => {
  const { data } = req.body;

  if (!data || data.type !== "articles") {
    return res.status(400).json({
      errors: [
        {
          status: "400",
          title: "Invalid request",
          detail: 'Request must include data with type "articles"',
        },
      ],
    });
  }

  const { attributes, relationships } = data;

  if (!attributes.title || !attributes.content) {
    return res.status(400).json({
      errors: [
        {
          status: "400",
          title: "Missing required attributes",
          detail: "Title and content are required",
        },
      ],
    });
  }

  const newArticle = {
    type: "articles",
    id: String(Math.max(...resources.articles.map((a) => parseInt(a.id))) + 1),
    attributes: {
      title: attributes.title,
      content: attributes.content,
      publishedAt: new Date().toISOString(),
    },
    relationships: relationships || {
      author: { data: null },
      comments: { data: [] },
    },
  };

  resources.articles.push(newArticle);

  res.status(201).json({ data: newArticle });
});

app.patch("/api/articles/:id", (req, res) => {
  const { data } = req.body;
  const articleIndex = resources.articles.findIndex(
    (a) => a.id === req.params.id
  );

  if (articleIndex === -1) {
    return res.status(404).json({
      errors: [
        {
          status: "404",
          title: "Resource not found",
          detail: `Article with id ${req.params.id} not found`,
        },
      ],
    });
  }

  if (!data || data.type !== "articles" || data.id !== req.params.id) {
    return res.status(400).json({
      errors: [
        {
          status: "400",
          title: "Invalid request",
          detail: "Request data type and id must match resource",
        },
      ],
    });
  }

  // Update attributes
  if (data.attributes) {
    Object.assign(resources.articles[articleIndex].attributes, data.attributes);
  }

  // Update relationships
  if (data.relationships) {
    Object.assign(
      resources.articles[articleIndex].relationships,
      data.relationships
    );
  }

  res.json({ data: resources.articles[articleIndex] });
});

app.delete("/api/articles/:id", (req, res) => {
  const articleIndex = resources.articles.findIndex(
    (a) => a.id === req.params.id
  );

  if (articleIndex === -1) {
    return res.status(404).json({
      errors: [
        {
          status: "404",
          title: "Resource not found",
          detail: `Article with id ${req.params.id} not found`,
        },
      ],
    });
  }

  resources.articles.splice(articleIndex, 1);

  res.status(204).send();
});

// JSON API People endpoints
app.get("/api/people", (req, res) => {
  const { include } = req.query;
  let data = [...resources.people];
  let included = [];

  // Handle includes
  if (include && include.includes("articles")) {
    data.forEach((person) => {
      if (person.relationships.articles) {
        person.relationships.articles.data.forEach((articleRef) => {
          const article = resources.articles.find(
            (a) => a.id === articleRef.id
          );
          if (
            article &&
            !included.find(
              (i) => i.type === "articles" && i.id === articleRef.id
            )
          ) {
            included.push(article);
          }
        });
      }
    });
  }

  const response = { data };
  if (included.length > 0) {
    response.included = included;
  }

  res.json(response);
});

app.get("/api/people/:id", (req, res) => {
  const person = resources.people.find((p) => p.id === req.params.id);

  if (!person) {
    return res.status(404).json({
      errors: [
        {
          status: "404",
          title: "Resource not found",
          detail: `Person with id ${req.params.id} not found`,
        },
      ],
    });
  }

  res.json({ data: person });
});

app.post("/api/people", (req, res) => {
  const { data } = req.body;

  if (!data || data.type !== "people") {
    return res.status(400).json({
      errors: [
        {
          status: "400",
          title: "Invalid request",
          detail: 'Request must include data with type "people"',
        },
      ],
    });
  }

  const { attributes } = data;

  if (!attributes.firstName || !attributes.lastName || !attributes.email) {
    return res.status(400).json({
      errors: [
        {
          status: "400",
          title: "Missing required attributes",
          detail: "First name, last name, and email are required",
        },
      ],
    });
  }

  const newPerson = {
    type: "people",
    id: String(Math.max(...resources.people.map((p) => parseInt(p.id))) + 1),
    attributes: {
      firstName: attributes.firstName,
      lastName: attributes.lastName,
      email: attributes.email,
      bio: attributes.bio || "",
    },
    relationships: {
      articles: { data: [] },
    },
  };

  resources.people.push(newPerson);

  res.status(201).json({ data: newPerson });
});

// JSON API Comments endpoints
app.get("/api/comments", (req, res) => {
  const { "filter[article]": articleFilter } = req.query;
  let data = [...resources.comments];

  // Handle filtering
  if (articleFilter) {
    data = data.filter(
      (comment) => comment.relationships.article.data.id === articleFilter
    );
  }

  res.json({ data });
});

app.post("/api/comments", (req, res) => {
  const { data } = req.body;

  if (!data || data.type !== "comments") {
    return res.status(400).json({
      errors: [
        {
          status: "400",
          title: "Invalid request",
          detail: 'Request must include data with type "comments"',
        },
      ],
    });
  }

  const { attributes, relationships } = data;

  if (!attributes.body || !relationships.article) {
    return res.status(400).json({
      errors: [
        {
          status: "400",
          title: "Missing required data",
          detail: "Body and article relationship are required",
        },
      ],
    });
  }

  const newComment = {
    type: "comments",
    id: String(Math.max(...resources.comments.map((c) => parseInt(c.id))) + 1),
    attributes: {
      body: attributes.body,
      createdAt: new Date().toISOString(),
    },
    relationships: relationships,
  };

  resources.comments.push(newComment);

  // Add comment to article's relationships
  const articleId = relationships.article.data.id;
  const article = resources.articles.find((a) => a.id === articleId);
  if (article) {
    article.relationships.comments.data.push({
      type: "comments",
      id: newComment.id,
    });
  }

  res.status(201).json({ data: newComment });
});

// Bulk operations endpoint
app.patch("/api/bulk", (req, res) => {
  const { data } = req.body;

  if (!Array.isArray(data)) {
    return res.status(400).json({
      errors: [
        {
          status: "400",
          title: "Invalid request",
          detail: "Bulk operations require an array of data objects",
        },
      ],
    });
  }

  const results = [];
  const errors = [];

  data.forEach((item, index) => {
    try {
      if (item.type === "articles") {
        const articleIndex = resources.articles.findIndex(
          (a) => a.id === item.id
        );
        if (articleIndex !== -1) {
          if (item.attributes) {
            Object.assign(
              resources.articles[articleIndex].attributes,
              item.attributes
            );
          }
          results.push(resources.articles[articleIndex]);
        } else {
          errors.push({
            status: "404",
            title: "Resource not found",
            detail: `Article with id ${item.id} not found`,
            source: { pointer: `/data/${index}` },
          });
        }
      }
      // Add more bulk operations for other resource types as needed
    } catch (error) {
      errors.push({
        status: "500",
        title: "Internal error",
        detail: error.message,
        source: { pointer: `/data/${index}` },
      });
    }
  });

  const response = { data: results };
  if (errors.length > 0) {
    response.errors = errors;
  }

  res.json(response);
});

// Start server
app.listen(port, () => {
  console.log(`Test API 3 (JSON API) running on port ${port}`);
});

module.exports = app;
