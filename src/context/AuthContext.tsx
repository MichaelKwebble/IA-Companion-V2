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
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);

            if (user) {
                // Check for admin status in Firestore
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (!userDoc.exists()) {
                        // Initialize user doc if it doesn't exist
                        await setDoc(doc(db, 'users', user.uid), {
                            email: user.email,
                            displayName: user.displayName,
                            isAdmin: false,
                            createdAt: new Date().toISOString(),
                        });
                        setIsAdmin(false);
                    } else {
                        setIsAdmin(userDoc.data()?.isAdmin || false);
                    }
                } catch (error) {
                    console.error('Error fetching user roles:', error);
                    setIsAdmin(false);
                }
            } else {
                setIsAdmin(false);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, isAdmin }}>
            {children}
        </AuthContext.Provider>
    );
};
