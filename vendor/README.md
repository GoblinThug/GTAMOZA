# Vendor dependencies

## MOZA Racing SDK

Expected path:

`vendor/moza-sdk/1.0.1.8/MSVC2022-64/`

Contents we use:

- `bin/MOZA_SDK.dll` — runtime
- `lib/MOZA_SDK.lib` — link (native addon)
- `include/` — C++ headers (`mozaAPI.h`, `effects.h`, …)
- `docsEng/` — API docs
- `example/` — official samples
- `Licenses/` — third-party licenses from the SDK package

This folder is gitignored (MOZA license — do not publish the SDK).

If missing, unpack `MOZA_SDK.zip` and copy `MOZA_SDK/1.0.1.8/MSVC2022-64` (+ `Licenses`) here.
