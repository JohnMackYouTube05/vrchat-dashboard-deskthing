// src/context/UserContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CombinedUser } from '../types/types';
import type { ProfileDetails } from '../types/profile';
import { dt } from '../deskthing';
type UserContextType = {
  users: CombinedUser[];
  setUsers: React.Dispatch<React.SetStateAction<CombinedUser[]>>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

const initialUsers: CombinedUser[] = [];

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<CombinedUser[]>(initialUsers);
  useEffect(() => {
    // Stay subscribed when HomePage unmounts to show a profile.
    const removeFriends = dt.on('vrc_friendslist', data => {
      try {
        const friends: CombinedUser[] = JSON.parse(data.payload);
        if (!Array.isArray(friends)) return;
        setUsers(previous => friends.map(friend => ({
          ...friend, profile: previous.find(item => item.user.id === friend.user.id)?.profile,
        })));
      } catch { /* Leave the current list intact on malformed data. */ }
    });
    const removeProfile = dt.on('vrc_profile', data => {
      try {
        const profile: ProfileDetails = JSON.parse(data.payload);
        setUsers(previous => previous.map(friend => friend.user.id === profile.id ? { ...friend, profile } : friend));
      } catch { /* A failed profile must not clear the friends list. */ }
    });
    return () => { removeFriends(); removeProfile(); };
  }, []);

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
