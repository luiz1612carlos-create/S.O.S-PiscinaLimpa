
import { useState, useEffect, useCallback } from 'react';
import { auth, db } from '../firebase';
import { UserData } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<any | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchUserData = useCallback(async (uid: string) => {
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (userDoc.exists) {
                setUserData({ uid, ...userDoc.data() } as UserData);
            } else {
                // User is authenticated but has no data in Firestore (orphan user).
                // This is an invalid state, so we log them out to prevent an infinite loading loop.
                console.warn(`User with UID ${uid} exists in Auth but not in Firestore. Logging out.`);
                await auth.signOut();
                setUserData(null);
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
            // Also log out on error to prevent getting stuck
            await auth.signOut();
            setUserData(null);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (userAuth) => {
            if (userAuth) {
                setUser(userAuth);
                await fetchUserData(userAuth.uid);
            } else {
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [fetchUserData]);

    const login = async (email: string, pass: string) => {
        setLoading(true);
        try {
            await auth.signInWithEmailAndPassword(email, pass);
        } finally {
             // onAuthStateChanged will handle setting user and loading state
        }
    };

    const logout = async () => {
        setLoading(true);
        try {
            await auth.signOut();
        } finally {
            setUser(null);
            setUserData(null);
            setLoading(false);
        }
    };

    const changePassword = async (newPass: string) => {
        if (user) {
            await user.updatePassword(newPass);
        } else {
            throw new Error("No user is currently signed in.");
        }
    };

    return { user, userData, loading, login, logout, changePassword };
};