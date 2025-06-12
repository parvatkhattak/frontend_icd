import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthProvider, { useAuth } from './contexts/AuthContext';
import Header from './components/Header';
import ChatContainer from './components/ChatContainer';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import Navbar from './components/Navbar';
import SearchICD10 from './components/SearchICD10';

const AppContent = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, loading } = useAuth();

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen top-10 h-screen flex flex-col bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-colors relative overflow-hidden">
        {/* Header now takes full width with navbar integrated */}
        <Header isOpen={isSidebarOpen} />
        
        <div className="flex flex-1 overflow-hidden pt-16">
          {/* Sidebar - only shown on chat page */}
          <Routes>
            <Route path="/chat" element={
              <Sidebar isOpen={isSidebarOpen} onToggle={toggleSidebar} />
            } />
          </Routes>
          
          {/* Overlay for mobile */}
          {isSidebarOpen && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-[75] md:hidden" 
              onClick={toggleSidebar}
            />
          )}
          
          {/* Main content area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <main className="flex flex flex-col overflow-hidden">
              <Routes>
                <Route path="/" element={<Navigate to="/chat" replace />} />
                <Route path="/chat" element={<ChatContainer />} />
                <Route path="/search" element={<SearchICD10 />} />
              </Routes>
            </main>
          </div>
        </div>
      </div>
    </BrowserRouter>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <AppContent />
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;