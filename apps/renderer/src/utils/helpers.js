export const formatJson = (jsonString) => {
  if (jsonString === null) return "null";
  if (jsonString === undefined) return "undefined";
  if (typeof jsonString === "string" && jsonString.trim() === "") return "";

  try {
    // If it's already an object, stringify and parse to ensure formatting
    if (typeof jsonString === "object") {
      return JSON.stringify(jsonString, null, 2);
    }

    return JSON.stringify(JSON.parse(jsonString), null, 2);
  } catch {
    return jsonString;
  }
};

export const formatContent = (content, contentType = "") => {
  if (content === null) return "null";
  if (content === undefined) return "undefined";
  if (typeof content === "string" && content.trim() === "") return "";

  // Check if content is a binary content message
  if (typeof content === "string" && content.startsWith("[Binary content:")) {
    return content;
  }

  // Check if content looks like a binary content message pattern
  if (
    typeof content === "string" &&
    (content.includes("[Binary request:") ||
      content.includes("[Content processing error:") ||
      content.includes("[Request processing error:"))
  ) {
    return content;
  }

  // Check for content type hints
  if (contentType) {
    const lowerContentType = contentType.toLowerCase();
    if (
      lowerContentType.includes("image/") ||
      lowerContentType.includes("video/") ||
      lowerContentType.includes("audio/") ||
      lowerContentType.includes("application/octet-stream") ||
      lowerContentType.includes("application/pdf") ||
      lowerContentType.includes("application/zip")
    ) {
      return `[Binary content: ${contentType}]`;
    }
  }

  // Try to format as JSON for structured content
  try {
    if (typeof content === "object") {
      return JSON.stringify(content, null, 2);
    }

    // Check if string content might be JSON
    if (typeof content === "string") {
      const trimmed = content.trim();
      if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
      ) {
        try {
          return JSON.stringify(JSON.parse(content), null, 2);
        } catch {
          // Not valid JSON, return as-is
          return content;
        }
      }
    }

    return content;
  } catch {
    return content;
  }
};

export const isBinaryContent = (content) => {
  if (!content) return false;
  if (typeof content !== "string") return false;

  return (
    content.startsWith("[Binary content:") ||
    content.startsWith("[Binary request:") ||
    content.includes("[Content processing error:") ||
    content.includes("[Request processing error:")
  );
};

export const formatDuration = (milliseconds) => {
  if (!milliseconds || milliseconds < 0) return "0ms";

  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export const getProtocolIcon = (protocol) => {
  const icons = {
    http: "🌐",
    https: "🔒",
    ws: "⚡",
    wss: "🔐",
    ftp: "�",
    ssh: "🔑",
    tcp: "🔌",
    udp: "📡",
    postgresql: "�",
    mysql: "🐬",
  };

  return icons[protocol] || "❓";
};

export const getStatusColor = (status) => {
  if (!status) return "gray";

  // Note: This function is case-sensitive
  if (status === "success" || status === "completed") {
    return "green";
  }

  if (status === "failed" || status === "error") {
    return status === "failed" ? "red" : "orange";
  }

  return "gray";
};

export const getStatusCodeColor = (statusCode) => {
  if (!statusCode || typeof statusCode !== "number") return "gray";

  if (statusCode >= 200 && statusCode < 300) {
    return "green";
  } else if (statusCode >= 300 && statusCode < 400) {
    return "blue";
  } else if (statusCode >= 400 && statusCode < 500) {
    return "orange";
  } else if (statusCode >= 500) {
    return "red";
  } else {
    return "gray";
  }
};
