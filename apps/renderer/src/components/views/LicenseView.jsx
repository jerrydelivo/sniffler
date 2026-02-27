import { useState, useEffect } from "react";
import { TextField } from "@mui/material";
import {
  MdSecurity,
  MdShoppingCart,
  MdKey,
  MdVerified,
  MdClose,
  MdInfo,
  MdWarning,
  MdCheckCircle,
} from "react-icons/md";

const PLAN_OPTIONS = [
  {
    id: "individual",
    name: "Individual",
    price: 8,
    description: "Perfect for individual developers",
    features: [
      "Unlimited mock creation & management",
      "Database proxy monitoring",
      "Outgoing request interception",
      "Export/Import functionality",
      "All premium features",
    ],
  },
  {
    id: "bundle_5",
    name: "5-User Bundle",
    price: 25,
    originalPrice: 40,
    description: "Great for small teams",
    savings: "37% off",
    features: [
      "5 individual licenses",
      "All premium features per user",
      "Bulk license management",
      "Team collaboration ready",
    ],
  },
  {
    id: "bundle_10",
    name: "10-User Bundle",
    price: 40,
    originalPrice: 80,
    description: "Perfect for big teams",
    savings: "50% off",
    features: [
      "10 individual licenses",
      "All premium features per user",
      "Bulk license management",
      "Team collaboration ready",
    ],
  },
];

const FREE_FEATURES = [
  "Basic HTTP proxy creation",
  "Real-time request monitoring",
  "Request/response viewing",
  "Basic traffic analysis",
];

const PREMIUM_FEATURES = [
  "Mock creation & management",
  "Database proxy monitoring",
  "Outgoing request interception",
  "Export/Import functionality",
  "API testing & validation",
  "Automated mock generation",
  "Response modification & editing",
  "Mock drift detection & alerts",
];

