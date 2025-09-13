import { auth, googleProvider } from './firebase.js';
import { signInWithPopup, RecaptchaVerifier, signInWithPhoneNumber } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const googleSignInBtn = document.getElementById('google-signin-btn');
const phoneNumberInput = document.getElementById('phone-number');
const sendCodeBtn = document.getElementById('send-code-btn');
const verificationCodeInput = document.getElementById('verification-code');
const verifyCodeBtn = document.getElementById('verify-code-btn');
const recaptchaContainer = document.getElementById('recaptcha-container');
const notification = document.getElementById('notification');

function showNotification(message) {
    notification.textContent = message;
}

// Google Sign-in
googleSignInBtn.addEventListener('click', () => {
    signInWithPopup(auth, googleProvider)
        .then((result) => {
            // This gives you a Google Access Token. You can use it to access the Google API.
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential.accessToken;
            // The signed-in user info.
            const user = result.user;
            window.location.href = 'index.html';
        }).catch((error) => {
            // Handle Errors here.
            const errorCode = error.code;
            const errorMessage = error.message;
            // The email of the user's account used.
            const email = error.customData.email;
            // The AuthCredential type that was used.
            const credential = GoogleAuthProvider.credentialFromError(error);
            showNotification(errorMessage);
        });
});

// Phone Authentication
window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
    'size': 'invisible',
    'callback': (response) => {
        // reCAPTCHA solved, allow signInWithPhoneNumber.
    }
});

sendCodeBtn.addEventListener('click', () => {
    const phoneNumber = phoneNumberInput.value;
    const appVerifier = window.recaptchaVerifier;

    signInWithPhoneNumber(auth, phoneNumber, appVerifier)
        .then((confirmationResult) => {
            // SMS sent. Prompt user to type the code from the message, then sign the
            // user in with confirmationResult.confirm(code).
            window.confirmationResult = confirmationResult;
            verificationCodeInput.style.display = 'block';
            verifyCodeBtn.style.display = 'block';
            sendCodeBtn.style.display = 'none';
            phoneNumberInput.style.display = 'none';
            recaptchaContainer.style.display = 'none';
        }).catch((error) => {
            // Error; SMS not sent
            showNotification(error.message);
            grecaptcha.reset(window.recaptchaWidgetId);
        });
});

verifyCodeBtn.addEventListener('click', () => {
    const code = verificationCodeInput.value;
    confirmationResult.confirm(code).then((result) => {
        // User signed in successfully.
        const user = result.user;
        window.location.href = 'index.html';
    }).catch((error) => {
        // User couldn't sign in (bad code?)
        showNotification('Invalid verification code');
    });
});
