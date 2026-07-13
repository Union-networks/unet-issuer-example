# Server runtime assets

`barretenberg-threads.wasm.gz` is the compressed WASM runtime from
`@aztec/bb.js@4.2.0`. The issuer decision function uses this app-owned copy so
Vercel does not need to infer a runtime-relative file from `node_modules`.

Expected SHA-256:

```text
36d005bcb8e8340a87ded024e35b48ed110091f0bc1deca07b7425b42dc0c7d4
```

When updating `@aztec/bb.js`, replace this file from
`node_modules/@aztec/bb.js/dest/node/barretenberg_wasm/`, update the hash, and
rerun the issuer credential golden-vector tests before deploying.
