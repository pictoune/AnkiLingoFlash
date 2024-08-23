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

function handleLogin() {
    chrome.runtime.sendMessage({ action: "login" }, function (response) {
        if (response && response.user) {
            // Update UI with user information
            updateUserInfo(response.user, response.flashcardCount, response.freeGenerationLimit);
            updateOptionsVisibility();
        }
    });
}