import { useState, useEffect } from "react";
import { MdClose, MdDownload, MdUpdate, MdSchedule } from "react-icons/md";

function UpdateModal({
  show,
  updateInfo,
  onDownloadNow,
  onDownloadBackground,
  onLater,
  onClose,
  type = "available", // "available", "downloading", "ready"
}) {
  const [downloadProgress, setDownloadProgress] = useState({
    percent: 0,
    speed: 0,
  });

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.onAutoUpdater) {
      const handleAutoUpdaterEvent = (data) => {
        if (data.event === "update-download-progress") {
          setDownloadProgress({
            percent: data.percent || 0,
            speed: data.bytesPerSecond || 0,
          });
        }
      };

      window.electronAPI.onAutoUpdater(handleAutoUpdaterEvent);

      // Cleanup function would need to be implemented in the parent component
      // since we can't directly remove listeners here
    }
  }, []);

  // Enhanced debug logging and CSS detection
  useEffect(() => {
    console.log("🎨 UpdateModal render effect triggered");
    console.log("🎨 Props:", { show, updateInfo, type });
    console.log("🎨 Show state:", show);
    console.log("🎨 UpdateInfo present:", !!updateInfo);
    console.log("🎨 Type:", type);
    console.log("🎨 Component will render:", show && updateInfo);

    // Check CSS loading
    if (typeof window !== "undefined") {
      const testEl = document.createElement("div");
      testEl.className = "fixed";
      document.body.appendChild(testEl);
      const hasFixedStyles =
        window.getComputedStyle(testEl).position === "fixed";
      document.body.removeChild(testEl);

      console.log("🎨 CSS Status:");
      console.log("🎨   - Tailwind 'fixed' class works:", hasFixedStyles);
      console.log(
        "🎨   - Document stylesheets count:",
        document.styleSheets.length
      );
      console.log("🎨   - Using inline styles for modal rendering");
    }

    if (show && updateInfo) {
      console.log("🎨 ✅ UpdateModal should be visible");
      console.log(
        "🎨 UpdateInfo details:",
        JSON.stringify(updateInfo, null, 2)
      );
    } else {
      console.log("🎨 ❌ UpdateModal will not be visible");
      if (!show) console.log("🎨 Reason: show is false");
      if (!updateInfo) console.log("🎨 Reason: updateInfo is missing");
    }
  }, [show, updateInfo, type]);

  if (!show) {
    console.log("🎨 🚫 UpdateModal: not showing (show=false)");
    console.log("🎨 🚫 Current show value:", show);
    return null;
  }

  if (!updateInfo) {
    console.log("🎨 🚫 UpdateModal: not showing (no updateInfo)");
    console.log("🎨 🚫 Current updateInfo value:", updateInfo);
    return null;
  }

  console.log("🎨 ✅ UpdateModal: rendering modal");
  console.log("🎨 ✅ Final render props:", { show, updateInfo, type });

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatSpeed = (bytesPerSecond) => {
    return formatBytes(bytesPerSecond) + "/s";
  };

  const renderAvailableModal = () => {
    console.log("🎨 Rendering Available Modal");
    console.log("🎨 UpdateInfo in renderAvailable:", updateInfo);

    return (
      <div style={{ padding: "24px", minHeight: "200px" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <MdUpdate style={{ color: "white", fontSize: "24px" }} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "20px",
                  fontWeight: "bold",
                  color: "#111827",
                  margin: 0,
                }}
              >
                Update Available
              </h2>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  margin: "4px 0 0 0",
                }}
              >
                Sniffler{" "}
                {updateInfo.version ? String(updateInfo.version) : "Latest"} is
                ready to download
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px",
              borderRadius: "50%",
              border: "none",
              backgroundColor: "transparent",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#f3f4f6")}
            onMouseLeave={(e) =>
              (e.target.style.backgroundColor = "transparent")
            }
          >
            <MdClose style={{ color: "#6b7280", fontSize: "20px" }} />
          </button>
        </div>

        {/* Current vs New Version */}
        <div
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  margin: "0 0 4px 0",
                }}
              >
                Current Version
              </p>
              <p style={{ fontWeight: "600", color: "#111827", margin: 0 }}>
                {updateInfo.currentVersion
                  ? String(updateInfo.currentVersion)
                  : "Unknown"}
              </p>
            </div>
            <div style={{ fontSize: "24px", color: "#6b7280" }}>→</div>
            <div>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6b7280",
                  margin: "0 0 4px 0",
                }}
              >
                New Version
              </p>
              <p style={{ fontWeight: "600", color: "#3b82f6", margin: 0 }}>
                {updateInfo.version ? String(updateInfo.version) : "Latest"}
              </p>
            </div>
          </div>
        </div>

        {/* Release Notes */}
        {updateInfo.releaseNotes && (
          <div style={{ marginBottom: "24px" }}>
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#111827",
                marginBottom: "12px",
              }}
            >
              What's New
            </h3>
            <div
              style={{
                backgroundColor: "#f9fafb",
                borderRadius: "8px",
                padding: "16px",
                maxHeight: "160px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "14px",
                  color: "#374151",
                  whiteSpace: "pre-wrap",
                  lineHeight: "1.5",
                }}
              >
                {typeof updateInfo.releaseNotes === "string"
                  ? updateInfo.releaseNotes
                  : String(
                      updateInfo.releaseNotes || "No release notes available"
                    )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}
        >
          <button
            onClick={onLater}
            style={{
              padding: "8px 16px",
              color: "#6b7280",
              backgroundColor: "transparent",
              border: "none",
              fontWeight: "500",
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.color = "#374151")}
            onMouseLeave={(e) => (e.target.style.color = "#6b7280")}
          >
            Later
          </button>
          <button
            onClick={onDownloadBackground}
            style={{
              padding: "8px 16px",
              backgroundColor: "#e5e7eb",
              color: "#374151",
              borderRadius: "8px",
              border: "none",
              fontWeight: "500",
              transition: "background-color 0.2s",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => (e.target.style.backgroundColor = "#d1d5db")}
            onMouseLeave={(e) => (e.target.style.backgroundColor = "#e5e7eb")}
          >
            <MdSchedule />
            Download in Background
          </button>
          <button
            onClick={onDownloadNow}
            style={{
              padding: "8px 24px",
              background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
              color: "white",
              borderRadius: "8px",
              border: "none",
              fontWeight: "500",
              transition: "all 0.2s",
              boxShadow:
                "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => {
              e.target.style.background =
                "linear-gradient(to right, #2563eb, #7c3aed)";
              e.target.style.boxShadow =
                "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
            }}
            onMouseLeave={(e) => {
              e.target.style.background =
                "linear-gradient(to right, #3b82f6, #8b5cf6)";
              e.target.style.boxShadow =
                "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
            }}
          >
            <MdDownload />
            Download Now
          </button>
        </div>
      </div>
    );
  };

  const renderDownloadingModal = () => (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "linear-gradient(to right, #10b981, #3b82f6)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MdDownload
              style={{
                color: "white",
                fontSize: "24px",
                animation: "bounce 1s infinite",
              }}
            />
          </div>
          <div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "#111827",
                margin: 0,
              }}
            >
              Downloading Update
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                margin: "4px 0 0 0",
              }}
            >
              Sniffler{" "}
              {updateInfo.version ? String(updateInfo.version) : "Latest"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "8px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#f3f4f6")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
        >
          <MdClose style={{ color: "#6b7280", fontSize: "20px" }} />
        </button>
      </div>

      {/* Progress Bar */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "14px",
            color: "#6b7280",
            marginBottom: "8px",
          }}
        >
          <span>Progress</span>
          <span>{Math.round(downloadProgress.percent || 0)}%</span>
        </div>
        <div
          style={{
            width: "100%",
            backgroundColor: "#e5e7eb",
            borderRadius: "9999px",
            height: "12px",
          }}
        >
          <div
            style={{
              background: "linear-gradient(to right, #10b981, #3b82f6)",
              height: "12px",
              borderRadius: "9999px",
              transition: "all 0.3s ease-out",
              width: `${downloadProgress.percent || 0}%`,
            }}
          />
        </div>
      </div>

      {/* Download Stats */}
      {downloadProgress.speed > 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: "14px",
            color: "#6b7280",
            marginBottom: "16px",
          }}
        >
          Download speed: {formatSpeed(downloadProgress.speed)}
        </div>
      )}

      {/* Message */}
      <div style={{ textAlign: "center", color: "#374151" }}>
        <p style={{ margin: 0, fontSize: "16px" }}>
          Please wait while the update downloads...
        </p>
        <p style={{ fontSize: "14px", color: "#6b7280", margin: "8px 0 0 0" }}>
          You can continue using Sniffler while the download completes.
        </p>
      </div>
    </div>
  );

  const renderReadyModal = () => (
    <div style={{ padding: "24px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              background: "linear-gradient(to right, #10b981, #059669)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ color: "white", fontSize: "24px" }}>🎉</span>
          </div>
          <div>
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                color: "#111827",
                margin: 0,
              }}
            >
              Update Ready to Install
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                margin: "4px 0 0 0",
              }}
            >
              Sniffler{" "}
              {updateInfo.version ? String(updateInfo.version) : "Latest"}{" "}
              download complete
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "8px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#f3f4f6")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "transparent")}
        >
          <MdClose style={{ color: "#6b7280", fontSize: "20px" }} />
        </button>
      </div>

      {/* Status */}
      <div
        style={{
          backgroundColor: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#16a34a" }}>✅</span>
          <span style={{ color: "#15803d", fontWeight: "500" }}>
            Download complete and verified
          </span>
        </div>
      </div>

      {/* Installation Info */}
      <div
        style={{
          backgroundColor: "#eff6ff",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <h3
          style={{ fontWeight: "600", color: "#1e3a8a", marginBottom: "8px" }}
        >
          Installation Process
        </h3>
        <ul
          style={{
            fontSize: "14px",
            color: "#1e40af",
            margin: 0,
            padding: "0 0 0 16px",
            lineHeight: "1.6",
          }}
        >
          <li>• Sniffler will close and restart automatically</li>
          <li>• All running proxies will be restored</li>
          <li>• Your settings and data will be preserved</li>
        </ul>
      </div>

      {/* Warning */}
      <div
        style={{
          backgroundColor: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "8px",
          padding: "16px",
          marginBottom: "24px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <span style={{ color: "#d97706", marginTop: "2px" }}>⚠️</span>
          <div>
            <p style={{ color: "#92400e", fontWeight: "500", margin: 0 }}>
              Important
            </p>
            <p
              style={{
                fontSize: "14px",
                color: "#a16207",
                margin: "4px 0 0 0",
              }}
            >
              Save any work and close other applications if needed before
              installing.
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
        <button
          onClick={onLater}
          style={{
            padding: "8px 16px",
            color: "#6b7280",
            backgroundColor: "transparent",
            border: "none",
            fontWeight: "500",
            cursor: "pointer",
            transition: "color 0.2s",
          }}
          onMouseEnter={(e) => (e.target.style.color = "#374151")}
          onMouseLeave={(e) => (e.target.style.color = "#6b7280")}
        >
          Install Later
        </button>
        <button
          onClick={() =>
            window.electronAPI?.installUpdate &&
            window.electronAPI.installUpdate()
          }
          style={{
            padding: "8px 16px",
            backgroundColor: "#e5e7eb",
            color: "#374151",
            borderRadius: "8px",
            border: "none",
            fontWeight: "500",
            transition: "background-color 0.2s",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
          onMouseEnter={(e) => (e.target.style.backgroundColor = "#d1d5db")}
          onMouseLeave={(e) => (e.target.style.backgroundColor = "#e5e7eb")}
        >
          <MdSchedule />
          Install When I Close App
        </button>
        <button
          onClick={() =>
            window.electronAPI?.installUpdate &&
            window.electronAPI.installUpdate()
          }
          style={{
            padding: "8px 24px",
            background: "linear-gradient(to right, #10b981, #059669)",
            color: "white",
            borderRadius: "8px",
            border: "none",
            fontWeight: "500",
            transition: "all 0.2s",
            boxShadow:
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
          onMouseEnter={(e) => {
            e.target.style.background =
              "linear-gradient(to right, #059669, #047857)";
            e.target.style.boxShadow =
              "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)";
          }}
          onMouseLeave={(e) => {
            e.target.style.background =
              "linear-gradient(to right, #10b981, #059669)";
            e.target.style.boxShadow =
              "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
          }}
        >
          <MdUpdate />
          Install Now & Restart
        </button>
      </div>
    </div>
  );

  // CSS animation styles
  const animationStyles = `
    @keyframes bounce {
      0%, 20%, 53%, 80%, 100% {
        transform: translateY(0);
      }
      40%, 43% {
        transform: translateY(-8px);
      }
      70% {
        transform: translateY(-4px);
      }
      90% {
        transform: translateY(-2px);
      }
    }
  `;

  return (
    <>
      <style>{animationStyles}</style>
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          padding: "16px",
          backdropFilter: "blur(4px)",
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow:
              "0 25px 50px -12px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05)",
            width: "100%",
            maxWidth: "36rem",
            maxHeight: "90vh",
            overflow: "auto",
            border: "1px solid rgba(229, 231, 235, 0.8)",
            minHeight: "200px", // Ensure minimum height
          }}
        >
          {/* Debug info */}
          <div
            style={{
              padding: "12px 16px",
              backgroundColor: "#f8fafc",
              fontSize: "12px",
              borderBottom: "1px solid #e2e8f0",
              color: "#64748b",
              fontFamily: "monospace",
            }}
          >
            🔧 Debug: show={String(show)}, type="{type}", updateInfo=
            {updateInfo ? "present" : "missing"}
            <br />
            🔧 UpdateInfo.version:{" "}
            {updateInfo?.version ? String(updateInfo.version) : "N/A"}
            <br />
            🔧 Render conditions: {type === "available"
              ? "✅ available"
              : "❌"}{" "}
            | {type === "downloading" ? "✅ downloading" : "❌"} |{" "}
            {type === "ready" ? "✅ ready" : "❌"}
          </div>

          {/* Fallback content if no type matches */}
          {type !== "available" &&
            type !== "downloading" &&
            type !== "ready" && (
              <div style={{ padding: "24px", textAlign: "center" }}>
                <h2 style={{ color: "#ef4444", marginBottom: "16px" }}>
                  ⚠️ Unknown Update State
                </h2>
                <p style={{ color: "#6b7280", marginBottom: "16px" }}>
                  Update modal is showing but type "{type}" is not recognized.
                </p>
                <button
                  onClick={onClose}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            )}

          {type === "available" && renderAvailableModal()}
          {type === "downloading" && renderDownloadingModal()}
          {type === "ready" && renderReadyModal()}

          {/* Ensure at least one content block renders */}
          {!type && (
            <div
              style={{
                padding: "24px",
                textAlign: "center",
                backgroundColor: "#fee2e2",
              }}
            >
              <h2 style={{ color: "#dc2626" }}>🚨 No Update Type Specified</h2>
              <p>Modal is showing but no type is set.</p>
              <button
                onClick={onClose}
                style={{
                  padding: "8px 16px",
                  marginTop: "16px",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Close Modal
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default UpdateModal;
