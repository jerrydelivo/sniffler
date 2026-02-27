# Sniffler

Cross-platform Electron desktop app for developers and testers to sniff, proxy, mock, and regression-test real API traffic. Think “Postman for real traffic” with instant mocks, repeatable test flows, and desktop packaging for Windows/macOS/Linux.

## Highlights

- Real HTTP/HTTPS proxy with request/response capture, filtering, and search
- One-click “Save as Mock” and deterministic mock replay with priority rules
- Multi-project, multi-port sniffing with named workspaces
- Fast UI (React + Tailwind) and robust main process (Electron + Node)
- Batteries-included testing: unit, integration, UI, and regression test runners
- Auto-update ready packages for Win/macOS/Linux via electron-builder
- Licensing and trial flow integrated with the Sniffler Licensing API

### Automatic Mock Creation (New)

When the setting "Auto-save new requests as mocks" is enabled (Settings > General), Sniffler will automatically create a disabled mock for every successful (HTTP status 2xx–3xx) response across all supported traffic types:

- Standard proxy HTTP/HTTPS requests (event: `mock-auto-created`)
- Outgoing MITM intercepted requests (event: `outgoing-mock-auto-created`)
- Database queries (event: `database-mock-auto-created`)

Mocks appear instantly in the UI without needing to refresh thanks to real-time IPC events. Auto-created mocks are disabled by default so production traffic is unaffected until you explicitly enable them. This gives you a continuously growing library of up‑to‑date examples you can toggle on for regression testing or temporary isolation from unstable upstream services.

## Repository layout (this package)

```
sniffler/
├─ apps/
│  ├─ main/        # Electron main process (proxy, IPC, app lifecycle)
│  └─ renderer/    # React UI (requests table, mocks, settings)
├─ build/          # Icons, NSIS installer script, build resources
├─ tests/          # Unit, integration, UI, docker/e2e helpers
├─ dist/           # Build artifacts (generated)
├─ package.json    # Scripts, workspaces, electron-builder config
└─ AUTO_UPDATE_GUIDE.md and helper scripts
```

Key dependencies: http-mitm-proxy, electron, electron-updater, ws.

## Install and Run (Windows PowerShell)

From repo root (Nose/sniffler):

- Install dependencies: npm install
- Dev (renderer + main): npm run dev
- Main only: npm run start
- Build renderer: npm run build
- Package app: npm run dist

Notes

- Multiple commands can be chained with PowerShell using the ; separator when needed.
- Dev script uses npm workspaces to launch apps/renderer and apps/main concurrently.

## How it works

1. Main process (apps/main)

- Starts an HTTP/HTTPS MITM proxy (http-mitm-proxy)
- Captures requests/responses, normalizes payloads, and forwards summaries to the renderer via IPC/WebSocket
- Applies mock rules: when a matching mock is enabled, the real request is short-circuited and the mock response is returned
- Manages licensing checks and premium feature gating

2. Renderer (apps/renderer)

- Presents real-time traffic table with filters (method, status, URL, time)
- Request detail pane: headers, body, timing, diff
- Mocks tab: create, enable/disable, edit, import/export collections
- Settings: ports, proxy CA guidance, theme, license status

## Packaging and updates

electron-builder is configured in package.json:

- appId: com.sniffle.app, productName: Sniffler
- Windows targets: nsis and portable, with custom NSIS include (build/installer.nsh)
- Linux targets: AppImage, deb
- macOS target: dmg (x64/arm64)
- Custom URL protocol: sniffler://
- Output to dist/packages

Auto-update can be enabled through electron-updater with GitHub releases. See AUTO_UPDATE_GUIDE.md for details. Publishing is configured but placeholder values must be updated before release.

## Scripts (most useful)

- npm run dev # Start renderer and main together
- npm run start # Start main only (expects renderer build available)
- npm run build # Build renderer assets
- npm run dist # Build and package installers
- npm run test # Composite test runner
- npm run test:unit # Jest unit suite
- npm run test:ui # UI test harness
- npm run test:regression # Regression runner

Additional targeted suites exist under tests/ (integration, e2e, UI updates, etc.).

## Licensing overview

Sniffler supports a free trial and premium features. The desktop app integrates with the Sniffler Licensing API (Vercel). Key points:

- Trial starts on first run and is tied to a machine ID
- Premium unlock via Stripe checkout and license validation
- Tests for the licensing flow exist under tests/unit (e.g., licensing-purchase.test.js)

See the sibling project sniffler-licensing-api for API endpoints and deployment details.

## Pricing & Usage Terms

