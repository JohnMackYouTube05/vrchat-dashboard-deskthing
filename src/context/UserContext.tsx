// src/context/UserContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CombinedUser } from '../types/types';
type UserContextType = {
  users: CombinedUser[];
  setUsers: React.Dispatch<React.SetStateAction<CombinedUser[]>>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

const initialUsers: CombinedUser[] = [];

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<CombinedUser[]>(initialUsers);

  return (
    <UserContext.Provider value={{ users, setUsers }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
};
