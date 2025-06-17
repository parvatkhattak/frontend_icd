import React from 'react';
import { Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './Navbar';

interface HeaderProps {
  isOpen: boolean;
}

const Header: React.FC<HeaderProps> = ({ isOpen }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  return (
    <header className="w-full border-b dark:border-gray-700 py-2 sm:py-3 bg-white dark:bg-gray-800 fixed top-0 z-[70] transition-all duration-300 ease-in-out shadow-sm">
      <div className="px-2 sm:px-4 lg:px-6 flex items-center justify-between h-14 sm:h-16 w-full">
        {/* Logo and Title Section */}
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-shrink">
          <img
            src="brix_logo.jpeg"
            alt="Brix AI Logo"
            className="h-6 sm:h-8 w-auto rounded-md flex-shrink-0"
          />
          <h1 className="font-bold text-sm sm:text-xl text-gray-900 dark:text-white truncate">
            <span className="hidden sm:inline">Medical Coding Assistant</span>
            <span className="sm:hidden">MCA</span>
          </h1>
        </div>

        {/* Navigation and Controls Section */}
        <div className="flex items-center space-x-1 sm:space-x-4 flex-shrink-0">
          <Navbar />
          
          {/* Theme and Logout Buttons */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm hover:shadow-md"
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun size={16} className="sm:w-5 sm:h-5" /> : <Moon size={16} className="sm:w-5 sm:h-5" />}
            </button>
            <button
              onClick={signOut}
              className="p-1.5 sm:p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm hover:shadow-md flex items-center"
              aria-label="Sign out"
            >
              <LogOut size={16} className="sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
