import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCoR7mMu5v7upOXfL4C9_pSR27mMzUE-x0",
  authDomain: "jeeto-bgmi-8c5db.firebaseapp.com",
  projectId: "jeeto-bgmi-8c5db",
  storageBucket: "jeeto-bgmi-8c5db.firebasestorage.app",
  messagingSenderId: "305560253751",
  appId: "1:305560253751:web:f7124237a69571443f96b2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export { collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, onSnapshot };
