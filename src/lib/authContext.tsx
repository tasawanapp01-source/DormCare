/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Property } from '../types';
import {
  fetchProperties,
  fetchUsersList,
  saveUserProfile,
  DEFAULT_PRIMARY_ADMIN,
  withTimeout,
  uploadSystemDataToDatabase,
  UploadSystemDataResult,
  testConnection,
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
  const [currentUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [activePropertyId, setActivePropertyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Restore session and load properties on initial mount
  useEffect(() => {
    let mounted = true;

    // Safety timeout: prevents infinite loading under slow networks
    const hardTimeout = setTimeout(() => {
      if (mounted) {
        setIsLoading(false);
      }
    }, 1500);

    async function initSession() {
      try {
        // Validate connection to Firestore
        await testConnection();

        // Ensure baseline admin and default property exist in Cloud Firestore
        if (db) {
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

        // Check if there is an active session
        const savedUid = localStorage.getItem(SESSION_UID_KEY);
        if (savedUid && mounted) {
          if (db) {
            const userSnap = await withTimeout(getDoc(doc(db, 'users', savedUid)), 2500, null);
            if (userSnap && userSnap.exists() && mounted) {
              const profile = { ...userSnap.data(), uid: userSnap.id } as UserProfile;
              if (profile.isActive !== false) {
                setUserProfile(profile);
                if (profile.propertyIds && profile.propertyIds.length > 0) {
                  setActivePropertyId(profile.propertyIds[0]);
                }
              } else {
                localStorage.removeItem(SESSION_UID_KEY);
                setUserProfile(null);
              }
            } else {
              // Check if it's the primary admin
              if (savedUid === DEFAULT_PRIMARY_ADMIN.uid) {
                setUserProfile(DEFAULT_PRIMARY_ADMIN);
              } else {
                localStorage.removeItem(SESSION_UID_KEY);
                setUserProfile(null);
              }
            }
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

  // Real Database Login: Validate selected user or identifier & password directly from Cloud Firestore
  const login = async (identifier: string, pass: string) => {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanId || !cleanPass) {
      throw new Error('กรุณาเลือกผู้ใช้งานหรือกรอกชื่อผู้ใช้ และกรอกรหัสผ่าน');
    }

    // 1. Fetch available users directly from Cloud Firestore
    const users = await fetchUsersList();

    let matched = users.find((u) => {
      const cleanInput = cleanId.replace(/\s+/g, ' ');
      const userDisplayName = u.displayName?.toLowerCase().trim().replace(/\s+/g, ' ');
      return (
        u.uid === identifier ||
        userDisplayName === cleanInput ||
        (u.username && u.username.toLowerCase() === cleanId) ||
        (u.email && u.email.toLowerCase() === cleanId) ||
        (u.phone && cleanId.length >= 8 && u.phone.replace(/\D/g, '') === cleanId.replace(/\D/g, ''))
      );
    });

    // If primary admin was requested and not yet found in Firestore, seed primary admin
    if (
      !matched &&
      (cleanId === 'admin' ||
        cleanId === 'ผู้ดูแลระบบ' ||
        cleanId === 'ผู้ดูแลระบบหลัก (admin)' ||
        identifier === DEFAULT_PRIMARY_ADMIN.uid) &&
      cleanPass === '213894120'
    ) {
      matched = DEFAULT_PRIMARY_ADMIN;
      await saveUserProfile(DEFAULT_PRIMARY_ADMIN);
    }

    if (!matched) {
      throw new Error(`ไม่พบบัญชีผู้ใช้ "${identifier}" ในฐานข้อมูล กรุณาตรวจสอบชื่อ-นามสกุล`);
    }

    // 2. Validate password stored in Firestore
    if (matched.password !== cleanPass) {
      throw new Error('รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านอีกครั้ง');
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
      if (savedUid && db) {
        try {
          const snap = await withTimeout(getDoc(doc(db, 'users', savedUid)), 2000, null);
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
