# Publishing Guide for QueryCanvas

## Prerequisites

1. **VS Code Marketplace Publisher Account**
   - Visit: https://marketplace.visualstudio.com/manage
   - Sign in with Microsoft/GitHub account
   - Create a publisher (e.g., "okuyamashin")

2. **Personal Access Token (PAT)**
   - Visit: https://dev.azure.com/
   - User Settings → Personal Access Tokens
   - Create new token with:
     - Organization: All accessible organizations
     - Scopes: **Marketplace (Manage)**
   - Save the token securely!

## Installation

Install the `vsce` command-line tool:

```bash
npm install -g @vsce/vsce
```

## Steps to Publish

### 1. Verify Package

```bash
cd /Users/okuyama/Documents/projects/vsex001
vsce package
```

This creates `querycanvas-0.1.0.vsix` file.

### 2. Test Locally (Optional)

```bash
code --install-extension querycanvas-0.1.0.vsix
```

Test the extension in VS Code, then uninstall:

```bash
code --uninstall-extension okuyamashin.querycanvas
```

### 3. Login to Marketplace

```bash
vsce login okuyamashin
```

Enter your Personal Access Token when prompted.

### 4. Publish!

```bash
vsce publish
```

Or with a specific version bump:

```bash
vsce publish patch  # 0.1.0 → 0.1.1
vsce publish minor  # 0.1.0 → 0.2.0
vsce publish major  # 0.1.0 → 1.0.0
```

## After Publishing

1. **View on Marketplace**
   - https://marketplace.visualstudio.com/items?itemName=okuyamashin.querycanvas

2. **Install from VS Code**
   ```
   Ctrl+Shift+X → Search "QueryCanvas"
   ```

3. **Update Extension**
   - Make changes
   - Update version in package.json
   - Commit changes
   - Run `vsce publish`

## Important Notes

### Publisher Name
- Must match the `publisher` field in package.json
- Cannot be changed after creation
- Choose carefully!

### Version Management
- Follows Semantic Versioning (semver)
- Major.Minor.Patch (e.g., 1.2.3)
- Can't re-publish same version

### Files Included
- Controlled by `.vscodeignore`
- Source code (`src/`) is excluded
- Only compiled code (`out/`) is included

## Troubleshooting

### Error: "Publisher not found"
```bash
# Update package.json with correct publisher name
# Then login again
vsce login your-publisher-name
```

### Error: "Extension name already exists"
```bash
# Change the "name" field in package.json
# Name must be unique across the marketplace
```

### Error: "Invalid version"
```bash
# Update version in package.json
# Must be higher than current published version
npm version patch  # Auto-increments version
```

## Resources

- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest)
- [VS Code Marketplace](https://marketplace.visualstudio.com/)

