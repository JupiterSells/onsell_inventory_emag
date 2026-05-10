# Staging, Release & Deployment Rules

## Overview

OnSell KStock uses a two-tag Docker image strategy:

- **`:latest`** — Built automatically on every push to `main`. This is the staging/development build.
- **`:release`** — Promoted manually from `:latest` when the build is verified and ready for production tenants.

Tenants pull **`:release`** images only. They do NOT auto-update; updates are deployed selectively per tenant.

## Service Details

| Field           | Value                                      |
| --------------- | ------------------------------------------ |
| Service name    | `emag`                                     |
| Docker image    | `registry.digitalocean.com/kstock/emag`    |
| Compose service | `emag_api`                                 |

## Image Lifecycle

```
Push to main  →  CI builds :latest + :sha  →  Verify on demo tenant  →  Promote to :release  →  Deploy to production tenants
```

## Rules

1. **Never push directly to `:release`** — always promote from `:latest` via the release workflow or `npm run promote` in infra boot.
2. **Watchtower auto-polling is disabled** — tenants only update when explicitly deployed via `npm run deploy` or the infra dashboard.
3. **Test on demo.onsell.ro first** — the demo tenant runs `:release` with mocked integrations. Verify all changes there before deploying to production tenants.
4. **Selective deployment** — use `npm run deploy -- --tenant <name>` to update specific tenants. Never deploy to all tenants without verification.
5. **Rollback** — use `npm run rollback -- --service emag --digest <sha256:...>` to revert a specific service on specific tenants.

## Promoting a Release

### Option A: GitHub Release (recommended)
1. Create a new GitHub Release in this repo
2. The "Promote to Release" workflow runs automatically
3. Current `:latest` is re-tagged as `:release`

### Option B: Manual workflow dispatch
1. Go to Actions → "Promote to Release" → Run workflow
2. Optionally enter a version tag (e.g. `1.2.3`)

### Option C: Infra boot CLI
```bash
cd onsell_kstock_infra_boot
npm run promote -- --image emag
```

## Deploying to Tenants

After promoting, deploy to tenants:

```bash
# Deploy to a specific tenant
npm run deploy -- --tenant krivas

# Deploy to all tenants
npm run deploy

# Deploy only this service
npm run deploy -- --service emag_api
```

## Demo Tenant

The `demo` tenant (demo.onsell.ro) runs with `DEMO_MODE=true`:
- All integration services return mock/fixture data
- No external API calls are made (Trendyol, eMAG, SAGA, FanCourier, Oblio)
- The UI is identical to production
- Company: COMPANIE DEMO SRL

### DEMO_MODE in eMAG Service

When `DEMO_MODE=true`, the eMAG service bypasses all real eMAG Marketplace API interactions:

- **No calls to the eMAG API** — Product listing, order import, stock updates, invoice uploads, and AWB generation are all bypassed. No HTTP requests are made to the eMAG Marketplace API.
- **Fixture data is returned** — All endpoints return deterministic mock responses matching the eMAG API contract, allowing the demo tenant to exercise the full product and order lifecycle.
- **Scheduled jobs are disabled** — Periodic tasks (order sync, offer sync, RMA polling) do not run in demo mode.
