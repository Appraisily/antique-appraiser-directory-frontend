import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Locate, Search } from 'lucide-react';
import { cities } from '../utils/staticData';

export function CitySearch() {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<typeof cities>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query) {
      setSuggestions([]);
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const filtered = cities
      .filter(
        city => 
          city.name.toLowerCase().includes(normalizedQuery) || 
          city.state.toLowerCase().includes(normalizedQuery)
      )
      .sort((a, b) => {
        // Prioritize exact matches and matches at the beginning of the string
        const aNameMatch = a.name.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
        const bNameMatch = b.name.toLowerCase().startsWith(normalizedQuery) ? 0 : 1;
        
        return aNameMatch - bNameMatch || a.name.localeCompare(b.name);
      })
      .slice(0, 5);

    setSuggestions(filtered);
    setIsOpen(filtered.length > 0);
  }, [query]);

  const handleLocationClick = () => {
    setIsLocating(true);
    // Simulate geolocation with a timeout for demonstration
    setTimeout(() => {
      setQuery('New York, NY');
      setIsLocating(false);
      // Typically you would use the browser's geolocation API here
      // navigator.geolocation.getCurrentPosition((position) => {
      //   // Use position.coords.latitude and position.coords.longitude
      //   // to find the nearest city
      // });
    }, 1500);
  };

  const handleSelect = (city: typeof cities[0]) => {
    setQuery(`${city.name}, ${city.state}`);
    setIsOpen(false);
    navigate(`/location/${city.slug}`);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? 
        <span key={index} className="bg-primary/20 text-primary font-semibold">{part}</span> : 
        <span key={index}>{part}</span>
    );
  };

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </div>
        <input
          ref={inputRef}
          type="text"
          className="w-full h-12 pl-10 pr-12 rounded-lg border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          placeholder="Enter city or ZIP code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && setSuggestions.length > 0 && setIsOpen(true)}
        />
        <button
          type="button"
          onClick={handleLocationClick}
          disabled={isLocating}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-primary transition-colors"
        >
          {isLocating ? (
            <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <Locate className="h-5 w-5" />
          )}
        </button>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg overflow-hidden border border-border animate-fadeInUp">
          <ul className="py-1 divide-y divide-gray-100">
            {suggestions.map((city) => (
              <li 
                key={city.slug}
                onClick={() => handleSelect(city)}
                className="px-4 py-3 cursor-pointer hover:bg-primary/5 transition-colors flex items-center gap-2"
              >
                <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                <div>
                  <div className="font-medium">
                    {highlightMatch(city.name, query)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {city.state}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}