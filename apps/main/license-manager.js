const crypto = require("crypto");
const os = require("os");
const https = require("https");
const http = require("http");

class LicenseManager {
  constructor() {
    // Use production API by default, can be overridden via environment variable
    const rawBase =
      process.env.SNIFFLER_LICENSING_API_URL ||
      "https://sniffler-licensing-api-preview.vercel.app/api/";

    // Robust normalization: ensure scheme and /api path are present; remove trailing slashes
    this.apiBaseUrl = (() => {
      try {
        let base = String(rawBase).trim();
        // If user provided just a host (or missing scheme), default to https
        if (!/^https?:\/\//i.test(base)) {
          base = `https://${base}`;
        }
        // Parse and ensure it includes the /api base since Vercel functions mount there
        const u = new URL(base);
        // If no explicit path or not pointing to an api path, append /api
        const hasApiSegment = /(^|\/)api(\/|$)/i.test(u.pathname);
        if (!hasApiSegment) {
          const cleanPath = u.pathname.replace(/\/+$/g, "");
          u.pathname = `${cleanPath}${
            cleanPath === "" || cleanPath === "/" ? "" : ""
          }/api`;
        }
        // Return without trailing slash to avoid // when joining paths
        return u.toString().replace(/\/+$/g, "");
      } catch (e) {
        // Fall back to a known-good default
        const fallback =
          "https://sniffler-licensing-api-preview.vercel.app/api";
        try {
          console.warn(
            `⚠️  [LicenseManager] Invalid SNIFFLER_LICENSING_API_URL (${rawBase}). Falling back to ${fallback}: ${e.message}`
          );
        } catch (_) {}
        return fallback;
      }
    })();
    try {
      console.log(
        `🔧 [LicenseManager] API base resolved to: ${this.apiBaseUrl}`
      );
    } catch (_) {}
    this.licenseKey = null;
    this.licenseEmail = null; // optional email for email-based activation
    this.licenseStatus = null;
    this.lastCheck = null;
    this.checkInterval = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
    this.intervalId = null;
    this.trialAttempted = false; // persisted flag to avoid repeated auto-starting
  }

