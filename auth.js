import { auth } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

onAuthStateChanged(auth, (user) => {
  if (!user) {
    // User is not logged in, redirect to login page
    window.location.href = 'login.html';
  }
});
