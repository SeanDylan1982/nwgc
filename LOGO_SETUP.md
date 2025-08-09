# Logo Setup Instructions

## Required Logo Files

The following logo files need to be created and placed in the `client/public/` directory:

### 1. Main Logo (`logo-neibrly.png`)
- **Size**: 192x192 pixels (or similar square dimensions)
- **Format**: PNG with transparency
- **Description**: Blue rounded square background with yellow house icon featuring a black door/window
- **Usage**: Main logo for headers, navigation, and general use

### 2. Small Logo (`logo-neibrly-small.png`)
- **Size**: 48x48 pixels
- **Format**: PNG with transparency
- **Description**: Smaller version of the main logo
- **Usage**: Sidebar collapsed state, small UI elements

### 3. Large Logo (`logo-neibrly-large.png`)
- **Size**: 512x512 pixels
- **Format**: PNG with transparency
- **Description**: High-resolution version of the main logo
- **Usage**: PWA manifest, high-DPI displays, splash screens

### 4. Favicon (`favicon.ico`)
- **Size**: 32x32, 16x16 (multi-size ICO file)
- **Format**: ICO
- **Description**: Browser tab icon version of the logo
- **Usage**: Browser tab, bookmarks

## Logo Design Specifications

Based on the provided image, the logo should feature:
- **Background**: Blue rounded square (#4A90E2)
- **Icon**: Yellow house shape (#F5C842)
- **Detail**: Black door/window (#000000)
- **Style**: Modern, clean, friendly neighborhood aesthetic

## Brand Colors

The following colors have been extracted and set in the brand constants:
- **Primary Blue**: #4A90E2
- **Secondary Yellow**: #F5C842
- **Accent Black**: #000000

## Implementation Status

✅ Logo component created (`client/src/components/Common/Logo/Logo.js`)
✅ Brand constants defined (`client/src/constants/branding.js`)
✅ TopBar updated with new logo
✅ Sidebar updated with new logo
✅ App name changed to "neibrly" throughout the application
✅ Package.json files updated
✅ HTML meta tags updated
✅ Manifest.json updated
✅ Theme colors updated to match brand

## Next Steps

1. **Create the actual logo image files** based on the provided design
2. **Replace the placeholder files** in `client/public/`
3. **Test the logo display** across different screen sizes
4. **Verify favicon** appears correctly in browser tabs

## Testing Checklist

After adding the logo files, verify:
- [ ] Logo displays correctly in the top navigation
- [ ] Logo shows in sidebar (both expanded and collapsed states)
- [ ] Favicon appears in browser tab
- [ ] Logo scales properly on mobile devices
- [ ] Logo has proper fallback text if image fails to load
- [ ] PWA manifest uses correct logo for app installation

## File Locations

```
client/public/
├── logo-neibrly.png          # Main logo (192x192)
├── logo-neibrly-small.png    # Small logo (48x48)
├── logo-neibrly-large.png    # Large logo (512x512)
└── favicon.ico               # Browser favicon
```