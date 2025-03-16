import React, { useState } from 'react';
import { MapPin, Star, Search, Palette, Award, Badge, Clock, Users, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CitySearch } from './components/CitySearch';
import { SEO } from './components/SEO';
import { cities } from './data/cities.json';

function App() {
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  // Group cities by region for better organization
  const regions = {
    'Northeast': cities.filter(city => 
      ['New York', 'Massachusetts', 'Rhode Island', 'Connecticut', 'Pennsylvania', 'New Jersey'].includes(city.state)
    ),
    'Southeast': cities.filter(city => 
      ['Florida', 'Georgia', 'North Carolina', 'South Carolina', 'Tennessee', 'Virginia'].includes(city.state)
    ),
    'Midwest': cities.filter(city => 
      ['Illinois', 'Ohio', 'Michigan', 'Minnesota', 'Missouri', 'Indiana', 'Wisconsin'].includes(city.state)
    ),
    'Southwest': cities.filter(city => 
      ['Texas', 'Arizona', 'New Mexico', 'Oklahoma'].includes(city.state)
    ),
    'West Coast': cities.filter(city => 
      ['California', 'Washington', 'Oregon', 'Nevada'].includes(city.state)
    ),
    'Mountain': cities.filter(city => 
      ['Colorado', 'Utah', 'Montana', 'Idaho', 'Wyoming'].includes(city.state)
    )
  };

  // Generate the home page schema
  const generateHomePageSchema = () => {
    return {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": "https://appraisily.com/#website",
      "url": "https://appraisily.com/",
      "name": "Appraisily - Find Antique Appraisers Near You",
      "description": "Connect with certified antique appraisers, get expert valuations, and make informed decisions about your antique collection.",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://appraisily.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    };
  };

  // Generate Professional Service schema for art appraisal services
  const generateServiceSchema = () => {
    return {
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      "@id": "https://appraisily.com/#professional-service",
      "name": "Appraisily Antique Appraisal Directory",
      "description": "Find certified antique appraisers near you for expert valuations, authentication services, and professional advice for your antique collection.",
      "url": "https://appraisily.com/",
      "serviceType": "Art Appraisal",
      "audience": {
        "@type": "Audience",
        "audienceType": "Art Collectors, Insurance Companies, Estates, Donors"
      },
      "serviceArea": {
        "@type": "Country",
        "name": "United States"
      },
      "provider": {
        "@type": "Organization",
        "name": "Appraisily",
        "url": "https://appraisily.com/"
      }
    };
  };

  return (
    <>
      <SEO
        title="Find Antique Appraisers Near Me | Expert Antique Valuation Services | Appraisily"
        description="Connect with certified antique appraisers near you. Get expert antique valuations, authentication services, and professional advice for your antique collection. Find local antique appraisers today!"
        keywords={[
          'antique appraiser near me',
          'find antique appraisers',
          'local antique appraisers',
          'antique valuation services',
          'antique authentication services',
          'certified antique appraisers',
          'professional antique valuation',
          'fine antique appraisal',
          'antique appraisal for insurance',
          'antique appraisal for estate',
          'antique appraisal for donation'
        ]}
        schema={[
          generateHomePageSchema(),
          generateServiceSchema()
        ]}
        canonicalUrl="https://appraisily.com/"
      />
      <div className="flex-1">
        {/* Hero Section with Gradient Background */}
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-blue-50 py-20 md:py-28">
          <div className="container mx-auto px-6 relative">
            {/* Decorative Elements */}
            <div className="absolute top-1/4 left-10 w-12 h-12 bg-primary/20 rounded-full blur-xl"></div>
            <div className="absolute bottom-1/4 right-10 w-16 h-16 bg-blue-400/20 rounded-full blur-xl"></div>
            <div className="absolute top-3/4 left-1/3 w-8 h-8 bg-primary/30 rounded-full blur-lg"></div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6 text-center leading-tight">
              Find <span className="text-primary">Antique Appraisers</span> Near You
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto text-center">
              Connect with certified antique appraisers, get expert valuations, and make informed decisions about your antique collection.
            </p>
            
            <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-4 max-w-xl mx-auto relative z-10 bg-white p-2 rounded-lg shadow-lg">
              <CitySearch />
              <button
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-primary-foreground hover:bg-primary/90 h-12 px-8 py-2 bg-primary md:w-auto w-full shadow-md hover:shadow-lg transform hover:-translate-y-1 duration-300"
                type="submit"
              >
                <Search className="w-4 h-4" />
                Find Appraisers
              </button>
            </form>
          </div>
        </div>

        {/* Features Section */}
        <div className="bg-white py-16">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold text-center mb-12">Why Choose Appraisily?</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="flex flex-col items-center text-center p-6 rounded-lg hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Palette className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Expert Appraisers</h3>
                <p className="text-muted-foreground">Access to certified art professionals with years of experience.</p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6 rounded-lg hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Award className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Accurate Valuations</h3>
                <p className="text-muted-foreground">Precise art valuations based on current market trends.</p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6 rounded-lg hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Quick Turnaround</h3>
                <p className="text-muted-foreground">Fast appraisal services to meet your timeline needs.</p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6 rounded-lg hover:shadow-lg transition-all duration-300">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Badge className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Verified Reviews</h3>
                <p className="text-muted-foreground">Read authentic feedback from clients who've used our services.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Cities Directory Section */}
        <div className="bg-gray-50 py-16">
          <div className="container mx-auto px-6">
            <h2 className="text-3xl font-bold mb-4 text-center">Antique Appraiser Directory by City</h2>
            <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
              Find certified antique appraisers in your city. Our directory covers major metropolitan areas across the United States.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {Object.entries(regions).map(([region, regionCities]) => (
                <div key={region} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all duration-300">
                  <h3 className="text-xl font-semibold mb-4 text-blue-600 border-b pb-2">{region}</h3>
                  <ul className="grid grid-cols-1 gap-2">
                    {regionCities.map(city => (
                      <li key={city.slug}>
                        <a 
                          href={`/location/${city.slug}`}
                          className="flex items-center text-gray-700 hover:text-blue-600 py-1 transition-colors"
                        >
                          <MapPin className="w-4 h-4 mr-2 text-blue-500" />
                          <span>{city.name}, {city.state}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            
            <div className="mt-10 text-center">
              <p className="text-gray-600 mb-4">Don't see your city? We may still have art appraisers available in your area.</p>
              <a
                href="https://appraisily.com/start"
                className="inline-flex items-center justify-center text-white bg-blue-600 hover:bg-blue-700 py-3 px-6 rounded-lg shadow-md font-medium transition-all duration-300"
              >
                Request an Appraisal <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
        
        {/* Featured Appraisers Section */}
        <main className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-10 text-center">Featured Antique Appraisers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Example Appraiser Card 1 */}
            <a href="https://antique-appraiser-directory.appraisily.com/appraiser/metropolitan-art-appraisers-chicago" className="group">
              <div className="rounded-xl border border-gray-200 bg-white text-foreground shadow-sm overflow-hidden group-hover:shadow-xl transition-all duration-300 cursor-pointer transform group-hover:-translate-y-2">
                <div className="relative">
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '65%' }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <img
                        src="https://images.unsplash.com/photo-1594732832278-abd644401426?auto=format&fit=crop&q=80"
                        alt="Metropolitan Art Appraisers"
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded-md shadow-md text-sm font-medium text-primary flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" /> 4.9
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Metropolitan Art Appraisers</h3>
                  <div className="flex items-center text-muted-foreground mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> New York, NY
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">Expert appraisers specializing in modern and contemporary artwork with over 20 years of experience.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Modern Art</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Contemporary</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Sculptures</span>
                  </div>
                </div>
              </div>
            </a>
            
            {/* Example Appraiser Card 2 */}
            <a href="https://antique-appraiser-directory.appraisily.com/appraiser/heritage-fine-art-appraisers" className="group">
              <div className="rounded-xl border border-gray-200 bg-white text-foreground shadow-sm overflow-hidden group-hover:shadow-xl transition-all duration-300 cursor-pointer transform group-hover:-translate-y-2">
                <div className="relative">
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '65%' }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <img
                        src="https://images.unsplash.com/photo-1580543736471-c548332fe5b8?auto=format&fit=crop&q=80"
                        alt="Heritage Fine Art Appraisers"
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded-md shadow-md text-sm font-medium text-primary flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" /> 4.8
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Heritage Fine Art Appraisers</h3>
                  <div className="flex items-center text-muted-foreground mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> Los Angeles, CA
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">Specialized in European classical art, antiques, and collectibles with extensive auction experience.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Classical Art</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Antiques</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Valuation</span>
                  </div>
                </div>
              </div>
            </a>
            
            {/* Example Appraiser Card 3 */}
            <a href="https://antique-appraiser-directory.appraisily.com/appraiser/blue-chip-art-valuation" className="group">
              <div className="rounded-xl border border-gray-200 bg-white text-foreground shadow-sm overflow-hidden group-hover:shadow-xl transition-all duration-300 cursor-pointer transform group-hover:-translate-y-2">
                <div className="relative">
                  <div style={{ position: 'relative', width: '100%', paddingBottom: '65%' }}>
                    <div style={{ position: 'absolute', inset: 0 }}>
                      <img
                        src="https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&q=80"
                        alt="Blue Chip Art Valuation"
                        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                  </div>
                  <div className="absolute top-3 right-3 bg-white px-2 py-1 rounded-md shadow-md text-sm font-medium text-primary flex items-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" /> 4.7
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">Blue Chip Art Valuation</h3>
                  <div className="flex items-center text-muted-foreground mb-3">
                    <MapPin className="w-4 h-4 mr-1" /> Chicago, IL
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">Experts in contemporary and investment-grade artwork with international market expertise.</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Contemporary</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Investment Art</span>
                    <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded-full">Digital Art</span>
                  </div>
                </div>
              </div>
            </a>
          </div>
          
          <div className="mt-12 text-center">
            <a 
              href="/location/new-york" 
              className="inline-flex items-center justify-center rounded-lg border border-primary bg-white px-6 py-3 text-sm font-medium text-primary shadow-sm transition-all hover:bg-primary hover:text-white mr-4"
            >
              Browse All Appraisers
            </a>
          </div>
        </main>
      </div>
    </>
  );
}

export default App;