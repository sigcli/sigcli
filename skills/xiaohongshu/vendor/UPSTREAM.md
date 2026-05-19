# Vendored from Spider_XHS

- **Source**: https://github.com/cv-cat/Spider_XHS
- **License**: MIT (see ./LICENSE)
- **Commit**: 4dcfa5b0b134b221cf9642e9c525927d7c76c09f
- **Ref**: master
- **Synced at**: 2026-05-19T13:05:11Z

## What's vendored

Minimal subset for PC public API signing & requests:

- `static/xhs_*.js` — JSVMP-derived signing scripts (x-s, x-t, x-s-common, x-rap-param, x-xray-traceid)
- `xhs_utils/*.py` — Python helpers wrapping the JS via PyExecJS
- `apis/xhs_pc_apis.py` — XHS_Apis class

Excluded: creator APIs (post/upload), commercial platform APIs (pugongying/qianfan), full app stack.

## Refresh

```bash
./scripts/sync-vendor.sh           # latest main
./scripts/sync-vendor.sh <ref>     # specific tag/commit
```
