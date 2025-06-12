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
    <header className="w-full border-b dark:border-gray-700 py-3 bg-white dark:bg-gray-800 fixed top-0 z-[70] transition-all duration-300 ease-in-out shadow-sm">
      <div className="px-4 sm:px-6 flex items-center justify-between h-16 w-full">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <img
            src="src/assets/brix_logo.jpeg"
            alt="Brix AI Logo"
            className="h-5 w-auto sm:h-8 rounded-md"
          />
          <h1 className="font-bold text-xs sm:text-xl text-gray-900 dark:text-white">
            Medical Coding Assistant
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <Navbar />
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm hover:shadow-md"
              aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button
              onClick={signOut}
              className="p-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors shadow-sm hover:shadow-md flex items-center"
              aria-label="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
    </header>

  );
};

export default Header;
