# Todo List for Antique Appraisers Directory Frontend

## Build & Deployment Improvements

- [ ] Update `.gitignore` to properly exclude `dist` directory in normal development workflow
- [ ] Remove any temporary comments about Netlify deployment from `.gitignore`
- [ ] Fix React hydration issues in components with client/server mismatch
- [ ] Update CSP injection script to ensure security headers are properly applied to all HTML files
- [ ] Optimize bundle size by implementing code splitting for large components
- [ ] Implement tree-shaking for unused code to reduce bundle size

## Integration with Main Site

- [ ] Review the integration approach from proof-of-concept for potential implementation
- [ ] Consider direct integration of directory components into main site instead of separate build
- [ ] Create shared data service to centralize data fetching between main site and directory
- [ ] Update routing to use standard React Router patterns for better integration
- [ ] Ensure consistent styling and UI components between directory and main site

## Performance Optimization

- [ ] Implement lazy loading for images to improve initial page load time
- [ ] Add proper caching headers for static assets
- [ ] Optimize CSS delivery by removing unused styles
- [ ] Implement font display swap for better perceived performance
- [ ] Minify HTML output for production builds
- [ ] Add preloading for critical resources

## SEO Improvements

- [ ] Ensure all pages have unique, descriptive meta titles and descriptions
- [ ] Add structured data (JSON-LD) for appropriate directory entities
- [ ] Implement canonical URLs to avoid duplicate content issues
- [ ] Add alt text for all images
- [ ] Ensure proper heading hierarchy (h1, h2, etc.) for better accessibility and SEO
- [ ] Create a comprehensive XML sitemap for all directory pages

## Code Quality & Maintenance

- [ ] Refactor component structure for better maintainability
- [ ] Add comprehensive error handling for API calls and data fetching
- [ ] Implement proper loading states for all async operations
- [ ] Add TypeScript types/interfaces for all components and data
- [ ] Clean up unused imports and dead code
- [ ] Add unit tests for critical components and utilities

## Content & User Experience

- [ ] Enhance fallback image system to ensure no broken images
- [ ] Improve mobile responsiveness across all pages
- [ ] Add better navigation between related appraisers and locations
- [ ] Implement search functionality with filtering options
- [ ] Add breadcrumb navigation for better user experience
- [ ] Improve contact options for individual appraisers

## Documentation

- [ ] Create comprehensive README with setup and development instructions
- [ ] Document component structure and architecture
- [ ] Add inline code documentation for complex logic
- [ ] Create contribution guidelines for team members
- [ ] Document data structure and validation requirements

## Future Enhancements

- [ ] Consider implementing a more unified build approach as outlined in the proof-of-concept
- [ ] Evaluate moving from submodule to direct integration with main site
- [ ] Explore server-side rendering options that avoid hydration issues
- [ ] Consider implementing a proper CMS for directory content management
- [ ] Plan for internationalization/localization support 