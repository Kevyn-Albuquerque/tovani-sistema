// firebase/firebaseConfig.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCWVvM1a2MQuEvaQ2r0jsg29D3Ze9dPMa4",
  authDomain: "tovani-sistem-interno.firebaseapp.com",
  projectId: "tovani-sistem-interno",
  storageBucket: "tovani-sistem-interno.firebasestorage.app",
  messagingSenderId: "435566383799",
  appId: "1:435566383799:web:b09ceeef55eeca72a93332"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

const auth = getAuth(app);

export { db, auth };