This repository is open-source under ISC (see [License](#license)), while the packaged "Sniffler" desktop binaries expose premium functionality gated by a subscription license. By running the distributed (packaged) application you agree to these usage terms.

### Plan Tiers (current)

| Tier                 | Who it's for                        | Indicative Price\* | Included                              | Key Limits                                                     |
| -------------------- | ----------------------------------- | ------------------ | ------------------------------------- | -------------------------------------------------------------- |
| Free Trial           | First‑time users evaluating locally | €0 for 14 days     | All core capture + mock basics        | 1 device, non‑commercial, limited premium features (see below) |
| Pro – Individual     | Solo developer                      | €8 / month         | All features, updates                 | 1 active machine (you can transfer)                            |
| Pro – 5 User Bundle  | Small team                          | €25 / month        | 5 seats, all features                 | 5 concurrent active machines                                   |
| Pro – 10 User Bundle | Growing team                        | €40 / month        | 10 seats, all features                | 10 concurrent active machines                                  |
| Enterprise / Custom  | Larger orgs, custom needs           | Contact            | All features + SLA + priority support | As negotiated                                                  |

\*Pricing shown is indicative (from the demo Stripe setup) and may change before public GA. Taxes (VAT/GST) may apply depending on your billing region. If publicly advertised pricing differs, the public website or checkout page is authoritative.

### Feature Access Summary

| Feature                              | Trial                                   | Pro (all)                                          |
| ------------------------------------ | --------------------------------------- | -------------------------------------------------- |
| HTTP/HTTPS capture & filtering       | Yes                                     | Yes                                                |
| Save & replay mocks                  | Yes                                     | Yes                                                |
| Unlimited mock collections           | Limited (up to 3 collections, 50 mocks) | Unlimited                                          |
| Advanced match priority rules        | Limited (basic path & method)           | Full (headers, body predicates, latency injection) |
| Regression test runner               | Limited (10 test cases)                 | Unlimited                                          |
| Auto‑update channel                  | Yes                                     | Yes                                                |
| Premium notifications / integrations | Preview (may be rate‑limited)           | Full                                               |
| Commercial use                       | No (evaluation only)                    | Yes                                                |
| Support                              | Community / best‑effort                 | Priority email (enterprise can add SLA)            |

Limits are enforced client‑side and/or via the Licensing API. Soft limits may show warnings before strict enforcement. Numbers above are defaults; future releases may allow customization.

### Definitions

- "Seat" = a licensed user / machine activation slot. A machine can be deactivated to free a seat.
- "Trial" = a one‑time 14 day evaluation linked to a hardware fingerprint. It cannot be reset via API (see Trial Deletion Policy in licensing API README).
- "Premium Features" = any functionality gated when the license check reports `isPremium: false` (e.g., higher mock limits, advanced matchers).

### Fair Use & Restrictions

You must not:

1. Circumvent, disable, or tamper with licensing checks or trial limits.
2. Resell the unmodified desktop binaries without a separate redistribution agreement.
3. Use the Free Trial for sustained commercial projects beyond evaluation.
4. Bulk export sensitive captured traffic belonging to third parties without consent.

Reasonable automated test usage (CI) is allowed for licensed seats so long as concurrent machine activations do not exceed plan limits.

### Data & Privacy

Captured HTTP(s) traffic stays local unless you explicitly export it. The Licensing API receives only minimal data (machineId, license key / trial state) needed to validate entitlement. No captured payload bodies are transmitted to the licensing service.

### Plan Changes & Grandfathering

We may adjust price points, limits, or included features. Active subscriptions remain on their existing price for at least one renewal cycle after a public change. Material reductions in included limits for paid plans will either (a) not apply to existing subscribers while they keep an active subscription, or (b) be accompanied by an upgrade path with notice ≥30 days.

### Refunds & Cancellations (summary)

- Subscriptions renew automatically until cancelled.
- You can cancel any time; access continues until the period ends. No partial refunds for unused time.
- In the rare case of extended (>24h) service disruption of the Licensing API preventing premium use, pro‑rated credit may be granted.

### Attribution & Open Source License

The source (this repository) is ISC: you can fork, modify, and redistribute source under that license. The name "Sniffler" and official binary distribution branding are reserved; do not imply official affiliation for modified builds without permission.

### Contact

For enterprise quotes, compliance questions, or custom terms: open an issue or email (planned) support@sniffler.app (placeholder – update before launch).

### Quick API Reference

Licensing endpoints: see `sniffler-licensing-api/README.md` for `check-license`, `create-checkout`, and admin endpoints. Desktop app performs periodic POST `/api/check-license` calls to refresh entitlement.

---

## HTTPS interception

To intercept HTTPS, a local CA certificate must be installed and trusted. The app guides you through generating and trusting the CA. For security, capture occurs only on ports you opt into, and data remains local unless explicitly exported by you.

## Uninstall behavior (Windows)

When uninstalling via Programs & Features, the uninstaller asks whether to keep your Sniffler configurations and data.

- Yes = Keep settings (safe if you plan to reinstall). Data typically lives in:
  - %APPDATA%\Sniffler
  - %LOCALAPPDATA%\Sniffler
  - %PROGRAMDATA%\Sniffler (if used)
  - %USERPROFILE%\.sniffler
- No = Remove everything (configs, workspaces, mocks, logs). These folders are deleted if present.

Note: Certificate trust settings you added to the OS remain unless you remove them manually; the CA/key files stored under the folders above are deleted only if you choose No.

## Contributing

We welcome contributions that improve stability, features, or docs.

- Fork, create a branch, and submit a PR
- Add or update tests for behavior changes
- Prefer small, focused commits

## Troubleshooting

- Renderer blank screen: ensure npm run build completed before npm run start
- No traffic captured: verify your app is configured to use the Sniffler proxy and port is correct
- HTTPS not captured: ensure the CA is generated and trusted; restart apps if needed
- Packaging fails: check electron-builder version and icon paths under build/

## License

ISC. See LICENSE.
