import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../utils/supabaseClient';

// For generating UUIDs
const crypto = window.crypto;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any; success?: string }>;
  signUp: (email: string, password: string) => Promise<{ error: any; success?: string }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if there's a stored user in localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as User);
      } catch (e) {
        console.error('Error parsing stored user:', e);
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  // Removed generateUserId function

  // Generate a unique user ID (8 characters)
  const generateUserId = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const signUp = async (email: string, password: string) => {
    try {
      // Basic email validation
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(email)) {
        console.error('Client-side validation failed: Invalid email format');
        return { error: { message: 'Please enter a valid email address' }, success: null };
      }

      // Password validation
      if (password.length < 6) {
        console.error('Client-side validation failed: Password too short');
        return { error: { message: 'Password must be at least 6 characters long' }, success: null };
      }

      // First check if the email already exists in the users table
      const { data: existingUser, error: checkError } = await supabase
        .from('User')
        .select('email')
        .eq('email', email)
        .single();

      if (existingUser) {
        console.error('User already exists with this email');
        return { error: { message: 'An account with this email already exists' }, success: null };
      }

      // Generate a unique ID for the user
      const userId = generateUserId();

      // Insert the new user directly into the users table
      const { error: insertError } = await supabase
        .from('User')
        .insert({
          user_id: userId,
          email: email,
          password: password, // Adding password to the database
          // Note: In a real application, you should hash the password
          // This is a simplified example and not secure for production
        });

      if (insertError) {
        console.error('Error creating user account:', insertError);
        return { error: { message: 'Failed to create user account. Please try again.' }, success: null };
      }

      console.log('User account created successfully');
      return { error: null, success: 'Account created successfully! You can now sign in.' };

    } catch (error) {
      // Catch any other unexpected errors during the process
      console.error('Unexpected Signup Error:', error);
      let message = 'An unexpected error occurred during signup. Please try again.';
      if (error instanceof Error) {
        message = error.message; // Provide more specific error if available
      }
      return { error: { message }, success: null };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      // Check if the email exists in the users table and verify password
      const { data: userData, error: userError } = await supabase
        .from('User')
        .select('id, email, user_id, password')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        console.error('User not found:', userError);
        return { error: { message: 'Invalid email or password' }, success: null };
      }
      
      // Verify password
      if (userData.password !== password) {
        console.error('Invalid password');
        return { error: { message: 'Invalid email or password' }, success: null };
      }

      // Password verified, now setting the user
      
      // Create user object
      const userObject = {
        id: userData.id,
        email: userData.email,
        app_metadata: {}, // Required by User type
        user_metadata: {
          user_id: userData.user_id
        },
        aud: 'authenticated', // Required by User type
        created_at: new Date().toISOString() // Required by User type
      } as User;
      
      // Set the user in state
      setUser(userObject);
      
      // Store user in localStorage for persistence
      localStorage.setItem('user', JSON.stringify(userObject));
      
      console.log('User logged in successfully');
      return { error: null, success: 'Logged in successfully!' };
    } catch (error) {
      console.error('Unexpected login error:', error);
      let message = 'An unexpected error occurred during login. Please try again.';
      if (error instanceof Error) {
        message = error.message;
      }
      return { error: { message }, success: null };
    }
  };

  const signOut = async () => {
    // Clear the user from state
    setUser(null);
    // Remove user from localStorage
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default AuthProvider;
