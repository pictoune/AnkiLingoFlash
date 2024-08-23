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


function handleLogin() {
    chrome.runtime.sendMessage({ action: "login" }, function (response) {
        if (response && response.user) {
            updateUserInfo(response.user, response.flashcardCount, response.freeGenerationLimit);
            updateOptionsVisibility();
        }
    });
}