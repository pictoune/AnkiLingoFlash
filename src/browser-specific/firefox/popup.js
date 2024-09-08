// Use 'browser' instead of 'chrome' for Firefox extensions
const chrome = browser;

/**
 * Handles the logout process.
 * Sends a logout message to the background script and updates the UI accordingly.
 * Displays an error message if the logout fails.
 */
function handleLogout() {
    browser.runtime.sendMessage({ action: "logout" }, function (response) {
        if (response && response.success) {
            updateUserInfo(null, 0);
            updateOptionsVisibility();
        } else {
            console.log("Logout error");
            showToast("Logout failed. Please try again.");
        }
    });
}

/**
 * Handles the login process.
 * Sends a login message to the background script, stores the user data in sync storage,
 * and updates the UI with the user information.
 */
function handleLogin() {
    browser.runtime.sendMessage({ action: "login" }).then(function (response) {
        if (response && response.user) {
            browser.storage.sync.set({
                user: response.user,
                flashcardCount: response.flashcardCount,
                freeGenerationLimit: response.freeGenerationLimit
            }).then(() => {
                updateUserInfo(response.user, response.flashcardCount, response.freeGenerationLimit);
                updateOptionsVisibility();
            });
        }
    });
}

/**
 * Updates the user information displayed in the UI.
 * If a user is logged in and not using own credits, it shows the user info.
 * Otherwise, it hides the user info section.
 * 
 * @param {Object} user - The user object containing user information.
 * @param {number} flashcardCount - The number of flashcards created.
 * @param {number} freeGenerationLimit - The limit of free flashcard generations.
 */
function updateUserInfo(user = null, flashcardCount = 0, freeGenerationLimit) {
    const userInfo = document.getElementById('user-info');

    browser.storage.sync.get(['isOwnCredits', 'freeGenerationLimit', 'userName', 'userEmail'], function (result) {
        const isOwnCreditsMode = result.isOwnCredits;
        const limit = freeGenerationLimit || result.freeGenerationLimit;

        if (user && !isOwnCreditsMode) {
            if (userInfo) {
                userInfo.style.display = 'block';
                userInfo.innerHTML = `
                    <h2>${browser.i18n.getMessage("welcome")} ${result.userName || user.name}!</h2>
                    <p>${browser.i18n.getMessage("loggedInMessage")}</p>
                    <p>Email: ${result.userEmail || user.email}</p>
                    <p id="flashcard-counter">${browser.i18n.getMessage("freeFlashcardsLeft")} <span id="flashcard-count">${limit - flashcardCount}</span></p>
                    <button id="logout-button" class="btn">${browser.i18n.getMessage("signOut")}</button>
                `;
                document.getElementById('logout-button').addEventListener('click', handleLogout);
            }
        } else {
            if (userInfo) userInfo.style.display = 'none';
        }
    });
}

/**
 * Updates the login button in the UI.
 * If the login button doesn't exist, it creates one with the necessary event listener.
 * 
 * @param {HTMLElement} container - The container element for the login button.
 */
function updateLoginButton(container) {
    if (!container.querySelector('#login-button')) {
        container.innerHTML = `
            <p>${browser.i18n.getMessage('pleaseSignIn')}</p>
            <button id="login-button" class="gsi-material-button">
                <div class="gsi-material-button-state"></div>
                <div class="gsi-material-button-content-wrapper">
                    <div class="gsi-material-button-icon">
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" xmlns:xlink="http://www.w3.org/1999/xlink" style="display: block;">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                            <path fill="none" d="M0 0h48v48H0z"></path>
                        </svg>
                    </div>
                    <span class="gsi-material-button-contents">${browser.i18n.getMessage('signInWithGoogle')}</span>
                    <span style="display: none;">${browser.i18n.getMessage('signInWithGoogle')}</span>
                </div>
            </button>
        `;
        document.getElementById('login-button').addEventListener('click', handleLogin);
    }
}