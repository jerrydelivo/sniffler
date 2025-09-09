// Simple fix script to restore database proxy functionality
const fs = require("fs");
const path = require("path");

const filePath = path.join(
  __dirname,
  "apps",
  "main",
  "database-proxy-interceptor.js"
);
let content = fs.readFileSync(filePath, "utf8");

// Replace the debug callback with proper handleConnection call
const oldPattern =
  /const server = net\.createServer\(\(clientSocket\) => \{[^}]+\}\);/s;
const newCallback =
  "const server = net.createServer((clientSocket) => {\n        this.handleConnection(clientSocket, proxyConfig);\n      });";

content = content.replace(oldPattern, newCallback);

fs.writeFileSync(filePath, content, "utf8");
console.log("✅ Fixed database proxy connection callback");
