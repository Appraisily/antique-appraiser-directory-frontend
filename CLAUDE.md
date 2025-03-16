# Antique Appraiser Directory Frontend Guide

## Build Commands
- Development: `npm run dev`
- Build (standardized): `npm run build` or `npm run build:standardized`
- Lint: `npm run lint`
- Test HTML: `npm run test:html`
- Serve static build: `npm run serve:static`
- Fix issues: `npm run fix:all-pages`

## Code Style Guidelines
- **Imports**: Group imports by type (React, libraries, components, types, styles)
- **TypeScript**: Use strict mode; define interfaces for props and data structures
- **Components**: Functional components with hooks; use React.FC for explicit typing
- **Naming**: PascalCase for components, camelCase for functions/variables
- **Error Handling**: Use try/catch blocks with appropriate fallbacks
- **State Management**: Use useState/useEffect for local state; avoid prop drilling
- **Formatting**: Use consistent indentation (2 spaces) and semicolons
- **Tailwind CSS**: Prefer utility classes over custom CSS
- **File Structure**: Keep related files together in appropriate directories