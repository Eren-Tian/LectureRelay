# Ascend phoenix

`phoenix.svg` is LectureRelay's original green and gold phoenix, drawn specifically for the October 2026 product iteration. It replaces the earlier symmetric pixel emblem. A raised wing, upward neck and three separated tail ribbons suggest flight; the warm rounded tile keeps the mark legible on light and dark Windows surfaces.

Colors: forest `#315e49`, leaf `#60866a`, sage `#8fa889`, gold `#bd994e`, warm tile `#f5f4eb`. Keep green dominant. No third-party artwork, fonts or image-generation references are embedded.

The SVG is the editable master. `scripts/build/prepare-branding.mjs` copies it to the ignored `apps/desktop/public/app-icon.svg`. Inside the app, show it only beside the LectureRelay title in the sidebar header; do not repeat the logo in page banners, empty states, the sidebar footer, loading screen or About card. The versioned Windows inputs are `apps/desktop/src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.ico,icon.png}`. The ICO also supplies installer, uninstaller and executable resources.

Regenerate into a temporary project directory, then copy only the Windows assets above:

```powershell
node scripts/dev/run-native.mjs icon ../../assets/branding/phoenix/phoenix.svg --output ../../target/branding-ascend
```

Review the 32 px icon and larger PNG before packaging. The other generated platform formats are not used by this Windows application.
