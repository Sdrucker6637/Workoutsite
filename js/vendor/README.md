# Vendored libraries

| File | Library | Version | License | Why |
|---|---|---|---|---|
| `zxing.min.js` | [ZXing for JS](https://github.com/zxing-js/library) (`@zxing/library`, UMD build) | 0.23.0 | Apache-2.0 (`ZXING-LICENSE.txt`) | Barcode decoding in browsers without `BarcodeDetector` (iOS Safari, Firefox). Loaded only when the scanner opens. |

Checked when vendored: no network requests, no `eval` or `new Function`.
