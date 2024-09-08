/**
 * Handles the user logout process.
 * Sends a logout message, then updates the UI to reflect the logged-out state
 * if the logout is successful. Displays an error message if logout fails.
 */
function handleLogout() {
    chrome.runtime.sendMessage({ action: "logout" }, function (response) {
        if (response && response.success) {
            // Update UI to reflect logged out state
            updateUserInfo(null, 0);
            updateOptionsVisibility();
        } else {
            console.log("Logout error");
            showToast("Logout failed. Please try again.");
        }
    });
}

/**
 * Handles the user login process.
 * Sends a login message, then updates the UI with user information
 * if the login is successful.
 */
function handleLogin() {
    chrome.runtime.sendMessage({ action: "login" }, function (response) {
        if (response && response.user) {
            // Update UI with user information
            updateUserInfo(response.user, response.flashcardCount, response.freeGenerationLimit);
            updateOptionsVisibility();
        }
    });
}