  // HTTP request helper method to replace fetch
  async makeHttpRequest(url, options = {}, redirectCount = 0) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === "https:";
      const requestModule = isHttps ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || "GET",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Sniffler-License-Manager/1.0",
          ...(options.headers || {}),
        },
        timeout: 30000, // 30 second timeout
      };

      // Add content-length header for body requests
      if (
        options.body &&
        (options.method === "POST" ||
          options.method === "PUT" ||
          options.method === "PATCH")
      ) {
        requestOptions.headers["Content-Length"] = Buffer.byteLength(
          options.body
        );
      }

      const req = requestModule.request(requestOptions, (res) => {
        let responseBody = "";

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          try {
            // Follow redirects (e.g., Vercel may return 308 for path normalization)
            if (
              res.statusCode >= 300 &&
              res.statusCode < 400 &&
              res.headers &&
              res.headers.location
            ) {
              if (redirectCount >= 3) {
                const err = new Error(
                  `Too many redirects (last status ${res.statusCode})`
                );
                err.statusCode = res.statusCode;
                err.headers = res.headers;
                return reject(err);
              }
              const nextUrl = new URL(res.headers.location, url).toString();
              return this.makeHttpRequest(nextUrl, options, redirectCount + 1)
                .then(resolve)
                .catch(reject);
            }

            // Check if the response status indicates success
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const result = JSON.parse(responseBody || "null");
              resolve(result);
            } else {
              // Try to parse error response
              let errorMessage = `HTTP ${res.statusCode}`;
              let parsed;
              try {
                parsed = responseBody ? JSON.parse(responseBody) : undefined;
                if (parsed && parsed.error) {
                  errorMessage = parsed.error;
                  if (parsed.details) {
                    errorMessage += ` (${parsed.details})`;
                  }
                }
              } catch (parseError) {
                // If we can't parse the error response, use the status code
                errorMessage = `HTTP ${res.statusCode} - ${responseBody}`;
              }
              const err = new Error(errorMessage);
              err.statusCode = res.statusCode;
              err.headers = res.headers;
              err.responseBody = responseBody;
              if (parsed !== undefined) err.responseJson = parsed;
              return reject(err);
            }
          } catch (error) {
            const err = new Error(`Failed to parse response: ${error.message}`);
            return reject(err);
          }
        });
      });

      req.on("error", (error) => {
        const err = new Error(`Network error: ${error.message}`);
        if (error && error.code) err.code = error.code; // e.g., ENOTFOUND, ECONNREFUSED
        return reject(err);
      });

      req.on("timeout", () => {
        req.destroy();
        const err = new Error("Request timeout after 30 seconds");
        err.code = "ETIMEDOUT";
        return reject(err);
      });

      // Write the request body if present
      if (
        options.body &&
        (options.method === "POST" ||
          options.method === "PUT" ||
          options.method === "PATCH")
      ) {
        req.write(options.body);
      }

      req.end();
    });
  }

  // Build a valid API URL by ensuring exactly one slash between base and path
  buildApiUrl(pathname) {
    const base = this.apiBaseUrl; // already normalized to no trailing slash
    const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const url = `${base}${path}`;
    try {
      // Lightweight sampling log to help diagnose environment URLs
      if (pathname === "/check-license" || pathname === "/activate-by-email") {
        console.log(`🔧 [LicenseManager] Requesting: ${url}`);
      }
    } catch (_) {}
    return url;
  }

  // Generate machine fingerprint
  generateMachineId() {
    const networkInterfaces = os.networkInterfaces();
    const cpuInfo = os.cpus();
    const platform = os.platform();
    const arch = os.arch();
    const hostname = os.hostname();

    // Create a unique fingerprint based on hardware characteristics
    const fingerprint = {
      platform,
      arch,
      hostname,
      cpuModel: cpuInfo[0]?.model || "",
      cpuCores: cpuInfo.length,
      networkMacs: Object.values(networkInterfaces)
        .flat()
        .filter((iface) => !iface.internal && iface.mac !== "00:00:00:00:00:00")
        .map((iface) => iface.mac)
        .sort()
        .join(","),
    };

    return crypto
      .createHash("sha256")
      .update(JSON.stringify(fingerprint))
      .digest("hex");
  }

  // Load stored license data
  loadStoredLicense() {
    try {
      const { app } = require("electron");
      const path = require("path");
      const fs = require("fs");

      const userDataPath = app.getPath("userData");
      const licenseFile = path.join(userDataPath, "license.json");

      if (fs.existsSync(licenseFile)) {
        const data = JSON.parse(fs.readFileSync(licenseFile, "utf8"));
        this.licenseKey = data.licenseKey;
        this.licenseStatus = data.status;
        this.licenseEmail = data.licenseEmail || null;
        this.lastCheck = new Date(data.lastCheck);
        this.trialAttempted = !!data.trialAttempted;
        return true;
      }
    } catch (error) {
      console.error("Failed to load stored license:", error);
    }
    return false;
  }

  // Save license data
  saveStoredLicense() {
    try {
      const { app } = require("electron");
      const path = require("path");
      const fs = require("fs");

      const userDataPath = app.getPath("userData");
      const licenseFile = path.join(userDataPath, "license.json");

      const data = {
        licenseKey: this.licenseKey,
        licenseEmail: this.licenseEmail,
        status: this.licenseStatus,
        lastCheck: new Date().toISOString(),
        trialAttempted: !!this.trialAttempted,
      };

      fs.writeFileSync(licenseFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Failed to save license data:", error);
    }
  }

  // Check license status with API
  async checkLicense() {
    try {
      const machineId = this.generateMachineId();

      let result;
      // If a license key is present, use the key-based check
      if (this.licenseKey) {
        const url = this.buildApiUrl("/check-license");
        console.log("🔎 [LicenseManager] Checking license via key at:", url);
        result = await this.makeHttpRequest(url, {
          method: "POST",
          body: JSON.stringify({
            machineId,
            licenseKey: this.licenseKey,
          }),
        });
      } else if (this.licenseEmail) {
        // Otherwise if an email is stored, try email-based activation
        const activateUrl = this.buildApiUrl("/activate-by-email");
        console.log(
          "🔎 [LicenseManager] Activating by email at:",
          activateUrl,
          "for",
          this.licenseEmail
        );
        const activation = await this.makeHttpRequest(activateUrl, {
          method: "POST",
          body: JSON.stringify({ email: this.licenseEmail, machineId }),
        });
        if (activation?.success && activation.assignedLicense) {
          // Persist the assigned license key and continue with normal check
          this.licenseKey = activation.assignedLicense;
          this.saveStoredLicense();
          const url2 = this.buildApiUrl("/check-license");
          console.log(
            "🔎 [LicenseManager] Verifying assigned license at:",
            url2
          );
          result = await this.makeHttpRequest(url2, {
            method: "POST",
            body: JSON.stringify({ machineId, licenseKey: this.licenseKey }),
          });
        } else {
          // No email assignment found, fall back to free status
          result = {
            status: "free",
            isPremium: false,
            message:
              activation?.error ||
              "No license key or assigned email found - using free version",
          };
        }
      } else {
        // Neither key nor email. If we already have a trial/premium status from auto-start,
        // do NOT overwrite it with free fallback.
        if (
          this.licenseStatus &&
          (this.licenseStatus.isTrial || this.licenseStatus.isPremium)
        ) {
          // Preserve existing state; just return it.
          return { ...this.licenseStatus, networkError: false };
        }
        result = {
          status: "free",
          isPremium: false,
          isTrial: false,
          message: "No license key provided - using free version",
        };
      }

      // Mark successful check (no network error)
      result = { ...result, networkError: false };
      // If result is free but we previously had a trial/premium (shouldn't happen now, but safeguard)
      if (
        result.status === "free" &&
        this.licenseStatus &&
        (this.licenseStatus.isTrial || this.licenseStatus.isPremium)
      ) {
        // Keep the higher privilege state
        result = { ...this.licenseStatus, networkError: false };
      }
      this.licenseStatus = result;
      this.lastCheck = new Date();
      this.saveStoredLicense();

      return result;
    } catch (error) {
      console.error("❌ [LicenseManager] License check failed:", error);

      // Determine if this is a true network/outage error vs an application error (4xx, 429, etc.)
      const messageText = String(error?.message || "");
      const statusCode = error?.statusCode;
      const netCode = error?.code; // ENOTFOUND, ECONNREFUSED, ETIMEDOUT, etc.
      const isNetworkOutage =
        !statusCode &&
        (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i.test(
          netCode || messageText
        ) ||
          /timeout/i.test(messageText));

      // If it's not a network outage (e.g., 400/404/429), don't scare users with unreachable banner
      if (!isNetworkOutage) {
        let friendlyMessage = messageText || "License check failed";
        // Prefer API-provided error when available
        if (error?.responseJson?.error)
          friendlyMessage = error.responseJson.error;

        // Special case: activating by email but no assignment found -> treat as free without networkError
        if (statusCode === 404 && this.licenseEmail && !this.licenseKey) {
          friendlyMessage =
            friendlyMessage ||
            "No active license assigned to this email. Please verify the email or ask your admin.";
        }
        if (statusCode === 429) {
          friendlyMessage =
            friendlyMessage ||
            "Too many requests to licensing server. Please wait a minute and retry.";
        }

        const fallback = {
          status: "free",
          isPremium: false,
          isTrial: false,
          message: friendlyMessage,
          networkError: false,
        };
        this.licenseStatus = fallback;
        this.lastCheck = new Date();
        this.saveStoredLicense();
        return fallback;
      }

      // For actual network outages, allow cached status if recent
      if (this.licenseStatus && this.lastCheck) {
        const hoursSinceCheck =
          (new Date() - this.lastCheck) / (1000 * 60 * 60);
        if (hoursSinceCheck < 24) {
          console.log("Using cached license status due to network issue");
          this.licenseStatus = {
            ...this.licenseStatus,
            networkError: true,
            message:
              this.licenseStatus.message ||
              "Using cached license due to licensing server unavailability",
          };
          return this.licenseStatus;
        }
      }

      // Default to free if no cache available (network outage)
      const fallback = {
        status: "free",
        isPremium: false,
        isTrial: false,
        message:
          "Unable to verify license - licensing server unreachable; using free mode",
        networkError: true,
      };
      this.licenseStatus = fallback;
      this.lastCheck = new Date();
      this.saveStoredLicense();
      return fallback;
    }
  }

  // Start periodic license checking
  startPeriodicCheck() {
    // Clear existing interval if any
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    // Check immediately on start
    this.checkLicense();

    // Set up periodic checking every 12 hours
    this.intervalId = setInterval(() => {
      this.checkLicense();
    }, this.checkInterval);
  }

  // Stop periodic checking
  stopPeriodicCheck() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  // Initialize license manager
  async initialize() {
    this.loadStoredLicense();
    // Attempt auto-start of trial before periodic checks / initial check
    try {
      await this.maybeAutoStartTrial();
    } catch (e) {
      console.warn(
        "⚠️  [LicenseManager] Auto-start trial attempt failed:",
        e.message
      );
    }
    this.startPeriodicCheck();
    return await this.checkLicense();
  }

  // Check if premium features are available
  isPremiumAvailable() {
    return this.licenseStatus?.isPremium === true;
  }

  // Get license status for UI display
  getLicenseInfo() {
    return {
      isPremium: this.isPremiumAvailable(),
      status: this.licenseStatus?.status || "unknown",
      expiresAt: this.licenseStatus?.expiresAt,
      isTrial: this.licenseStatus?.isTrial === true,
      message: this.licenseStatus?.message || "License status unknown",
      trialUsed: this.licenseStatus?.trialUsed === true,
      networkError: this.licenseStatus?.networkError === true,
      cancelAtPeriodEnd: this.licenseStatus?.cancelAtPeriodEnd || false,
      cancellationRequestedAt:
        this.licenseStatus?.cancellationRequestedAt || null,
      licenseKey: this.licenseKey || null,
    };
  }

  // Set license key (from user input)
  setLicenseKey(key) {
    this.licenseKey = key;
    this.saveStoredLicense();
    return this.checkLicense();
  }

  // Set license email (from user input, for email-based activation)
  setLicenseEmail(email) {
    this.licenseEmail = email;
    // Do not immediately clear licenseKey; allow either path
    this.saveStoredLicense();
    return this.checkLicense();
  }

  // Remove license key
  removeLicenseKey() {
    this.licenseKey = null;
    this.licenseStatus = null;
    this.saveStoredLicense();
    return this.checkLicense();
  }

  // Remove license email association
  removeLicenseEmail() {
    this.licenseEmail = null;
    this.saveStoredLicense();
    return this.checkLicense();
  }

  // Clear all license credentials (both key and email) atomically to avoid race conditions
  clearLicense() {
    this.licenseKey = null;
    this.licenseEmail = null;
    this.licenseStatus = null;
    this.saveStoredLicense();
    return this.checkLicense();
  }

  // Start free trial manually (temporary method while automatic activation is disabled)
  async startTrial() {
    try {
      const machineId = this.generateMachineId();

      console.log("Starting free trial manually:", {
        machineId,
        apiUrl: this.buildApiUrl("/start-trial"),
      });

      const result = await this.makeHttpRequest(
        this.buildApiUrl("/start-trial"),
        {
          method: "POST",
          body: JSON.stringify({
            machineId,
          }),
        }
      );

      // Update local license status with the trial info
      // Normalize trial status: treat trial_started as trial_active internally for simpler gating
      const normalized = { ...result };
      if (normalized && normalized.status === "trial_started") {
        normalized.status = "trial_active";
      }
      this.licenseStatus = normalized;
      this.lastCheck = new Date();
      this.saveStoredLicense();

      return normalized;
    } catch (error) {
      console.error("Trial start failed:", error);
      throw error;
    }
  }

  // One-time automatic trial start logic (best-effort)
  async maybeAutoStartTrial() {
    // Skip if a license key or email is already present
    if (this.licenseKey || this.licenseEmail) return false;
    // Skip if we have already attempted (persisted) a trial start
    if (this.trialAttempted) return false;
    // If we have a stored status that is already premium or trial, skip
    if (this.licenseStatus?.isPremium || this.licenseStatus?.isTrial)
      return false;

    const machineId = this.generateMachineId();
    console.log(
      "🔄 [LicenseManager] Attempting automatic free trial start for machine:",
      machineId
    );
    try {
      const result = await this.startTrial();
      this.trialAttempted = true; // mark success so we don't retry
      this.saveStoredLicense();
      console.log("✅ [LicenseManager] Automatic trial started successfully");
      return result;
    } catch (e) {
      // If trial already used (API returns 400 with known message), mark attempted to avoid spam
      const msg = String(e?.message || "");
      const alreadyUsed =
        /trial has already been used/i.test(msg) || /trial_used/i.test(msg);
      if (alreadyUsed || e.statusCode === 400) {
        console.log(
          "ℹ️  [LicenseManager] Trial already used for this machine; not retrying automatically."
        );
        this.trialAttempted = true;
        this.saveStoredLicense();
        return false;
      }
      // For network errors, do NOT mark attempted so we can retry next launch
      const netLike =
        /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|network error|timeout/i.test(
          msg
        );
      if (netLike) {
        console.log(
          "🌐 [LicenseManager] Network issue prevented auto trial; will retry next launch."
        );
        return false;
      }
      // Any other unexpected error -> mark attempted to prevent loops
      this.trialAttempted = true;
      this.saveStoredLicense();
      console.warn(
        "⚠️  [LicenseManager] Unexpected auto trial error; suppressing future attempts:",
        msg
      );
      return false;
    }
  }

  // Create checkout session for purchasing
  async createCheckoutSession(planType, customerEmail) {
    try {
      const machineId = this.generateMachineId();

      console.log("Creating checkout session:", {
        planType,
        customerEmail,
        apiUrl: this.buildApiUrl("/create-checkout"),
        machineId: planType === "individual" ? machineId : undefined,
      });

      return await this.makeHttpRequest(this.buildApiUrl("/create-checkout"), {
        method: "POST",
        body: JSON.stringify({
          planType,
          customerEmail,
          machineId: planType === "individual" ? machineId : undefined,
        }),
      });
    } catch (error) {
      console.error("Checkout session creation failed:", error);
      throw error;
    }
  }

  // Retrieve and activate license after successful payment
  async retrieveAndActivateLicense(sessionId) {
    try {
      const machineId = this.generateMachineId();

      console.log("Retrieving license for session:", {
        sessionId,
        machineId,
        apiUrl: this.buildApiUrl("/retrieve-license"),
      });

      const result = await this.makeHttpRequest(
        this.buildApiUrl("/retrieve-license"),
        {
          method: "POST",
          body: JSON.stringify({
            sessionId,
            machineId,
          }),
        }
      );

      if (result.success && result.assignedLicense) {
        // Automatically set the assigned license key
        this.licenseKey = result.assignedLicense;
        console.log("License automatically activated:", result.assignedLicense);

        // Check the license status to update our local state
        const licenseStatus = await this.checkLicense();

        return {
          success: true,
          licenseKey: result.assignedLicense,
          allLicenseKeys: result.licenseKeys,
          planType: result.planType,
          activated: true,
          ...licenseStatus,
        };
      }

      return result;
    } catch (error) {
      console.error("License retrieval and activation failed:", error);
      throw error;
    }
  }
}

module.exports = LicenseManager;
