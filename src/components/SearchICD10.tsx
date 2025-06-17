import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { debounce } from 'lodash';

interface Term {
  code: string;
  title: string;
  terms?: Term[];
}

interface TermDetails {
  code: string;
  description: string;
  terms?: Term[];
  parent?: TermDetails | null;
}

const SearchICD10: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{code: string, description: string, isBestMatch?: boolean}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<TermDetails | null>(null);
  const [activeTerm, setActiveTerm] = useState<TermDetails | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<TermDetails[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [resultCount, setResultCount] = useState<number>(0);
  const [searchMode, setSearchMode] = useState<'index' | 'codes'>('index');
  const [codeDetails, setCodeDetails] = useState<any>(null);
  const [previousIndexState, setPreviousIndexState] = useState<{
    query: string;
    selectedTerm: TermDetails | null;
    activeTerm: TermDetails | null;
    breadcrumbs: TermDetails[];
  } | null>(null);
  
  // Ref for the search results dropdown
  const resultsRef = useRef<HTMLDivElement>(null);

  // Process API response to extract terms and their hierarchy
  const processApiResponse = (data: any): Array<{code: string, description: string, isBestMatch?: boolean}> => {
    const extractedResults: Array<{code: string, description: string, isBestMatch?: boolean}> = [];
    
    // Parse the JSON string if it's a string
    let parsedData = data;
    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data);
      } catch (e) {
        console.error('Error parsing API response:', e);
        return [];
      }
    }
    
    const processItems = (items: any[]) => {
      items.forEach(item => {
        if (item.code && item.title) {
          extractedResults.push({
            code: item.code,
            description: item.title,
            isBestMatch: false
          });
        }
        
        if (item.terms && Array.isArray(item.terms)) {
          processItems(item.terms);
        }
      });
    };
    
    if (Array.isArray(parsedData)) {
      parsedData.forEach(item => {
        // Handle the case where the item has original_term
        if (item.original_term) {
          const originalTerm = item.original_term;
          if (originalTerm.code && originalTerm.title) {
            extractedResults.push({
              code: originalTerm.code,
              description: originalTerm.title,
              isBestMatch: true
            });
          }
          
          if (originalTerm.terms && Array.isArray(originalTerm.terms)) {
            processItems(originalTerm.terms);
          }
        } else if (item.code && item.title) {
          // Handle direct code/title items
          extractedResults.push({
            code: item.code,
            description: item.title,
            isBestMatch: false
          });
        }
      });
    } else if (parsedData && typeof parsedData === 'object') {
      // Handle single object response
      if (parsedData.original_term) {
        const originalTerm = parsedData.original_term;
        if (originalTerm.code && originalTerm.title) {
          extractedResults.push({
            code: originalTerm.code,
            description: originalTerm.title,
            isBestMatch: true
          });
        }
        
        if (originalTerm.terms && Array.isArray(originalTerm.terms)) {
          processItems(originalTerm.terms);
        }
      } else if (parsedData.code && parsedData.title) {
        extractedResults.push({
          code: parsedData.code,
          description: parsedData.title,
          isBestMatch: true
        });
      }
    }
    
    return extractedResults;
  };

  // Function to fetch term details
  const fetchTermDetails = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // First try to get detailed information about the specific code
      const detailsRes = await axios.get(`https://icd-search-vojg.onrender.com/api/code/${encodeURIComponent(code)}`);
      
      // If we get a valid response with the code details
      if (detailsRes.data && !detailsRes.data.error) {
        let detailsData = detailsRes.data;
        if (typeof detailsData === 'string') {
          try {
            detailsData = JSON.parse(detailsData);
          } catch (e) {
            console.error('Error parsing details response:', e);
            // Continue with search as fallback
          }
        }
        
        // Process the detailed code information
        if (detailsData.term) {
          const term = detailsData.term;
          const termDetails: TermDetails = {
            code: term.code || code,
            description: typeof term.title === 'object' ? 
              `${term.title._ || ''} ${term.title.nemod || ''}`.trim() : 
              term.title || `Term for code ${code}`,
            terms: term.children || term.terms || []
          };
          
          setSelectedTerm(termDetails);
          setActiveTerm(termDetails);
          setBreadcrumbs([termDetails]);
          setShowResults(false);
          return;
        }
      }
      
      // Fallback to search if code-specific endpoint doesn't return useful data
      const searchRes = await axios.get(`https://icd-search-vojg.onrender.com/api/search?query=${encodeURIComponent(code)}`);
      if (searchRes.data) {
        let searchData = searchRes.data;
        if (typeof searchData === 'string') {
          try {
            searchData = JSON.parse(searchData);
          } catch (e) {
            setError('Error parsing search response. Please try again.');
            setIsLoading(false);
            return;
          }
        }
        const processedResults = processApiResponse(searchData);
        console.log('Processed results for term details:', processedResults); // Debug log
        
        // First try to find exact match
        let matchedTerm = processedResults.find(item => item.code === code);
        
        // If no exact match, try case-insensitive match
        if (!matchedTerm) {
          matchedTerm = processedResults.find(item => 
            item.code.toLowerCase() === code.toLowerCase());
        }
        
        // If still no match, try partial match (code starts with)
        if (!matchedTerm) {
          matchedTerm = processedResults.find(item => 
            item.code.startsWith(code) || code.startsWith(item.code));
        }
        
        // If still no match, use the first result if available
        if (!matchedTerm && processedResults.length > 0) {
          matchedTerm = processedResults[0];
          console.log('Using first result as fallback:', matchedTerm);
        }
        
        if (matchedTerm) {
          // Try to find subterms for the matched term
          let subterms: Term[] = [];
          
          // Check if searchData has original_term structure
          if (Array.isArray(searchData)) {
            // Look for the item that matches our term
            const found = searchData.find((item: any) => 
              (item.code === matchedTerm.code) || 
              (item.original_term && item.original_term.code === matchedTerm.code));
            
            if (found) {
              // Check all possible locations for subterms
              if (found.terms) subterms = found.terms;
              else if (found.children) subterms = found.children;
              else if (found.original_term) {
                if (found.original_term.terms) subterms = found.original_term.terms;
                else if (found.original_term.children) subterms = found.original_term.children;
              }
            } else {
              // If we couldn't find the exact item, look for any terms in the response
              searchData.forEach((item: any) => {
                if (item.terms && Array.isArray(item.terms)) {
                  subterms = [...subterms, ...item.terms];
                }
                if (item.children && Array.isArray(item.children)) {
                  subterms = [...subterms, ...item.children];
                }
                if (item.original_term) {
                  if (item.original_term.terms) {
                    subterms = [...subterms, ...item.original_term.terms];
                  }
                  if (item.original_term.children) {
                    subterms = [...subterms, ...item.original_term.children];
                  }
                }
              });
            }
          } else {
            // Handle non-array response
            if (searchData.terms) subterms = searchData.terms;
            else if (searchData.children) subterms = searchData.children;
            else if (searchData.original_term) {
              if (searchData.original_term.terms) subterms = searchData.original_term.terms;
              else if (searchData.original_term.children) subterms = searchData.original_term.children;
            }
          }
          
          // Try to get subterms directly if we still don't have any
          if (subterms.length === 0) {
            try {
              // Make a specific request for children of this code
              const childrenRes = await axios.get(`https://icd-search-vojg.onrender.com/api/children?code=${encodeURIComponent(matchedTerm.code)}`);
              if (childrenRes.data && Array.isArray(childrenRes.data)) {
                subterms = childrenRes.data;
              } else if (childrenRes.data && childrenRes.data.children && Array.isArray(childrenRes.data.children)) {
                subterms = childrenRes.data.children;
              }
            } catch (childErr) {
              console.error('Error fetching children:', childErr);
              // Continue with empty subterms
            }
          }
          
          const termDetails: TermDetails = {
            code: matchedTerm.code,
            description: matchedTerm.description,
            terms: subterms
          };
          
          setSelectedTerm(termDetails);
          setActiveTerm(termDetails);
          setBreadcrumbs([termDetails]);
          setShowResults(false);
        } else {
          // Create a fallback term with the code that was searched for
          const fallbackTerm: TermDetails = {
            code: code,
            description: `Term for code ${code}`,
            terms: []
          };
          setSelectedTerm(fallbackTerm);
          setActiveTerm(fallbackTerm);
          setBreadcrumbs([fallbackTerm]);
          setShowResults(false);
          setError(`No detailed information found for code: ${code}. Showing basic information.`);
        }
      } else {
        setError('Could not retrieve term details. The API returned an empty response.');
      }
    } catch (err) {
      console.error('Error fetching term details:', err);
      setError('Failed to fetch term details. Please try again or check if the API server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  // Function to fetch code details using lookup_code endpoint
  const fetchCodeDetails = async (code: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await axios.get(`https://icd-search-vojg.onrender.com/api/lookup_code/${encodeURIComponent(code)}`);
      if (res.data) {
        console.log('Code Details Response:', res.data);
        
        // Handle both array and single object responses
        const codeData = Array.isArray(res.data) ? res.data[0] : res.data;
        
        // Map the response to a standardized format using exact field names from API
        const formattedCodeDetails = {
          code: codeData.ICDCode || codeData.code || code,
          description: codeData.CodeDescription || codeData.description || `Code ${code}`,
          lookupCode: codeData.lookupCode || codeData.ICDCode || codeData.code,
          seventhCharacter: codeData['7thCharacter'] || '',
          ICDCode: codeData.ICDCode || codeData.code,
          CodeDescription: codeData.CodeDescription || codeData.description || `Code ${code}`,
          KeywordforthisCode: codeData.KeywordforthisCode || '',
          Synonym: codeData.Synonym || '',
          GenderSpecificity: codeData.GenderSpecificity || '',
          AgeSpecificity: codeData.AgeSpecificity || '',
          "Excludes1Code(s)": codeData["Excludes1Code(s)"] || '',
          "Excludes2Code(s)": codeData["Excludes2Code(s)"] || '',
          "IncludesCode(s)": codeData["IncludesCode(s)"] || '',
          CodeAlso: codeData.CodeAlso || '',
          CodeFirst: codeData.CodeFirst || '',
          UseAdditionalCode: codeData.UseAdditionalCode || '',
          Laterality: codeData.Laterality || '',
          Specificity: codeData.Specificity || '',
          KeywordDescription: codeData.KeywordDescription || '',
          // Keep the original data for any fields we might have missed
          originalData: codeData
        };
        
        setCodeDetails(formattedCodeDetails);
        setSelectedTerm(null); // Clear the term details view
        setShowResults(false);
      } else {
        setError('Could not retrieve code details. The API returned an empty response.');
      }
    } catch (err) {
      console.error('Error fetching code details:', err);
      setError('Failed to fetch code details. Please try again or check if the API server is running.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle term selection
  const handleTermSelect = (code: string, description: string) => {
    if (searchMode === 'index') {
      // Save current index state before fetching code details
      setPreviousIndexState({
        query,
        selectedTerm,
        activeTerm,
        breadcrumbs
      });
      fetchTermDetails(code);
    } else {
      fetchCodeDetails(code);
    }
  };

  // Handle subterm selection
  const handleSubtermSelect = (subterm: Term) => {
    if (activeTerm) {
      const newTerm: TermDetails = {
        code: subterm.code,
        description: subterm.title,
        terms: subterm.terms || [],
        parent: activeTerm
      };
      
      setActiveTerm(newTerm);
      // Add to breadcrumbs only if it's not already there
      const existingIndex = breadcrumbs.findIndex(crumb => crumb.code === newTerm.code);
      if (existingIndex >= 0) {
        // If already exists, truncate breadcrumbs to this point
        setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
      } else {
        // Otherwise add to breadcrumbs
        setBreadcrumbs([...breadcrumbs, newTerm]);
      }
    }
  };

  // Navigate to a specific breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    if (index >= 0 && index < breadcrumbs.length) {
      const term = breadcrumbs[index];
      setActiveTerm(term);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    }
  };

  // Reset to home/initial term
  const navigateToHome = () => {
    if (selectedTerm) {
      setActiveTerm(selectedTerm);
      setBreadcrumbs([selectedTerm]);
    }
  };

  // Debounced search function
  const debouncedSearch = useRef(
    debounce(async (searchQuery: string, mode?: 'index' | 'codes') => {
      if (!searchQuery.trim()) {
        setResults([]);
        setShowResults(false);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      setCodeDetails(null); // Clear any previous code details
      
      // Use the provided mode parameter or fall back to the current searchMode state
      const currentMode = mode || searchMode;
      
      try {
        console.log("Search Mode:", currentMode);
        if (currentMode === 'codes') {
          // For codes mode, directly use the lookup_code endpoint
          const endpoint = `https://icd-search-vojg.onrender.com/api/lookup_code/${encodeURIComponent(searchQuery)}`;
          const res = await axios.get(endpoint);
          console.log("Codes API Response:", res.data);
          
          if (res.data) {
            console.log('lookupCode API Response:', res.data);
            // Format the response for codes mode
            const codeResults = Array.isArray(res.data) ? res.data : [res.data];
            console.log('Code Results Count:', codeResults.length);
            
            // Create a more detailed result format that includes all fields from the API response
            const formattedResults = codeResults.map(item => ({
              code: item.ICDCode || item.code || searchQuery,
              description: item.CodeDescription || item.description || item.title || `Code ${searchQuery}`,
              isBestMatch: item.Specificity === 'highly specific' || item.exact_match === true,
              // Include all the additional fields from the sample response using exact field names from API
              lookupCode: item.lookupCode || item.ICDCode || item.code,
              seventhCharacter: item['7thCharacter'] || '',
              ICDCode: item.ICDCode || item.code,
              CodeDescription: item.CodeDescription || item.description || item.title || `Code ${searchQuery}`,
              KeywordforthisCode: item.KeywordforthisCode || '',
              Synonym: item.Synonym || '',
              GenderSpecificity: item.GenderSpecificity || '',
              AgeSpecificity: item.AgeSpecificity || '',
              "Excludes1Code(s)": item["Excludes1Code(s)"] || '',
              "Excludes2Code(s)": item["Excludes2Code(s)"] || '',
              "IncludesCode(s)": item["IncludesCode(s)"] || '',
              CodeAlso: item.CodeAlso || '',
              CodeFirst: item.CodeFirst || '',
              UseAdditionalCode: item.UseAdditionalCode || '',
              Laterality: item.Laterality || '',
              Specificity: item.Specificity || '',
              KeywordDescription: item.KeywordDescription || '',
              originalData: item
            }));
            
            // Keep all results, only remove exact duplicates with the same code
            const uniqueResults = formattedResults.filter((item, index, self) =>
              index === self.findIndex((t) => t.code === item.code)
            );
            
            console.log('Unique Results Count:', uniqueResults.length);
            setResults(uniqueResults);
            setResultCount(uniqueResults.length);
            // Always show results dropdown in codes mode if we have results
            if (uniqueResults.length > 0) {
              setShowResults(true);
            } else {
              // If no results, show a "no results" placeholder
              setResults([{
                code: '',
                description: 'No matching codes found',
                isBestMatch: false
              }]);
              setResultCount(0);
              setShowResults(true);
            }
          } else {
            // Handle empty response
            setResults([{
              code: '',
              description: 'No matching codes found',
              isBestMatch: false
            }]);
            setResultCount(0);
            setShowResults(true);
          }
        } else {
          // For index mode, use the search endpoint
          const endpoint = `https://icd-search-vojg.onrender.com/api/search?query=${encodeURIComponent(searchQuery)}`;
          const res = await axios.get(endpoint);
          
          if (res.data) {
            console.log('Search Index Response:', res.data); // Debug log
            
            // For index mode, use the existing processing logic
            const processedResults = processApiResponse(res.data);
            console.log('Processed Results:', processedResults); // Debug log
            
            // Sort results to show best matches first
            const sortedResults = [...processedResults].sort((a, b) => {
              if (a.isBestMatch && !b.isBestMatch) return -1;
              if (!a.isBestMatch && b.isBestMatch) return 1;
              return 0;
            });
            
            setResults(sortedResults);
            setResultCount(sortedResults.length);
            setShowResults(sortedResults.length > 0);
          } else {
            setResults([]);
            setShowResults(false);
          }
        }
      } catch (err) {
        console.error(`Error searching ${currentMode === 'index' ? 'ICD-10 index' : 'codes'}:`, err);
        setError('Failed to fetch results. Please try again.');
        
        // Show a message in the results dropdown even when there's an error
        if (currentMode === 'codes') {
          setResults([{
            code: '',
            description: 'Error fetching results. Please try again.',
            isBestMatch: false
          }]);
          setResultCount(0);
          setShowResults(true);
        } else {
          setResults([]);
          setShowResults(false);
        }
      } finally {
        setIsLoading(false);
      }
    }, 300)
  ).current;

  // Handle search input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    debouncedSearch(value, searchMode); // Pass the current searchMode to maintain selection
  };
  
  // Handle search mode change
  const handleSearchModeChange = (mode: 'index' | 'codes') => {
    console.log("Switching to mode:", mode);
    setSearchMode(mode);
    setCodeDetails(null); // Clear code details when switching modes
    setSelectedTerm(null); // Clear selected term when switching modes
    setResults([]); // Clear previous results
    if (query.trim()) {
      // Force immediate search with the new mode
      debouncedSearch.cancel(); // Cancel any pending debounced searches
      debouncedSearch(query, mode); // Re-run search with new mode
    }
  };
  
  // Handle returning to index from code details
  const handleBackToIndex = () => {
    // Restore previous index state if available
    if (previousIndexState) {
      setQuery(previousIndexState.query);
      setSelectedTerm(previousIndexState.selectedTerm);
      setActiveTerm(previousIndexState.activeTerm);
      setBreadcrumbs(previousIndexState.breadcrumbs);
    }
    
    // Switch back to index mode
    setSearchMode('index');
    setCodeDetails(null);
  };

  // Handle manual search button click
  const handleSearch = () => {
    debouncedSearch(query, searchMode); // Pass the current searchMode to maintain selection
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
    <div className="h-screen overflow-y-auto scrollbar-hide bg-gray-100 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          Search for ICD-10 Codes
        </h1>
        
        <div className="relative">
          
          <div className="flex flex-col md:flex-row gap-2 mb-2">
            
            {/* Search Mode Selector Dropdown */}
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
              <div className='absolute right-[-113px] top-0'>
              <button 
              onClick={handleSearch}
              className="px-8 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm hover:shadow-md md:w-auto w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
              </div>
              

              {/* Autocomplete dropdown */}
              {showResults && (
                <div className="z-50 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-[400px] overflow-y-auto">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                    <span className="text-sm text-gray-500 dark:text-gray-400">{resultCount} result{resultCount !== 1 ? 's' : ''} found</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                      </svg>
                      Sorted by best match
                    </span>
                  </div>
                  <div className="max-h-[350px] overflow-y-auto">
                  {results.length > 0 && results.map((item, idx) => {
                    // Handle the "No matching codes found" placeholder
                    if (item.code === '' && item.description === 'No matching codes found') {
                      return (
                        <div key="no-results" className="px-4 py-3 text-center text-gray-500 dark:text-gray-400">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          No matching codes found
                        </div>
                      );
                    }
                    
                    // Regular result item
                    return (
                      <div 
                        key={item.code + '-' + idx} 
                        className={`px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center ${item.isBestMatch ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                        onClick={() => handleTermSelect(item.code, item.description)}
                      >
                        <div className="flex-1">
                          {searchMode === 'codes' && item.lookupCode ? (
                            // Enhanced display for codes mode
                            <>
                              <div className="font-medium text-gray-900 dark:text-white flex items-center">
                                {item.isBestMatch && (
                                  <span className="inline-flex items-center justify-center mr-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                    </svg>
                                    Best match
                                  </span>
                                )}
                                {item.description}
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 mt-1">
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">Lookup Code:</span> {item.lookupCode}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">ICD Code:</span> {item.code}
                                </div>
                                {item.seventhCharacter && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-medium">7th Character:</span> {item.seventhCharacter}
                                  </div>
                                )}
                                {item.keyword && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-medium">Keyword:</span> {item.keyword}
                                  </div>
                                )}
                                {item.synonym && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-medium">Synonym:</span> {item.synonym}
                                  </div>
                                )}
                                {item.specificity && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-medium">Specificity:</span> {item.specificity}
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            // Original display for index mode
                            <>
                              <div className="font-medium text-gray-900 dark:text-white flex items-center">
                                {item.isBestMatch && (
                                  <span className="inline-flex items-center justify-center mr-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full dark:bg-green-900 dark:text-green-300">
                                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                                    </svg>
                                    Best match
                                  </span>
                                )}
                                {item.description}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{item.code}</div>
                            </>
                          )}
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
            
          </div>
          
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
            {error}
          </div>
        )}

        {/* Code Details View */}
        {codeDetails && searchMode === 'codes' && (
          <>
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
                    {codeDetails.description || codeDetails.title || 'Code Details'}
                  </h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Code: {codeDetails.code}
                  </div>
                </div>
                <div className="ml-4 text-right">
                  {/* Gender Specificity (Top of Specificity, no label) */}
                  {codeDetails.GenderSpecificity && (
                    <div className="mb-1">
                      <p className="text-base text-gray-900 dark:text-white">{codeDetails.GenderSpecificity}</p>
                    </div>
                  )}
                  {/* Container for Laterality and Specificity */}
                  <div className="flex items-end">
                    {/* Laterality (Left of Specificity) */}
                    {codeDetails.Laterality && (
                      <div className="mr-4">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Laterality</h3>
                        <p className="text-base text-gray-900 dark:text-white">{codeDetails.Laterality}</p>
                      </div>
                    )}
                    {/* Specificity */}
                    {codeDetails.Specificity && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Specificity</h3>
                        <p className="text-base text-gray-900 dark:text-white">{codeDetails.Specificity}</p>
                      </div>
                    )}
                  </div>
                </div>
                {codeDetails.isBillable && (
                  <span className="ml-auto inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
                    </svg>
                    Billable
                  </span>
                )}
              </div>
            </div>
            
            <div className="p-4">
              {/* Two-column layout for code details without borders */}
              <div className="overflow-x-auto">
                <div className="overflow-y-auto max-h-[500px]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    {/* Left column */}
                    <div>
                     
                      
                      {/* Keyword */}
                      {codeDetails.KeywordforthisCode && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Keyword</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails.KeywordforthisCode}</p>
                        </div>
                      )}

                      {/* Keyword Description */}
                      {codeDetails.KeywordDescription && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Keyword Description</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails.KeywordDescription}</p>
                        </div>
                      )}
                      
                      
                      {/* Synonym */}
                      {codeDetails.Synonym && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Synonym</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails.Synonym}</p>
                        </div>
                      )}
                      

                    </div>
                    
                    {/* Right column */}
                    <div>
                      {/* Age Specificity */}
                      {codeDetails.AgeSpecificity && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Age Specificity</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails.AgeSpecificity}</p>
                        </div>
                      )}
                      
                      {/* Excludes1 Code(s) */}
                      {codeDetails["Excludes1Code(s)"] && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Excludes1 Code(s)</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails["Excludes1Code(s)"]}</p>
                        </div>
                      )}
                      
                      {/* Excludes2 Code(s) */}
                      {codeDetails["Excludes2Code(s)"] && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Excludes2 Code(s)</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails["Excludes2Code(s)"]}</p>
                        </div>
                      )}
                      
                      {/* Includes Code(s) */}
                      {codeDetails["IncludesCode(s)"] && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Includes Code(s)</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails["IncludesCode(s)"]}</p>
                        </div>
                      )}
                      
                      {/* Code Also */}
                      {codeDetails.CodeAlso && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Code Also</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails.CodeAlso}</p>
                        </div>
                      )}
                      
                      {/* Code First */}
                      {codeDetails.CodeFirst && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Code First</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails.CodeFirst}</p>
                        </div>
                      )}
                      
                      {/* Use Additional Code */}
                      {codeDetails.UseAdditionalCode && (
                        <div className="mb-4">
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Use Additional Code</h3>
                          <p className="text-base text-gray-900 dark:text-white">{codeDetails.UseAdditionalCode}</p>
                        </div>
                      )}
                      

                    </div>
                  </div>
                </div>
              </div>
                
                {/* Additional information sections without borders */}
                {codeDetails.includes && (
                    <div className="mt-6 mb-4">
                      <div className="flex items-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Includes</h3>
                      </div>
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <div className="space-y-2">
                          {typeof codeDetails.includes === 'string' ? (
                            <div className="text-sm text-green-800 dark:text-green-300">{codeDetails.includes}</div>
                          ) : (
                            Array.isArray(codeDetails.includes) ? 
                              codeDetails.includes.map((item: string, idx: number) => (
                                <div key={idx} className="text-sm text-green-800 dark:text-green-300">{item}</div>
                              )) : 
                              <div className="text-sm text-green-800 dark:text-green-300">{JSON.stringify(codeDetails.includes)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {codeDetails.excludes && (
                    <div className="mb-4">
                      <div className="flex items-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Excludes</h3>
                      </div>
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <div className="space-y-2">
                          {typeof codeDetails.excludes === 'string' ? (
                            <div className="text-sm text-red-800 dark:text-red-300">{codeDetails.excludes}</div>
                          ) : (
                            Array.isArray(codeDetails.excludes) ? 
                              codeDetails.excludes.map((item: string, idx: number) => (
                                <div key={idx} className="text-sm text-red-800 dark:text-red-300">{item}</div>
                              )) : 
                              <div className="text-sm text-red-800 dark:text-red-300">{JSON.stringify(codeDetails.excludes)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {codeDetails.notes && (
                    <div className="mb-4">
                      <div className="flex items-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Notes</h3>
                      </div>
                      <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                        <div className="space-y-2">
                          {typeof codeDetails.notes === 'string' ? (
                            <div className="text-sm text-yellow-800 dark:text-yellow-300">{codeDetails.notes}</div>
                          ) : (
                            Array.isArray(codeDetails.notes) ? 
                              codeDetails.notes.map((item: string, idx: number) => (
                                <div key={idx} className="text-sm text-yellow-800 dark:text-yellow-300">{item}</div>
                              )) : 
                              <div className="text-sm text-yellow-800 dark:text-yellow-300">{JSON.stringify(codeDetails.notes)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </>
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
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[600px] overflow-y-auto pr-2">
                {/* Left side - Term Information */}
                <div>
                  <div className="p-4 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                    <div className="flex items-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Term Information</h3>
                    </div>
                    <div className="space-y-3 bg-gray-50 dark:bg-gray-700 p-3 rounded-md max-h-[500px] overflow-y-auto">
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-28">Level:</span>
                        <span className="text-gray-900 dark:text-white flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          {breadcrumbs.length - 1}
                        </span>
                      </div>
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-28">Code:</span>
                        <span 
                          className="text-gray-900 dark:text-white font-mono cursor-pointer hover:text-blue-500 hover:underline"
                          onClick={() => {
                            if (activeTerm?.code) {
                              // Save current index state before switching to codes mode
                              setPreviousIndexState({
                                query,
                                selectedTerm,
                                activeTerm,
                                breadcrumbs
                              });
                              setSearchMode('codes');
                              fetchCodeDetails(activeTerm.code);
                            }
                          }}
                        >
                          {activeTerm?.code}
                        </span>
                      </div>
                      <div className="flex">
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 w-28">Description:</span>
                        <span className="text-gray-900 dark:text-white">{activeTerm?.description}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right side - Subterms */}
                <div>
                  <div className="p-4 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 shadow-sm">
                    <div className="flex items-center mb-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">Subterms</h3>
                      {activeTerm?.terms && activeTerm.terms.length > 0 && (
                        <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                          {activeTerm.terms.length}
                        </span>
                      )}
                    </div>
                    {activeTerm?.terms && activeTerm.terms.length > 0 ? (
                      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                        {activeTerm.terms.map((subterm, index) => (
                          <div 
                            key={`${subterm.code}-${index}`} 
                            className="p-3 border dark:border-gray-600 rounded hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors flex justify-between items-center"
                            onClick={() => handleSubtermSelect(subterm)}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900 dark:text-white">{subterm.title}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subterm.code}</div>
                              {subterm.terms && subterm.terms.length > 0 && (
                                <div className="flex items-center mt-1 text-xs text-blue-500 dark:text-blue-400">
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                  {subterm.terms.length} subterms
                                </div>
                              )}
                            </div>
                            <div className="ml-2">
                              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-green-100 bg-green-600 rounded-full dark:bg-green-700">
                                {subterm.code && subterm.code.includes('.') ? subterm.code.split('.')[0] : subterm.code}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-gray-500 dark:text-gray-400 text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p>No subterms available</p>
                        <p className="text-xs mt-1">Click on a subterm on the right to navigate deeper into the hierarchy.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Show this only when no term is selected and there are no autocomplete results */}
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
