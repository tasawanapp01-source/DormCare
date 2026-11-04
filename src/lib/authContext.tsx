/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import { UserProfile, Property } from '../types';
import {
  fetchProperties,
  fetchUsersList,
  getStoredUsers,
  saveUserProfile,
  DEFAULT_PRIMARY_ADMIN,
  withTimeout,
  uploadSystemDataToDatabase,
  UploadSystemDataResult,
} from './firestoreService';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userProfile: UserProfile | null;
  activeProperty: Property | null;
  activePropertyId: string;
  properties: Property[];
  isLoading: boolean;
  login: (identifier: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  switchProperty: (propertyId: string) => void;
  refreshUserData: () => Promise<void>;
  syncSystemData: () => Promise<UploadSystemDataResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SESSION_UID_KEY = 'dormcare_session_uid';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session and load properties on initial mount
  useEffect(() => {
    let mounted = true;

    // Hard fallback timeout: guarantees loading screen ends in max 600ms under any network conditions
    const hardTimeout = setTimeout(() => {
      if (mounted) {
        setIsLoading(false);
      }
    }, 600);

    async function initSession() {
      try {
        // Automatically ensure system data is uploaded and synced to Firestore (Zero Mock Data)
        if (db && isFirebaseConfigured()) {
          uploadSystemDataToDatabase().catch((err) => {
            console.warn('Initial system data upload note:', err);
          });
        }

        const props = await fetchProperties();
        if (mounted) {
          setProperties(props);
          if (props.length > 0) {
            setActivePropertyId((prev) => prev || props[0].id);
          }
        }

        // Check if there is an active logged-in user in session
        const savedUid = localStorage.getItem(SESSION_UID_KEY);
        if (savedUid && mounted) {
          // Check local stored users first for instant zero-lag resume
          const localUsers = getStoredUsers();
          const cachedUser = localUsers.find((u) => u.uid === savedUid);
          if (cachedUser && cachedUser.isActive !== false) {
            setUserProfile(cachedUser);
            if (cachedUser.propertyIds && cachedUser.propertyIds.length > 0) {
              setActivePropertyId(cachedUser.propertyIds[0]);
            }
          } else {
            localStorage.removeItem(SESSION_UID_KEY);
            setUserProfile(null);
          }

          // In background, verify against Firestore if available without blocking
          if (db && isFirebaseConfigured()) {
            withTimeout(getDoc(doc(db, 'users', savedUid)), 1200, null)
              .then((userSnap) => {
                if (userSnap && userSnap.exists() && mounted) {
                  const profile = { ...userSnap.data(), uid: userSnap.id } as UserProfile;
                  if (profile.isActive !== false) {
                    setUserProfile(profile);
                  } else {
                    localStorage.removeItem(SESSION_UID_KEY);
                    setUserProfile(null);
                  }
                }
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.error('Error initializing auth session:', err);
      } finally {
        clearTimeout(hardTimeout);
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    initSession();

    return () => {
      mounted = false;
      clearTimeout(hardTimeout);
    };
  }, []);

  // Real Database Login: Validate username & password directly from database
  const login = async (identifier: string, pass: string) => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      throw new Error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    }

    // 1. Fetch available users directly from database
    const users = await fetchUsersList();
    
    let matched = users.find((u) => {
      return (
        u.username?.toLowerCase() === cleanId ||
        u.email?.toLowerCase() === cleanId
      );
    });

    // If primary admin was requested and not yet found, seed primary admin
    if (!matched && cleanId === 'admin' && cleanPass === '213894120') {
      matched = DEFAULT_PRIMARY_ADMIN;
      await saveUserProfile(DEFAULT_PRIMARY_ADMIN);
    }

    if (!matched) {
      throw new Error(`ไม่พบชื่อผู้ใช้ "${identifier}" ในฐานข้อมูล`);
    }

    // 2. Validate password stored in database
    if (matched.password !== cleanPass) {
      throw new Error('ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
    }

    // 3. Validate account status
    if (matched.isActive === false) {
      throw new Error('บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ');
    }

    // 4. Set authenticated session
    setUserProfile(matched);
    localStorage.setItem(SESSION_UID_KEY, matched.uid);

    if (matched.propertyIds && matched.propertyIds.length > 0) {
      setActivePropertyId(matched.propertyIds[0]);
    }
  };

  const logout = async () => {
    localStorage.removeItem(SESSION_UID_KEY);
    setUserProfile(null);
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.warn('Firebase signOut note:', e);
      }
    }
  };

  const switchProperty = (propertyId: string) => {
    setActivePropertyId(propertyId);
  };

  const refreshUserData = async () => {
    try {
      const props = await fetchProperties();
      setProperties(props);
      const savedUid = localStorage.getItem(SESSION_UID_KEY);
      if (savedUid && db && isFirebaseConfigured()) {
        try {
          const snap = await withTimeout(getDoc(doc(db, 'users', savedUid)), 1500, null);
          if (snap && snap.exists()) {
            setUserProfile({ ...snap.data(), uid: snap.id } as UserProfile);
          }
        } catch (e) {
          console.warn('refreshUserData getDoc note:', e);
        }
      }
    } catch (err) {
      console.warn('refreshUserData note:', err);
    }
  };

  const syncSystemData = async (): Promise<UploadSystemDataResult> => {
    const result = await uploadSystemDataToDatabase();
    await refreshUserData();
    return result;
  };

  const activeProperty = properties.find((p) => p.id === activePropertyId) || properties[0] || null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        activeProperty,
        activePropertyId,
        properties,
        isLoading,
        login,
        logout,
        switchProperty,
        refreshUserData,
        syncSystemData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
