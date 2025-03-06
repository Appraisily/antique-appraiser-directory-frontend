# Art Appraiser Directory Frontend Guide

## Build Commands
- `npm run dev` - Start development server
- `npm run build` - Standard build with TypeScript check
- `npm run build:simple` - Simplified build
- `npm run build:production` - Production build with page fixes and image inventory
- `npm run build:netlify-ready` - Build and prepare for Netlify deployment
- `npm run lint` - Run ESLint checks
- `npm run test:html` - Test HTML output
- `npm run test:cleveland` - Test Cleveland page specifically
- `npm run debug:build` - Build with image validation and serve
- `npm run site-check` - Run comprehensive site check
- `npm run serve:static` - Serve built static files locally

## Code Style Guidelines
- **TypeScript**: Strict mode with no unused locals/parameters
- **Components**: React functional components with explicit return types
- **Styling**: Tailwind CSS with utility-first approach
- **Naming**: PascalCase for components/types, camelCase for variables/functions
- **Imports**: Group React imports first, then external libs, then local
- **Error Handling**: Use FallbackImage component for images, fallback UI for errors
- **Images**: Always include alt tags and handle loading failures
- **Format**: No trailing whitespace, consistent indentation (2 spaces)

## Image Management
- `npm run validate-images` - Validate all images
- `npm run check-images` - Check live images
- `npm run generate-missing-images` - Generate missing images
- `npm run fix-images` - Fix missing images
- `npm run fix-placeholders` - Fix placeholder images

## Project Structure
- `/src` - React TypeScript source code
- `/scripts` - Build and utility scripts
- `/data` - JSON data files for appraisers and locations
- `/dist` - Generated static output files