function LicenseView() {
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [licenseKey, setLicenseKey] = useState("");
  const [activationEmail, setActivationEmail] = useState("");
  const [email, setEmail] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("individual");
  const [loading, setLoading] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [purchasedKeys, setPurchasedKeys] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);

  // Admin section state
  const [adminApiBase, setAdminApiBase] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminCode, setAdminCode] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [adminLicenses, setAdminLicenses] = useState([]);
  const [adminAssignments, setAdminAssignments] = useState({}); // key -> email mapping edits
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminMsg, setAdminMsg] = useState({ type: "", text: "" });
  // Hide admin UI by default; reveal only when admin opts-in
  const [showAdminUI, setShowAdminUI] = useState(false);

  useEffect(() => {
    loadLicenseInfo();

    // Fetch API base for admin endpoints
    (async () => {
      try {
        const res = await window.electronAPI.getLicensingApiBase?.();
        if (res?.success && res.baseUrl) setAdminApiBase(res.baseUrl);
      } catch (e) {
        // Non-fatal; admin actions will fail until configured
        console.warn("Failed to get licensing API base for admin UI", e);
      }
    })();

    // Set up payment success event listeners
    const handlePaymentSuccess = async (data) => {
      console.log("💳 Payment success event received:", data);
      setLoading(true);
      setMessage({
        type: "success",
        text: "🎉 Processing your successful payment...",
      });

      try {
        // Process the payment success
        const result = await window.electronAPI.processPaymentSuccess({
          sessionId: data.sessionId,
        });

        if (result.success) {
          // Reload license info to reflect the new status
          await loadLicenseInfo();
          // Capture all license keys that were issued (for bundles we show them all)
          if (
            Array.isArray(result.allLicenseKeys) &&
            result.allLicenseKeys.length > 0
          ) {
            setPurchasedKeys(result.allLicenseKeys);
          }
          setMessage({
            type: "success",
            text: "✅ Payment successful! Your license has been activated. Welcome to Sniffler Pro!",
          });
          setShowKeyInput(false); // Hide the key input since license is now active
        } else {
          setMessage({
            type: "warning",
            text: `Payment received but license activation pending: ${
              result.error || "Please check your email for the license key."
            }`,
          });
        }
      } catch (error) {
        console.error("Error processing payment success:", error);
        setMessage({
          type: "error",
          text: `Payment successful but activation failed: ${error.message}. Please check your email for the license key.`,
        });
      } finally {
        setLoading(false);
      }
    };

    const handlePaymentCancelled = async (data) => {
      console.log("💳 Payment cancelled event received:", data);

      try {
        const result = await window.electronAPI.processPaymentCancelled();
        setMessage({
          type: "info",
          text: "💳 Payment was cancelled. You can try purchasing again anytime.",
        });
      } catch (error) {
        console.error("Error processing payment cancellation:", error);
      }
    };

    // Add event listeners for payment events
    window.electronAPI.onStripePaymentSuccess(handlePaymentSuccess);
    window.electronAPI.onStripePaymentCancelled(handlePaymentCancelled);

    // Clean up event listeners when component unmounts
    return () => {
      // Note: You may need to add cleanup methods to electronAPI if not already present
      window.electronAPI.removeAllListeners?.("stripe-payment-success");
      window.electronAPI.removeAllListeners?.("stripe-payment-cancelled");
    };
  }, []);

  const loadLicenseInfo = async () => {
    try {
      const info = await window.electronAPI.getLicenseInfo();
      setLicenseInfo(info);
    } catch (error) {
      console.error("Failed to load license info:", error);
    }
  };

  const requestCancelAtPeriodEnd = async () => {
    if (!licenseInfo?.isPremium) return;
    if (
      !confirm(
        "Cancel subscription at period end? You'll retain access until the end of the current paid period."
      )
    )
      return;
    setCancelBusy(true);
    try {
      // Require admin session (owner) to authorize cancellation
      if (!adminToken) {
        setAdminMsg({
          type: "warning",
          text: "Please log in as the purchaser (admin) to cancel the subscription.",
        });
        setShowAdminUI(true);
        return;
      }
      const base = (await window.electronAPI.getLicensingApiBase?.())?.baseUrl;
      const token = adminToken;
      const url = `${(base || "").replace(/\/+$/g, "")}/cancel-subscription`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ licenseKey: licenseInfo?.licenseKey }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) throw new Error(data?.error || "Failed");
      setMessage({
        type: "success",
        text: data.cancelAt
          ? `Subscription will end on ${new Date(
              data.cancelAt
            ).toLocaleDateString()}.`
          : "Cancellation recorded. You'll keep access until period end.",
      });
      await refreshLicenseStatus();
    } catch (e) {
      setMessage({ type: "error", text: `Cancel failed: ${e.message}` });
    } finally {
      setCancelBusy(false);
    }
  };

  const refreshLicenseStatus = async () => {
    setRefreshing(true);
    try {
      await window.electronAPI.checkLicenseStatus?.();
      await loadLicenseInfo();
    } catch (e) {
      // noop — error surfaced via networkError banner
    } finally {
      setRefreshing(false);
    }
  };

  const handleStartTrial = async () => {
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const result = await window.electronAPI.startFreeTrial();
      if (result.success) {
        await loadLicenseInfo();
        setMessage({
          type: "success",
          text: "🎉 Free trial started! You now have 30 days of premium features.",
        });
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to start trial. Please try again.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: `Failed to start trial: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!email.trim()) {
      setMessage({ type: "error", text: "Please enter your email address" });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const result = await window.electronAPI.createCheckoutSession({
        planType: selectedPlan,
        customerEmail: email.trim(),
      });

      if (result.success) {
        // Open Stripe checkout in browser
        await window.electronAPI.openCheckoutUrl(result.checkoutUrl);
        setMessage({
          type: "info",
          text: "🔗 Redirected to secure checkout. Complete your purchase and then enter your license key below.",
        });
        setShowKeyInput(true);
      } else {
        setMessage({
          type: "error",
          text: result.error || "Failed to create checkout session",
        });
      }
    } catch (error) {
      setMessage({ type: "error", text: `Purchase failed: ${error.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateLicense = async () => {
    if (!licenseKey.trim()) {
      setMessage({ type: "error", text: "Please enter your license key" });
      return;
    }

    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const result = await window.electronAPI.setLicenseKey(licenseKey.trim());
      if (result.success) {
        // Force a full license status refresh to ensure app-wide gating updates
        await window.electronAPI.checkLicenseStatus?.();
        // Get the freshest status directly
        const latest = await window.electronAPI.getLicenseInfo();
        setLicenseInfo(latest);
        if (latest?.isPremium || latest?.isTrial) {
          setMessage({
            type: "success",
            text: "🎉 License activated successfully! Premium features are now unlocked.",
          });
          setLicenseKey("");
          setShowKeyInput(false);
        } else {
          setMessage({
            type: "warning",
            text:
              result.error ||
              "License key saved but activation not confirmed yet. Please verify your key or try again in a moment.",
          });
        }
      } else {
        setMessage({
          type: "error",
          text: result.error || "Invalid license key",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: `License activation failed: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleActivateByEmail = async () => {
    if (!activationEmail.trim()) {
      setMessage({ type: "error", text: "Please enter your email" });
      return;
    }
    setLoading(true);
    setMessage({ type: "", text: "" });
    try {
      const result = await window.electronAPI.setLicenseEmail(
        activationEmail.trim()
      );
      if (result.success) {
        // Force a full license status refresh to ensure app-wide gating updates
        await window.electronAPI.checkLicenseStatus?.();
        const latest = await window.electronAPI.getLicenseInfo();
        setLicenseInfo(latest);
        if (latest?.isPremium || latest?.isTrial) {
          setMessage({
            type: "success",
            text: "🎉 Activated by email! Premium features are now unlocked.",
          });
          setActivationEmail("");
        } else {
          const networkMsg = latest?.networkError
            ? "Couldn’t reach the licensing server. We kept your previous status; please retry when online."
            : "Email saved but no active license found for this address. Make sure this email has an assigned license, then try again.";
          setMessage({
            type: "warning",
            text: result.error || networkMsg,
          });
        }
      } else {
        setMessage({
          type: "error",
          text:
            result.error ||
            "No active license assigned to this email or activation failed.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: `Activation by email failed: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveLicense = async () => {
    if (
      !confirm(
        "Are you sure you want to remove your license key? This will disable premium features."
      )
    ) {
      return;
    }

    setLoading(true);
    try {
      // Atomically clear key+email for immediate gating update
      const result =
        (window.electronAPI.clearLicense &&
          (await window.electronAPI.clearLicense())) ||
        (await window.electronAPI.removeLicenseKey());
      if (result.success) {
        // Force refresh and collapse admin UI to reduce confusion
        await window.electronAPI.checkLicenseStatus?.();
        await loadLicenseInfo();
        setShowAdminUI(false);
        setMessage({
          type: "info",
          text: "License key removed. You are now using the free version.",
        });
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: `Failed to remove license: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = () => {
    if (!licenseInfo) return <MdSecurity className="w-6 h-6" />;

    if (licenseInfo.isPremium) {
      return <MdVerified className="w-6 h-6 text-green-500" />;
    } else if (licenseInfo.isTrial) {
      return <MdInfo className="w-6 h-6 text-blue-500" />;
    } else {
      return <MdWarning className="w-6 h-6 text-orange-500" />;
    }
  };

  const getStatusColor = () => {
    if (!licenseInfo) return "gray";

    if (licenseInfo.isPremium) return "green";
    else if (licenseInfo.isTrial) return "blue";
    else return "orange";
  };

  const selectedPlanDetails = PLAN_OPTIONS.find((p) => p.id === selectedPlan);

  // --- Admin UI handlers ---
  const buildAdminUrl = (path) => {
    const base = adminApiBase?.replace(/\/+$/g, "") || "";
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${base}${p}`;
  };

  const requestAdminCode = async () => {
    if (!adminEmail.trim()) {
      setAdminMsg({ type: "error", text: "Enter your admin email" });
      return;
    }
    setAdminBusy(true);
    setAdminMsg({ type: "", text: "" });
    try {
      const resp = await fetch(buildAdminUrl("/admin-request-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail.trim() }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.ok !== true) {
        throw new Error(data?.error || `Request failed (${resp.status})`);
      }
      setAdminMsg({
        type: "success",
        text: data.sent
          ? "Login code sent to your email."
          : "Email disabled in this environment; check server logs for the code.",
      });
    } catch (e) {
      setAdminMsg({ type: "error", text: `Failed to send code: ${e.message}` });
    } finally {
      setAdminBusy(false);
    }
  };

  const verifyAdminCode = async () => {
    if (!adminEmail.trim() || !adminCode.trim()) {
      setAdminMsg({ type: "error", text: "Enter email and code" });
      return;
    }
    setAdminBusy(true);
    setAdminMsg({ type: "", text: "" });
    try {
      const resp = await fetch(buildAdminUrl("/admin-verify-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: adminEmail.trim(),
          code: adminCode.trim(),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.ok !== true || !data?.token) {
        throw new Error(data?.error || `Verification failed (${resp.status})`);
      }
      setAdminToken(data.token);
      setAdminMsg({ type: "success", text: "Logged in as admin." });
      await loadAdminLicenses(data.token);
    } catch (e) {
      setAdminMsg({
        type: "error",
        text: `Failed to verify code: ${e.message}`,
      });
    } finally {
      setAdminBusy(false);
    }
  };

  const loadAdminLicenses = async (token = adminToken) => {
    if (!token) return;
    setAdminBusy(true);
    try {
      const resp = await fetch(buildAdminUrl("/admin-my-licenses"), {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(
          data?.error || `Failed to load licenses (${resp.status})`
        );
      }
      const list = Array.isArray(data?.licenses) ? data.licenses : [];
      setAdminLicenses(list);
      // Initialize editable mapping state
      const map = {};
      for (const l of list) {
        map[l.licenseKey] = l.assignedToEmail || "";
      }
      setAdminAssignments(map);
    } catch (e) {
      setAdminMsg({
        type: "error",
        text: `Failed to load licenses: ${e.message}`,
      });
    } finally {
      setAdminBusy(false);
    }
  };

  const submitAdminAssignments = async () => {
    if (!adminToken) {
      setAdminMsg({ type: "error", text: "Please log in first" });
      return;
    }
    setAdminBusy(true);
    setAdminMsg({ type: "", text: "" });
    try {
      const entries = Object.entries(adminAssignments);
      const reissued = [];
      let updatedLicenses = [...adminLicenses];
      let updatedAssignments = { ...adminAssignments };
      for (const [licenseKey, email] of entries) {
        const trimmed = (email || "").trim();
        // Only submit if changed from current
        const current = adminLicenses.find((l) => l.licenseKey === licenseKey);
        const currentAssigned = (current?.assignedToEmail || "").trim();
        if (trimmed !== currentAssigned) {
          // First try direct assignment (no reissue)
          const resp = await fetch(buildAdminUrl("/admin-assign-email"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminToken}`,
            },
            body: JSON.stringify({ licenseKey, assignedEmail: trimmed }),
          });
          let data = await resp.json().catch(() => ({}));
          if (!resp.ok || data?.ok !== true) {
            // If endpoint not found (likely not yet deployed), fall back to reissue
            if (resp.status === 404) {
              const r2 = await fetch(buildAdminUrl("/admin-revoke-reissue"), {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminToken}`,
                },
                body: JSON.stringify({
                  licenseKey,
                  reassignToEmail: trimmed || undefined,
                  reason: "assign via fallback",
                }),
              });
              const d2 = await r2.json().catch(() => ({}));
              if (!r2.ok || d2?.ok !== true) {
                throw new Error(
                  d2?.error ||
                    `Assignment failed for ${licenseKey} (${r2.status}). The assignment endpoint may not be deployed.`
                );
              } else {
                reissued.push({ oldKey: licenseKey, newKey: d2.newLicenseKey });
                // Update local state to reflect reissued key
                updatedLicenses = updatedLicenses
                  .filter((l) => l.licenseKey !== licenseKey)
                  .concat([
                    {
                      ...current,
                      licenseKey: d2.newLicenseKey,
                      assignedToEmail: trimmed,
                    },
                  ]);
                delete updatedAssignments[licenseKey];
                updatedAssignments[d2.newLicenseKey] = trimmed;
              }
            } else {
              throw new Error(
                data?.error ||
                  `Assignment failed for ${licenseKey} (${resp.status})`
              );
            }
          } else {
            // Direct assignment succeeded: update local state for immediate reflection
            updatedLicenses = updatedLicenses.map((l) =>
              l.licenseKey === licenseKey
                ? { ...l, assignedToEmail: trimmed }
                : l
            );
            updatedAssignments[licenseKey] = trimmed;
          }
        }
      }
      const baseMsg = "Assignments saved.";
      const reissueMsg =
        reissued.length > 0
          ? ` ${reissued.length} license(s) were reissued to apply assignments.`
          : "";
      setAdminMsg({ type: "success", text: baseMsg + reissueMsg });
      // Update UI immediately
      setAdminLicenses(updatedLicenses);
      setAdminAssignments(updatedAssignments);
      // And also refresh from server to ensure consistency
      await loadAdminLicenses();
    } catch (e) {
      setAdminMsg({ type: "error", text: e.message });
    } finally {
      setAdminBusy(false);
    }
  };

  // Note: Explicit revoke & reissue UI removed. Admins can adjust assignments
  // using "Save Assignments"; a fallback reissue occurs automatically if needed.

  return (
    // Mark entire content area as non-draggable so inputs remain focusable in a frameless Electron window
    <div
      className="max-w-6xl mx-auto p-6 space-y-8"
      style={{ WebkitAppRegion: "no-drag" }}
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          License Management
        </h1>
        <p className="text-gray-600">
          Manage your Sniffler license and unlock premium features
        </p>
      </div>

      {/* Current License Status */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {licenseInfo?.networkError && (
          <div className="mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-red-800 text-sm">
            Licensing server appears unreachable. Your current access may be
            based on cached status. Some features could be limited until
            connectivity is restored.
            <div className="mt-2">
              <button
                onClick={refreshLicenseStatus}
                disabled={refreshing}
                className="text-xs px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {refreshing ? "Rechecking..." : "Retry license check"}
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center space-x-4 mb-4">
          {getStatusIcon()}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Current Status:{" "}
              {licenseInfo?.isPremium
                ? "Premium"
                : licenseInfo?.isTrial
                ? "Trial"
                : "Free"}
            </h2>
            <p className="text-gray-600">{licenseInfo?.message}</p>
          </div>
        </div>

        {licenseInfo?.expiresAt && (
          <div
            className={`p-3 rounded-md bg-${getStatusColor()}-50 border border-${getStatusColor()}-200`}
          >
            <p className={`text-${getStatusColor()}-800 text-sm`}>
              {licenseInfo.isTrial ? "Trial" : "License"} expires:{" "}
              {new Date(licenseInfo.expiresAt).toLocaleDateString()}
              {licenseInfo.isTrial && (
                <span className="ml-2 font-medium">
                  (
                  {Math.ceil(
                    (new Date(licenseInfo.expiresAt) - new Date()) /
                      (1000 * 60 * 60 * 24)
                  )}{" "}
                  days remaining)
                </span>
              )}
            </p>
          </div>
        )}

        {licenseInfo?.cancelAtPeriodEnd && licenseInfo?.isPremium && (
          <div className="mt-3 p-3 rounded-md bg-orange-50 border border-orange-200">
            <p className="text-orange-800 text-sm">
              Your subscription is set to cancel at the end of the current
              billing period. You'll retain access until then.
            </p>
          </div>
        )}

        {/* License Actions */}
        <div className="mt-4 flex flex-wrap gap-3">
          {!licenseInfo?.isPremium &&
            !licenseInfo?.isTrial &&
            !licenseInfo?.trialUsed && (
              <button
                onClick={handleStartTrial}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                <MdCheckCircle className="w-4 h-4" />
                <span>{loading ? "Starting..." : "Start Free Trial"}</span>
              </button>
            )}

          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 flex items-center space-x-2"
          >
            <MdKey className="w-4 h-4" />
            <span>Enter License Key</span>
          </button>

          {!licenseInfo?.isPremium && (
            <div className="flex items-center gap-2">
              <div className="min-w-[260px] flex-1">
                <TextField
                  type="email"
                  value={activationEmail}
                  onChange={(e) => setActivationEmail(e.target.value)}
                  placeholder="Activate with your email"
                  size="small"
                  fullWidth
                  onFocus={(e) => e.target.select?.()}
                  onBlur={(e) => setActivationEmail((v) => v.trim())}
                  inputProps={{
                    inputMode: "email",
                    autoComplete: "email",
                    style: { WebkitAppRegion: "no-drag" },
                  }}
                />
              </div>
              <button
                onClick={handleActivateByEmail}
                disabled={loading || !activationEmail.trim()}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Activating..." : "Activate by Email"}
              </button>
            </div>
          )}

          {licenseInfo?.isPremium && (
            <button
              onClick={handleRemoveLicense}
              disabled={loading}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Remove License
            </button>
          )}

          {licenseInfo?.isPremium && !licenseInfo?.cancelAtPeriodEnd && (
            <button
              onClick={requestCancelAtPeriodEnd}
              disabled={cancelBusy}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 disabled:opacity-50"
            >
              {cancelBusy ? "Cancelling..." : "Cancel at period end"}
            </button>
          )}
        </div>

        {/* License Key Input */}
        {showKeyInput && (
          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                License Key
              </label>
              <button
                onClick={() => setShowKeyInput(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <MdClose className="w-4 h-4" />
              </button>
            </div>
            <div className="flex space-x-3">
              <TextField
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="Enter your license key..."
                size="small"
                fullWidth
                autoFocus
                inputProps={{
                  autoComplete: "off",
                  spellCheck: "false",
                  style: { WebkitAppRegion: "no-drag" },
                }}
              />
              <button
                onClick={handleActivateLicense}
                disabled={loading || !licenseKey.trim()}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {loading ? "Activating..." : "Activate"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Message Display */}
      {message.text && (
        <div
          className={`p-4 rounded-md ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : message.type === "error"
              ? "bg-red-50 text-red-800 border border-red-200"
              : message.type === "warning"
              ? "bg-orange-50 text-orange-800 border border-orange-200"
              : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Purchased License Keys (post-checkout) */}
      {purchasedKeys.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Your License Keys
          </h2>
          <p className="text-gray-700 mb-4">
            These keys were also emailed to you. Please store them somewhere
            safe.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {purchasedKeys.map((key, idx) => (
              <div
                key={key}
                className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-md p-3"
              >
                <code className="text-gray-900 font-mono text-sm break-all">
                  {key}
                </code>
                <button
                  className="ml-3 text-sm px-3 py-1 rounded bg-gray-700 text-white hover:bg-gray-800"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(key);
                      setMessage({
                        type: "success",
                        text: "License key copied to clipboard",
                      });
                    } catch (e) {
                      setMessage({ type: "error", text: "Failed to copy key" });
                    }
                  }}
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Tip: Save these keys in a password manager or secure notes app.
          </p>
        </div>
      )}

      {/* Purchase Plans */}
      {!licenseInfo?.isPremium && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Upgrade to Premium
          </h2>

          {/* Plan Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {PLAN_OPTIONS.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`cursor-pointer p-4 rounded-lg border-2 transition-all ${
                  selectedPlan === plan.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="text-center">
                  <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-gray-900">
                      €{plan.price}
                    </span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  {plan.originalPrice && (
                    <div className="mt-1 text-sm text-gray-500 flex items-center justify-center gap-2">
                      <span className="line-through">
                        €{plan.originalPrice}
                      </span>
                      <span className="inline-block px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        {plan.savings}
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-gray-600 mt-2">
                    {plan.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Purchase Form */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Purchase {selectedPlanDetails?.name} - €
              {selectedPlanDetails?.price}/month
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <TextField
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  size="small"
                  fullWidth
                  inputProps={{
                    autoComplete: "email",
                    inputMode: "email",
                    style: { WebkitAppRegion: "no-drag" },
                  }}
                />
              </div>

              <button
                onClick={handlePurchase}
                disabled={loading || !email.trim()}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium flex items-center justify-center space-x-2"
              >
                <MdShoppingCart className="w-5 h-5" />
                <span>
                  {loading
                    ? "Processing..."
                    : `Purchase ${selectedPlanDetails?.name}`}
                </span>
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-3 text-center">
              Secure payment processed by Stripe. You'll receive your license
              key via email after purchase.
            </p>
          </div>
        </div>
      )}

      {/* Feature Comparison */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Feature Comparison
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Free Features */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Free Version
            </h3>
            <ul className="space-y-2">
              {FREE_FEATURES.map((feature, index) => (
                <li key={index} className="flex items-center space-x-3">
                  <MdCheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Premium Features */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Premium Features
            </h3>
            <ul className="space-y-2">
              {PREMIUM_FEATURES.map((feature, index) => (
                <li key={index} className="flex items-center space-x-3">
                  <MdCheckCircle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Admin License Management */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
          Admin License Management
        </h2>
        <div className="flex items-center justify-center mb-4">
          <button
            onClick={() => setShowAdminUI((v) => !v)}
            className="text-sm px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
          >
            {showAdminUI ? "Hide admin tools" : "Manage team licenses (admin)"}
          </button>
        </div>

        {!showAdminUI && (
          <p className="text-gray-600 text-center">
            If you purchased a bundle, click "Manage team licenses (admin)" to
            log in and assign keys to emails.
          </p>
        )}

        {showAdminUI && !adminApiBase && (
          <div className="p-3 rounded-md bg-orange-50 border border-orange-200 mb-4 text-orange-800 text-sm">
            Licensing API base URL is not configured yet. Admin actions may not
            work.
          </div>
        )}

        {showAdminUI && adminMsg.text && (
          <div
            className={`mb-4 p-3 rounded-md ${
              adminMsg.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : adminMsg.type === "error"
                ? "bg-red-50 text-red-800 border border-red-200"
                : adminMsg.type === "warning"
                ? "bg-orange-50 text-orange-800 border border-orange-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
            }`}
          >
            {adminMsg.text}
          </div>
        )}

        {/* Admin Login */}
        {showAdminUI && !adminToken ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Email
              </label>
              <TextField
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="you@company.com"
                size="small"
                fullWidth
                inputProps={{
                  autoComplete: "email",
                  inputMode: "email",
                  style: { WebkitAppRegion: "no-drag" },
                }}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={requestAdminCode}
                disabled={adminBusy || !adminEmail.trim()}
                className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50 w-full"
              >
                {adminBusy ? "Sending..." : "Email me a login code"}
              </button>
            </div>
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code
              </label>
              <div className="flex gap-2">
                <TextField
                  type="text"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  placeholder="6-digit code"
                  size="small"
                  fullWidth
                  inputProps={{ style: { WebkitAppRegion: "no-drag" } }}
                />
                <button
                  onClick={verifyAdminCode}
                  disabled={
                    adminBusy || !adminEmail.trim() || !adminCode.trim()
                  }
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {adminBusy ? "Verifying..." : "Verify"}
                </button>
              </div>
            </div>
          </div>
        ) : showAdminUI ? (
          <div>
            {/* Logged-in controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-gray-600">
                Logged in as <span className="font-medium">{adminEmail}</span>
              </div>
              <button
                onClick={() => {
                  setAdminToken("");
                  setAdminLicenses([]);
                  setAdminMsg({ type: "info", text: "Logged out" });
                  setShowAdminUI(false);
                }}
                className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded"
              >
                Log out
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-gray-700">
                  Your Active Licenses
                </h3>
                <button
                  onClick={() => loadAdminLicenses()}
                  disabled={adminBusy || !adminToken}
                  className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                >
                  Refresh
                </button>
              </div>
              <div className="overflow-auto border border-gray-200 rounded">
                <table className="min-w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2">
                        License Key
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2">
                        Plan
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-3 py-2">
                        Assigned Email
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {adminLicenses.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="text-sm text-gray-500 px-3 py-2"
                        >
                          No active licenses found
                        </td>
                      </tr>
                    )}
                    {adminLicenses.map((l) => (
                      <tr
                        key={l.licenseKey}
                        className="border-b border-gray-100"
                      >
                        <td className="px-3 py-2 font-mono text-xs break-all">
                          {l.licenseKey}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-700">
                          {l.planType || ""}
                        </td>
                        <td className="px-3 py-2">
                          <TextField
                            type="email"
                            value={adminAssignments[l.licenseKey] || ""}
                            onChange={(e) =>
                              setAdminAssignments((prev) => ({
                                ...prev,
                                [l.licenseKey]: e.target.value,
                              }))
                            }
                            placeholder="teammate@company.com"
                            size="small"
                            fullWidth
                            inputProps={{
                              autoComplete: "email",
                              inputMode: "email",
                              style: { WebkitAppRegion: "no-drag" },
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={submitAdminAssignments}
                  disabled={adminBusy || !adminToken}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {adminBusy ? "Saving..." : "Save Assignments"}
                </button>
                <div className="flex-1" />
                <div className="text-xs text-gray-500">
                  Tip: Assigning an email lets your developer activate with
                  their email, no key entry needed.
                </div>
              </div>
              {/* Revoke & reissue controls removed as requested */}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default LicenseView;
