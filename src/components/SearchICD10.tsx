import React, { useState, useEffect, useRef } from 'react';
import { debounce } from 'lodash';

interface SearchResult {
  code?: string;
  description?: string;
  lookupCode?: string;
  ICDCode?: string;
  CodeDescription?: string;
  KeywordforthisCode?: string;
  Synonym?: string;
  GenderSpecificity?: string;
  AgeSpecificity?: string;
  "Excludes1Code(s)"?: string;
  "Excludes2Code(s)"?: string;
  "IncludesCode(s)"?: string;
  CodeAlso?: string;
  CodeFirst?: string;
  UseAdditionalCode?: string;
  Laterality?: string;
  Specificity?: string;
  KeywordDescription?: string;
  "7thCharacter"?: string;
  isBestMatch?: boolean;
  isBillable?: boolean;
  includes?: string | string[];
  excludes?: string | string[];
  notes?: string | string[];
  title?: string;
  terms?: SearchResult[];
}

interface FormattedResult {
  code: string;
  description: string;
  isBestMatch?: boolean;
  lookupCode?: string;
  keyword?: string;
  synonym?: string;
  specificity?: string;
  seventhCharacter?: string;
}

const SearchICD10: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FormattedResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<SearchResult | null>(null);
  const [activeTerm, setActiveTerm] = useState<SearchResult | null>(null);
  const [codeDetails, setCodeDetails] = useState<SearchResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [resultCount, setResultCount] = useState<number>(0);
  const [searchMode, setSearchMode] = useState<'index' | 'codes'>('index');
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{code: string, description: string}>>([]);
  const [previousIndexState, setPreviousIndexState] = useState<any>(null);
  
  const resultsRef = useRef<HTMLDivElement>(null);

  // Format search results for display
  const formatResults = (data: SearchResult[]): FormattedResult[] => {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map(item => ({
      code: item.ICDCode || item.lookupCode || item.code || '',
      description: item.CodeDescription || item.description || `Code ${item.ICDCode || item.lookupCode || item.code}`,
      isBestMatch: item.Specificity === 'highly specific' || false,
      lookupCode: item.lookupCode,
      keyword: item.KeywordforthisCode,
      synonym: item.Synonym,
      specificity: item.Specificity,
      seventhCharacter: item["7thCharacter"]
    }));
  };

  // Debounced search function - FIXED VERSION
  const debouncedSearch = useRef(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setShowResults(false);
        setResultCount(0);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      try {
        const endpoint = `https://icd-search.onrender.com/api/v1/search/${encodeURIComponent(searchQuery)}`;
        console.log('Searching with endpoint:', endpoint);
        
        // ACTUAL API CALL - This was missing!
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', data);
        
        const formattedResults = formatResults(data);
        console.log('Formatted Results:', formattedResults);
        
        // Remove duplicates based on code
        const uniqueResults = formattedResults.filter((item, index, self) =>
          item.code && index === self.findIndex((t) => t.code === item.code)
        );
        
        setResults(uniqueResults);
        setResultCount(uniqueResults.length);
        setShowResults(uniqueResults.length > 0);
        
        if (uniqueResults.length === 0) {
          setResults([{
            code: '',
            description: 'No matching codes found',
            isBestMatch: false
          }]);
          setShowResults(true);
        }
      } catch (err) {
        console.error('Error searching ICD-10 codes:', err);
        setError(`Failed to fetch results: ${err instanceof Error ? err.message : 'Unknown error'}. Please check if the API server is running on localhost:8000`);
        
        setResults([{
          code: '',
          description: 'Error fetching results. Please try again.',
          isBestMatch: false
        }]);
        setResultCount(0);
        setShowResults(true);
      } finally {
        setIsLoading(false);
      }
    }, 300)
  ).current;

  // Handle search input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value);
  };

  // Handle search mode change
  const handleSearchModeChange = (mode: 'index' | 'codes') => {
    setSearchMode(mode);
    setSelectedTerm(null);
    setCodeDetails(null);
    setActiveTerm(null);
    setBreadcrumbs([]);
    setPreviousIndexState(null);
    setResults([]);
    setShowResults(false);
    setQuery('');
  };

  // Handle term selection
  const handleTermSelect = async (code: string, description: string) => {
    if (!code) return;
    
    if (searchMode === 'codes') {
      await fetchCodeDetails(code);
    } else {
      // Handle index mode term selection
      const termData: SearchResult = {
        code,
        description,
        terms: [] // Mock empty terms for now
      };
      setSelectedTerm(termData);
      setActiveTerm(termData);
      setBreadcrumbs([{code, description}]);
    }
    
    setShowResults(false);
  };

  // Fetch code details for codes mode - FIXED VERSION
  const fetchCodeDetails = async (code: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Actual API call for code details
      const endpoint = `https://icd-search.onrender.comapi/v1/search/${encodeURIComponent(code)}`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Assuming the first result is the exact match for the code
      const codeDetail = Array.isArray(data) && data.length > 0 ? data[0] : null;
      
      if (codeDetail) {
        setCodeDetails(codeDetail);
      } else {
        setError('Code details not found');
      }
    } catch (err) {
      console.error('Error fetching code details:', err);
      setError(`Failed to fetch code details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle manual search button click
  const handleSearch = () => {
    debouncedSearch(query);
  };

  // Handle back to index from codes mode
  const handleBackToIndex = () => {
    if (previousIndexState) {
      setSearchMode('index');
      setQuery(previousIndexState.query);
      setSelectedTerm(previousIndexState.selectedTerm);
      setActiveTerm(previousIndexState.activeTerm);
      setBreadcrumbs(previousIndexState.breadcrumbs);
      setCodeDetails(null);
      setPreviousIndexState(null);
    }
  };

  // Handle subterm selection
  const handleSubtermSelect = (subterm: SearchResult) => {
    setActiveTerm(subterm);
    setBreadcrumbs(prev => [...prev, {code: subterm.code || '', description: subterm.description || ''}]);
  };

  // Navigate to breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    setBreadcrumbs(prev => prev.slice(0, index + 1));
    // Set active term based on breadcrumb selection
  };

  // Navigate to home
  const navigateToHome = () => {
    setSelectedTerm(null);
    setActiveTerm(null);
    setBreadcrumbs([]);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  // Close results dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="h-screen overflow-y-auto bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search for ICD-10 Codes
        </h1>
        
        <div className="relative">
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            {/* Search Mode Selector */}
            <div className="md:w-40 mb-2 md:mb-0">
              <select
                value={searchMode}
                onChange={(e) => handleSearchModeChange(e.target.value as 'index' | 'codes')}
                className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="index">Index</option>
                <option value="codes">Codes</option>
              </select>
            </div>
            
            <div className="relative flex-1" ref={resultsRef}>
              <input
                type="text"
                placeholder="Enter diagnosis, condition or ICD-10 code"
                value={query}
                onChange={handleInputChange}
                className="w-full p-3 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
              
              {isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                </div>
              )}

              {/* Autocomplete dropdown */}
              {showResults && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-[400px] overflow-y-auto">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{resultCount} result{resultCount !== 1 ? 's' : ''} found</span>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                    {results.length > 0 && results.map((item, idx) => {
                      if (item.code === '' && item.description === 'No matching codes found') {
                        return (
                          <div key="no-results" className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                            No matching codes found
                          </div>
                        );
                      }
                      
                      return (
                        <div 
                          key={item.code + '-' + idx} 
                          className={`px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center ${item.isBestMatch ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                          onClick={() => handleTermSelect(item.code, item.description)}
                        >
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 dark:text-white flex items-center">
                              {item.isBestMatch && (
                                <span className="inline-flex items-center justify-center mr-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
                                  Best match
                                </span>
                              )}
                              {item.description}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.code}</div>
                          </div>
                          <div className="text-blue-500 dark:text-blue-400 ml-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={handleSearch}
              className="px-8 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm hover:shadow-md md:w-auto w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}

        {/* Code Details View */}
        {codeDetails && searchMode === 'codes' && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            {previousIndexState && (
              <div className="p-2 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-800">
                <button 
                  onClick={handleBackToIndex}
                  className="flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Index
                </button>
              </div>
            )}
            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-800 rounded-full p-2 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-grow">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {codeDetails.CodeDescription || codeDetails.description || codeDetails.title || 'Code Details'}
                  </h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Code: {codeDetails.ICDCode || codeDetails.lookupCode || codeDetails.code}
                  </div>
                </div>
                {codeDetails.isBillable && (
                  <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    Billable
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  {codeDetails.KeywordforthisCode && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Keyword</h3>
                      <p className="text-base text-gray-900 dark:text-white">{codeDetails.KeywordforthisCode}</p>
                    </div>
                  )}
                  {codeDetails.Synonym && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Synonym</h3>
                      <p className="text-base text-gray-900 dark:text-white">{codeDetails.Synonym}</p>
                    </div>
                  )}
                </div>
                <div>
                  {codeDetails.Specificity && (
                    <div className="mb-4">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Specificity</h3>
                      <p className="text-base text-gray-900 dark:text-white">{codeDetails.Specificity}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Term Details View */}
        {selectedTerm && searchMode === 'index' && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <div className="flex items-center">
                <div className="flex-shrink-0 bg-blue-100 dark:bg-blue-800 rounded-full p-2 mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 dark:text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{activeTerm?.description || selectedTerm.description}</h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">Code: {activeTerm?.code || selectedTerm.code}</div>
                </div>
              </div>
            </div>
            
            {/* Breadcrumb Navigation */}
            {breadcrumbs.length > 0 && (
              <div className="px-4 py-2 bg-gray-100 dark:bg-gray-750 flex flex-wrap items-center text-sm">
                <div className="flex items-center mr-2">
                  <button 
                    onClick={navigateToHome}
                    className="ml-1 text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
                  >
                    Home
                  </button>
                </div>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.code}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mx-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <button 
                      onClick={() => navigateToBreadcrumb(index)}
                      className={`px-2 py-1 rounded ${index === breadcrumbs.length - 1 ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400'}`}
                    >
                      {crumb.code}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
            
            <div className="p-4">
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Term details would be displayed here</p>
                <p className="text-sm mt-2">Connect to your API to see full functionality</p>
              </div>
            </div>
          </div>
        )}

        {/* Show this when no results and no selection */}
        {!selectedTerm && !codeDetails && query && !isLoading && !showResults && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No results found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchICD10;