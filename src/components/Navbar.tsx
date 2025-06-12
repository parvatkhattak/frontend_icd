import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, Search } from 'lucide-react';

const Navbar: React.FC = () => {
  const location = useLocation();
  
  return (
    <nav className="flex items-center space-x-4">
      <Link 
        to="/chat" 
        className={`flex items-center px-3 py-1.5 rounded-md transition-colors ${location.pathname === '/chat' ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
      >
        <MessageSquare size={16} className="mr-1.5" />
        Chat
      </Link>
      <Link 
        to="/search" 
        className={`flex items-center px-3 py-1.5 rounded-md transition-colors ${location.pathname === '/search' ? 'bg-blue-500 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
      >
        <Search size={16} className="mr-1.5" />
        Search ICD-10
      </Link>
    </nav>
  );
};

export default Navbar;