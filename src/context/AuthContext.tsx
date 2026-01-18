import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface UserProfile {
    nickname?: string;
    emoji?: string;
    bgColor?: string;
    isAdmin?: boolean;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
    profile: UserProfile | null;
    updateUserProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAdmin: false,
    profile: null,
    updateUserProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

const isProduction = import.meta.env.VITE_APP_MODE === 'production';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);

    const updateUserProfile = async (data: Partial<UserProfile>) => {
        if (!user || !db || db.type !== 'firestore') return;
        try {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, data, { merge: true });
            setProfile(prev => ({ ...prev, ...data }));
            if (data.isAdmin !== undefined) setIsAdmin(data.isAdmin);
        } catch (error) {
            console.error('Failed to update profile:', error);
            throw error;
        }
    };

    useEffect(() => {
        if (isProduction) {
            setUser({
                uid: 'guest-user',
                email: 'guest@example.com',
                displayName: 'Guest User',
            } as User);
            setIsAdmin(true);
            setProfile({
                nickname: 'Guest User',
                emoji: '👨‍💻',
                bgColor: '#3b82f6',
                isAdmin: true
            });
            setLoading(false);
            return;
        }

        if (!auth) {
            setLoading(false);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser) => {
            setUser(authenticatedUser);

            if (authenticatedUser) {
                setLoading(false);

                if (db && db.type === 'firestore') {
                    try {
                        const userRef = doc(db, 'users', authenticatedUser.uid);
                        const userDoc = await getDoc(userRef);

                        if (!userDoc.exists()) {
                            const newProfile = {
                                email: authenticatedUser.email,
                                displayName: authenticatedUser.displayName,
                                isAdmin: false,
                                nickname: authenticatedUser.displayName || authenticatedUser.email?.split('@')[0],
                                emoji: '👤',
                                bgColor: '#3b82f6',
                                createdAt: new Date().toISOString(),
                            };
                            await setDoc(userRef, newProfile);
                            setProfile(newProfile);
                            setIsAdmin(false);
                        } else {
                            const data = userDoc.data();
                            setProfile(data as UserProfile);
                            setIsAdmin(data?.isAdmin || false);
                        }
                    } catch (error) {
                        console.warn('Background profile sync failed:', error);
                        setIsAdmin(false);
                    }
                }
            } else {
                setProfile(null);
                setIsAdmin(false);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin, profile, updateUserProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
