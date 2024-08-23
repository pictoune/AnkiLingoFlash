// Listen for messages from the extension's popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle login request
    if (request.action === "login") {
        // Get an authentication token from Chrome's identity API
        chrome.identity.getAuthToken({ interactive: true }, function (token) {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError });
                return;
            }
            try {
                // Fetch user info using the obtained token
                fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=' + token)
                    .then(response => response.json())
                    .then(async data => {
                        // Initialize or fetch user data
                        const userData = await fetchOrInitializeUserData(data.id, data.name, data.email);
                        userData.user = {
                            id: data.id,
                            name: data.name,
                            email: data.email
                        };
                        // Save user data to Chrome storage
                        chrome.storage.sync.set(userData, function () {
                            sendResponse({
                                user: userData.user,
                                flashcardCount: userData.flashcardCount,
                                freeGenerationLimit: userData.freeGenerationLimit
                            });
                        });

                        // Send user information to the worker
                        await fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/user-data', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                userId: data.id,
                                userName: data.name,
                                userEmail: data.email
                            })
                        });
                    })
                    .catch(error => sendResponse({ error: error.message }));
            } catch (error) {
                sendResponse({ error: error.message });
            }
        });
        return true; // Indicates that the response is asynchronous
        // Handle logout request
    } else if (request.action === "logout") {
        chrome.storage.sync.get(['userId', 'flashcardCount', 'freeGenerationLimit', 'regenerationLimit'], function (result) {
            // Clear cached auth tokens
            chrome.identity.clearAllCachedAuthTokens(function () {
                const updatedData = {
                    userId: result.userId,
                    user: null,
                    flashcardCount: result.flashcardCount,
                    freeGenerationLimit: result.freeGenerationLimit,
                    regenerationLimit: result.regenerationLimit
                };
                // Update storage with logged out state
                chrome.storage.sync.set(updatedData, function () {
                    sendResponse({ success: true });
                });
            });
        });
        return true; // Indicates that the response is asynchronous
    }
});