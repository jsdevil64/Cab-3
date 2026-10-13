import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
const firebaseConfig = {

  apiKey: "AIzaSyBkk1oX31KuYpPyha1Rr4EMkFoVVZgGUbk",

  authDomain: "cab-55abb.firebaseapp.com",

  projectId: "cab-55abb",

  storageBucket: "cab-55abb.firebasestorage.app",

  messagingSenderId: "368693936091",

  appId: "1:368693936091:web:b1343c8d474ca09e4431fe",

  measurementId: "G-3N7GSM67VH"

};
const app=initializeApp(firebaseConfig); export const auth=getAuth(app); export const db=getFirestore(app);
