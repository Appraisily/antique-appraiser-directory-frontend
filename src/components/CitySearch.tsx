import React, { useState, useRef, useEffect, useImperativeHandle, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Locate } from 'lucide-react';
import { cities } from '../utils/standardizedData';
import { trackEvent } from '../utils/analytics';

export type CitySearchHandle = {
  submitSearch: () => boolean;
  getQuery: () => string;
  focusInput: () => void;
};

export const CitySearch = React.forwardRef<CitySearchHandle>((_, ref) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<typeof cities>([]);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const getNearestCitySlug = (latitude: number, longitude: number): (typeof cities)[number] | null => {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;

    let best: (typeof cities)[number] | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const city of cities) {
      const dLat = rad(city.latitude - latitude);
      const dLon = rad(city.longitude - longitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rad(latitude)) * Math.cos(rad(city.latitude)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = earthRadiusKm * c;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = city;
      }
    }

    return best;
  };

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
    if (isLocating) return;
    setIsLocating(true);
    trackEvent('search_geolocate_request', {
      source: 'hero_directory'
    });

    const fallbackCity = cities.find((city) => city.slug === 'new-york') || cities[0];
    const complete = (city: (typeof cities)[number] | null, meta: Record<string, unknown> = {}) => {
      const resolved = city || fallbackCity;
      setQuery(`${resolved.name}, ${resolved.state}`);
      setIsLocating(false);
      trackEvent('search_geolocate_complete', {
        source: 'hero_directory',
        resolved_city: resolved.slug,
        ...meta
      });
      navigate(`/location/${resolved.slug}`);
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      complete(fallbackCity, { reason: 'geolocation_unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = getNearestCitySlug(position.coords.latitude, position.coords.longitude);
        complete(nearest, { reason: 'geolocation_ok' });
      },
      (error) => {
        trackEvent('search_geolocate_error', {
          source: 'hero_directory',
          code: error?.code,
          message: error?.message
        });
        complete(fallbackCity, { reason: 'geolocation_error' });
      },
      {
        enableHighAccuracy: false,
        timeout: 8000,
        maximumAge: 60_000
      }
    );
  };

  const handleSelect = useCallback((city: typeof cities[0]) => {
    setQuery(`${city.name}, ${city.state}`);
    setIsOpen(false);
    trackEvent('location_search_select', {
      source: 'hero_directory',
      city_slug: city.slug,
      city_name: city.name,
      state: city.state
    });
    navigate(`/location/${city.slug}`);
  }, [navigate]);

  const submitSearch = useCallback(() => {
    if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
      return true;
    }

    if (query.trim().length > 0) {
      trackEvent('search_no_results', {
        source: 'hero_directory',
        query: query.trim()
      });
    }

    return false;
  }, [handleSelect, query, suggestions]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    const didNavigate = submitSearch();
    if (didNavigate) {
      event.preventDefault();
    }
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

  useImperativeHandle(ref, () => ({
    submitSearch,
    getQuery: () => query,
    focusInput: () => {
      inputRef.current?.focus();
    }
  }), [submitSearch, query]);

  return (
    <div ref={wrapperRef} className="relative flex-1">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <MapPin className="h-5 w-5 text-muted-foreground" />
        </div>
        <input
          ref={inputRef}
          type="text"
          name="city"
          className="w-full h-12 pl-10 pr-12 rounded-lg border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 shadow-sm"
          placeholder="Enter city or ZIP code"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="city-search-listbox"
          aria-activedescendant={isOpen && suggestions.length > 0 ? `city-option-${suggestions[0].slug}` : undefined}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (query && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          onClick={handleLocationClick}
          disabled={isLocating}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-primary transition-colors"
          aria-label="Use my location"
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
          <ul className="py-1 divide-y divide-gray-100" role="listbox" id="city-search-listbox">
            {suggestions.map((city) => (
              <li
                key={city.slug}
                id={`city-option-${city.slug}`}
                role="option"
                aria-selected={false}
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
});

CitySearch.displayName = 'CitySearch';
