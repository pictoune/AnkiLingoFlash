/**
 * Handles the logout process.
 * Sends a logout message to the background script and handles the response.
 * Displays a toast notification if the logout fails or encounters an error.
 */
function handleLogout() {
    chrome.runtime.sendMessage({ action: "logout" }, function (response) {
        if (chrome.runtime.lastError) {
            console.error("Error during logout:", chrome.runtime.lastError);
            showToast(chrome.i18n.getMessage("logoutFailed"));
        } else if (response && response.success) {
            console.log("Logout successful");
        } else {
            console.log("Logout failed");
            showToast(chrome.i18n.getMessage("logoutFailed"));
        }
    });
}

/**
 * Initiates the logout process.
 * Sends a logout message to the background script, handles the response,
 * and updates the UI accordingly. Displays a toast notification on failure.
 */
function initiateLogout() {
    chrome.runtime.sendMessage({ action: "logout" }, function (response) {
        if (chrome.runtime.lastError) {
            console.error("Error during logout:", chrome.runtime.lastError);
            showToast(chrome.i18n.getMessage("logoutFailed"));
        } else if (response && response.success) {
            console.log("Logout successful");
            updateUserInfo(null, 0);
            updateOptionsVisibility();
        } else {
            console.log("Logout failed");
            showToast(chrome.i18n.getMessage("logoutFailed"));
        }
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "logoutCompleted") {
        updateUserInfo(null, 0);
        updateOptionsVisibility();
    }
});

/**
 * Handles the login process.
 * Sends a login message to the background script and updates the UI
 * with user information if the login is successful.
 */
function handleLogin() {
    chrome.runtime.sendMessage({ action: "login" }, function (response) {
        if (response && response.user) {
            updateUserInfo(response.user, response.flashcardCount, response.freeGenerationLimit);
            updateOptionsVisibility();
        }
    });
}