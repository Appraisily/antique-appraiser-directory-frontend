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

type SearchFeedback =
  | { kind: 'no-match'; query: string }
  | { kind: 'geolocation-denied' }
  | { kind: 'geolocation-unavailable' };

const SEARCH_REDIRECTS: Record<string, string> = {
  '07866': 'new-york',
  '12019': 'new-york',
  '17011': 'philadelphia',
  '24153': 'richmond',
  '29464': 'charleston',
  '29926': 'savannah',
  '41056': 'cincinnati',
  '41075': 'cincinnati',
  '46184': 'indianapolis',
  '49203': 'detroit',
  '54452': 'milwaukee',
  '55434': 'minneapolis',
  '56001': 'minneapolis',
  '76539': 'austin',
  '83701': 'boise',
  '90210': 'los-angeles',
  '92646': 'los-angeles',
  'beverly hills': 'los-angeles',
  'longview tx': 'dallas',
  'longview, tx': 'dallas',
  'merrill wi': 'milwaukee',
  'merrill, wi': 'milwaukee',
  'moncton nb': 'moncton',
  'moncton, nb': 'moncton',
  'watertown ny': 'new-york',
  'watertown, ny': 'new-york',
};

const normalizeSearchQuery = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ');

export const CitySearch = React.forwardRef<CitySearchHandle>((_, ref) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<typeof cities>([]);
  const [feedback, setFeedback] = useState<SearchFeedback | null>(null);
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
    setFeedback(null);
    setIsLocating(true);
    trackEvent('search_geolocate_request', {
      source: 'hero_directory'
    });

    const complete = (
      city: (typeof cities)[number] | null,
      meta: Record<string, unknown> = {},
      locationFeedback: SearchFeedback | null = null
    ) => {
      if (!city) {
        setIsLocating(false);
        setFeedback(locationFeedback);
        inputRef.current?.focus();
        return;
      }

      setQuery(`${city.name}, ${city.state}`);
      setIsLocating(false);
      setFeedback(null);
      trackEvent('search_geolocate_complete', {
        source: 'hero_directory',
        resolved_city: city.slug,
        ...meta
      });
      navigate(`/location/${city.slug}`);
    };

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      complete(null, { reason: 'geolocation_unavailable' }, { kind: 'geolocation-unavailable' });
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
        complete(
          null,
          { reason: 'geolocation_error' },
          { kind: error?.code === 1 ? 'geolocation-denied' : 'geolocation-unavailable' }
        );
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
    setFeedback(null);
    trackEvent('location_search_select', {
      source: 'hero_directory',
      city_slug: city.slug,
      city_name: city.name,
      state: city.state
    });
    navigate(`/location/${city.slug}`);
  }, [navigate]);

  const resolveRedirect = useCallback((rawQuery: string) => {
    const normalizedQuery = normalizeSearchQuery(rawQuery);
    const zip = normalizedQuery.match(/\b\d{5}\b/)?.[0];
    const redirectSlug = SEARCH_REDIRECTS[normalizedQuery] || (zip ? SEARCH_REDIRECTS[zip] : undefined);
    if (!redirectSlug) return null;
    return cities.find((city) => city.slug === redirectSlug) || null;
  }, []);

  const submitSearch = useCallback(() => {
    if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
      return true;
    }

    const rawQuery = query.trim();
    if (rawQuery.length > 0) {
      const redirectMatch = resolveRedirect(rawQuery);
      if (redirectMatch) {
        trackEvent('location_search_alias_redirect', {
          source: 'hero_directory',
          query: rawQuery,
          city_slug: redirectMatch.slug,
          city_name: redirectMatch.name,
          state: redirectMatch.state
        });
        handleSelect(redirectMatch);
        return true;
      }

      trackEvent('search_no_results', {
        source: 'hero_directory',
        query: rawQuery
      });
      setFeedback({ kind: 'no-match', query: rawQuery });
    }

    return false;
  }, [handleSelect, query, resolveRedirect, suggestions]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    submitSearch();
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
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
          placeholder="Enter city or state"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="city-search-listbox"
          aria-activedescendant={isOpen && suggestions.length > 0 ? `city-option-${suggestions[0].slug}` : undefined}
          aria-describedby={feedback ? 'city-search-status' : undefined}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setFeedback(null);
          }}
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
          aria-describedby={feedback ? 'city-search-status' : undefined}
          data-clarity-action="directory_search_geolocate"
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

      {feedback && (
        <div
          id="city-search-status"
          role="status"
          aria-live="polite"
          data-directory-search-feedback="1"
          data-directory-search-status={feedback.kind}
          className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left text-sm text-amber-950"
        >
          {feedback.kind === 'no-match' && (
            <>
              No city page found for “
              <span
                className="session-replay-mask"
                data-ph-mask-text="true"
                data-clarity-mask="true"
              >
                {feedback.query}
              </span>
              ”. Try another city, or{' '}
              <a
                href="#city-directory"
                className="font-semibold underline underline-offset-2 hover:text-primary"
                data-clarity-action="directory_search_browse_all"
              >
                browse all locations
              </a>
              .
            </>
          )}
          {feedback.kind === 'geolocation-denied' && (
            <>
              Location access was denied. Enter a city, or{' '}
              <a
                href="#city-directory"
                className="font-semibold underline underline-offset-2 hover:text-primary"
                data-clarity-action="directory_search_browse_all"
              >
                browse all locations
              </a>{' '}
              instead.
            </>
          )}
          {feedback.kind === 'geolocation-unavailable' && (
            <>
              We couldn’t determine your location. Enter a city, or{' '}
              <a
                href="#city-directory"
                className="font-semibold underline underline-offset-2 hover:text-primary"
                data-clarity-action="directory_search_browse_all"
              >
                browse all locations
              </a>{' '}
              instead.
            </>
          )}
        </div>
      )}
    </div>
  );
});

CitySearch.displayName = 'CitySearch';
