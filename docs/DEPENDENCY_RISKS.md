# Dependency risk register — Skiplines

Date: 2026-08-11

## axios (high) via `cashfree-pg`

| Item | Detail |
|------|--------|
| Package | `axios` 1.0.0–1.17.0 nested under `cashfree-pg` |
| Advisory cluster | Multiple GHSA highs (prototype pollution gadgets, NO_PROXY bypass, DoS, header injection) |
| Upstream fix | **No fix available** in current `cashfree-pg` tree (`npm audit`: “No fix available”) |
| Exploitability in Skiplines | Server-side only via Cashfree SDK HTTP calls. Not directly exposed to browser input shaping axios config. Risk is supply-chain / confused-deputy if attacker can influence request config through SDK bugs. |
| Mitigation | Keep Cashfree usage server-side; do not pass untrusted objects into SDK config; monitor Cashfree changelog; re-run `npm audit` monthly; prefer official SDK upgrade when released. |
| Action | **Do not force-upgrade** axios inside `node_modules` (breaks vendor integrity). Track as accepted residual risk until vendor ships a fixed SDK. |

## Monitoring

- CI/manual: `npm audit --omit=dev` before Production deploys.
- Subscribe to Cashfree Node SDK release notes.
