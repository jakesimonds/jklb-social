import { useState, useCallback, useRef, useEffect } from 'react';

export interface TypeaheadSuggestion {
  did: string;
  handle: string;
  displayName?: string;
  avatar?: string;
}

const PUBLIC_API = 'https://public.api.bsky.app';

async function searchHandles(query: string): Promise<TypeaheadSuggestion[]> {
  const url = `${PUBLIC_API}/xrpc/app.bsky.actor.searchActorsTypeahead?q=${encodeURIComponent(query)}&limit=6`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json() as { actors: TypeaheadSuggestion[] };
  return data.actors ?? [];
}

interface UseHandleTypeaheadReturn {
  suggestions: TypeaheadSuggestion[];
  showSuggestions: boolean;
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  handleInputChange: (value: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => TypeaheadSuggestion | null;
  selectSuggestion: (suggestion: TypeaheadSuggestion) => void;
  clearSuggestions: () => void;
  onFocus: () => void;
}

/**
 * Reusable handle typeahead hook.
 * Debounced search against the public Bluesky API (no auth required).
 * 2+ chars triggers search, 300ms debounce, arrow key nav, Enter/click selects.
 */
export function useHandleTypeahead(inputValue: string): UseHandleTypeaheadReturn {
  const [suggestions, setSuggestions] = useState<TypeaheadSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search as input changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const query = inputValue.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const results = await searchHandles(query);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
      setSelectedIndex(-1);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue]);

  const handleInputChange = useCallback((_value: string) => {
    // The parent controls the input value — this hook just reacts to it via the effect above.
    // But we do want to re-show suggestions if they exist and the user is typing again.
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  }, [suggestions.length]);

  const selectSuggestion = useCallback((suggestion: TypeaheadSuggestion) => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
    // Parent handles setting the input value via the returned suggestion
    void suggestion; // consumed by caller
  }, []);

  const clearSuggestions = useCallback(() => {
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedIndex(-1);
  }, []);

  const onFocus = useCallback(() => {
    if (suggestions.length > 0) setShowSuggestions(true);
  }, [suggestions.length]);

  /**
   * Handle keyboard navigation in the dropdown.
   * Returns the selected suggestion if Enter is pressed on a highlighted item, null otherwise.
   * The caller should check the return value — if non-null, set the input value and optionally submit.
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent): TypeaheadSuggestion | null => {
    if (!showSuggestions || suggestions.length === 0) return null;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
      return null;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
      return null;
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const selected = suggestions[selectedIndex];
      setShowSuggestions(false);
      setSuggestions([]);
      setSelectedIndex(-1);
      return selected;
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedIndex(-1);
      return null;
    }

    return null;
  }, [showSuggestions, suggestions, selectedIndex]);

  return {
    suggestions,
    showSuggestions,
    selectedIndex,
    setSelectedIndex,
    handleInputChange,
    handleKeyDown,
    selectSuggestion,
    clearSuggestions,
    onFocus,
  };
}
