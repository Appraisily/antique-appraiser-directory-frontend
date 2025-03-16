# Standardized Appraiser Data Format

This directory contains standardized JSON data files for art appraisers organized by location. Each location file follows a consistent schema designed to support the Art Appraiser Directory frontend.

## Data Structure

Each location file contains an array of appraisers with the following structure:

```json
{
  "appraisers": [
    {
      "id": "string",               // Unique identifier
      "name": "string",             // Full name or company name
      "slug": "string",             // URL-friendly version of name
      "imageUrl": "string",         // Primary image URL
      "address": {
        "street": "string",         // Street address
        "city": "string",           // City
        "state": "string",          // State (2-letter code)
        "zip": "string",            // ZIP code
        "formatted": "string"       // Full formatted address
      },
      "contact": {
        "phone": "string",          // Phone number
        "email": "string",          // Email address
        "website": "string"         // Website URL
      },
      "business": {
        "yearsInBusiness": "string", // e.g., "15+ years", "Founded in 1984"
        "hours": [                  // Business hours
          {
            "day": "string",        // Day or range of days
            "hours": "string"       // Hours of operation
          }
        ],
        "pricing": "string",        // Pricing information
        "rating": 4.8,              // Rating (1-5)
        "reviewCount": 24           // Number of reviews
      },
      "expertise": {
        "specialties": ["string"],  // Areas of expertise
        "certifications": ["string"], // Professional certifications
        "services": ["string"]      // Services offered
      },
      "content": {
        "about": "string",          // Description/bio
        "notes": "string"           // Additional notes
      },
      "reviews": [                  // Reviews
        {
          "author": "string",       // Reviewer name
          "rating": 5,              // Review rating (1-5)
          "date": "string",         // Review date (YYYY-MM-DD)
          "content": "string"       // Review text
        }
      ],
      "metadata": {
        "lastUpdated": "string",    // Last updated date (YYYY-MM-DD)
        "inService": true           // Whether the appraiser is still in service
      }
    }
  ]
}
```

## Generating Standardized Data

To transform location data into this standardized format, use the `standardize-appraiser-data.js` script:

```bash
# Transform all locations
npm run standardize:data

# Transform a specific location
npm run standardize:one atlanta
```

## Usage in Application

This data format supports:

1. Detailed appraiser profiles
2. Structured search and filtering
3. Rich schema.org markup for SEO
4. Consistent UI rendering

## Updating Data

When making changes to appraiser data:

1. Update the source data in the standardized format
2. Run the appropriate build scripts to update the frontend
3. Ensure all required fields are present in your updates