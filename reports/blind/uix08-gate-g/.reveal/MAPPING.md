# The key — do not open before the answers are on disk

Opening this before every judge has recorded its five answers verbatim, and before the
separability reader has returned, destroys the run and cannot be undone.

- built: 2026-08-15T10:09:50.068Z
- baseline commit: `1ddeef0d84ee722584ca75fd47f5273a8ae2c2db`
- seed: `20260815`
- **ablated arm: `osprey`**
- **our arm: `quillon`**

Rebuild the identical pack:

```
node tools/blind/played-pair/build-arms.mjs \
  --out <dir> --reveal <dir> --commit 1ddeef0d84ee722584ca75fd47f5273a8ae2c2db --seed 20260815 --force
```
