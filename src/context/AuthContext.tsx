import React, { createContext, useContext, useEffect, useState } from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (authenticatedUser) => {
            setUser(authenticatedUser);

            // IF authenticated, start background sync but DON'T block the UI
            if (authenticatedUser) {
                // We set loading to false early so the user can enter the app immediately
                setLoading(false);

                // Background: Check/Create Firestore user profile and admin status
                (async () => {
                    try {
                        const userRef = doc(db, 'users', authenticatedUser.uid);
                        const userDoc = await getDoc(userRef);

                        if (!userDoc.exists()) {
                            await setDoc(userRef, {
                                email: authenticatedUser.email,
                                displayName: authenticatedUser.displayName,
                                isAdmin: false,
                                createdAt: new Date().toISOString(),
                            });
                            setIsAdmin(false);
                        } else {
                            setIsAdmin(userDoc.data()?.isAdmin || false);
                        }
                    } catch (error) {
                        // Silently fail or log background errors - don't kick user out
                        console.warn('Background profile sync failed:', error);
                        setIsAdmin(false);
                    }
                })();
            } else {
                setIsAdmin(false);
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};
