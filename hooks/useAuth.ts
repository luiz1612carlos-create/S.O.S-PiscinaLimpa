
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { UserData } from '../types';

export const useAuth = () => {
    const [user, setUser] = useState<any | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(async (firebaseUser: any) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                try {
                    const doc = await db.collection('users').doc(firebaseUser.uid).get();
                    if (doc.exists) {
                        setUserData(doc.data() as UserData);
                    } else {
                        // Handle case where user exists in Auth but not Firestore
                        setUserData(null);
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const login = (email: string, pass: string) => {
        return auth.signInWithEmailAndPassword(email, pass);
    };

    const logout = () => {
        return auth.signOut();
    };

    const changePassword = async (newPass: string) => {
        if (user) {
            await user.updatePassword(newPass);
        } else {
            throw new Error("No user signed in");
        }
    };

    return { user, userData, loading, login, logout, changePassword };
};