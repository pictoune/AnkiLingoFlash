chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle login request
    if (request.action === "login") {
        const isEdge = navigator.userAgent.indexOf("Edg") != -1;

        // Function to get auth token
        const getAuthToken = () => {
            return new Promise((resolve, reject) => {
                const redirectUrl = chrome.identity.getRedirectURL();
                const clientId = "706870995843-8ppfg159j0g5ulbr5j5agp3hriibvsbp.apps.googleusercontent.com";
                const scopes = encodeURIComponent("https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile");
                const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${scopes}`;

                chrome.identity.launchWebAuthFlow({
                    url: authUrl,
                    interactive: true
                }, function (responseUrl) {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        const token = new URLSearchParams(new URL(responseUrl).hash.slice(1)).get('access_token');
                        resolve(token);
                    }
                });
            });
        };

        // Get token and fetch user info
        getAuthToken().then(async (token) => {
            try {
                const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=' + token);
                const data = await response.json();
                const userData = await fetchOrInitializeUserData(data.id, data.name, data.email);
                userData.user = {
                    id: data.id,
                    name: data.name,
                    email: data.email
                };
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
            } catch (error) {
                console.error("Login error:", error);
                sendResponse({ error: error.message });
            }
        }).catch(error => {
            console.error("Auth token error:", error);
            sendResponse({ error: error.message });
        });

        return true; // Indicates that the response is asynchronous
    }
    // Handle logout request 
    else if (request.action === "logout") {
        chrome.storage.sync.get(['userId', 'flashcardCount', 'freeGenerationLimit', 'regenerationLimit'], function (result) {
            const updatedData = {
                userId: result.userId,
                user: null,
                flashcardCount: result.flashcardCount,
                freeGenerationLimit: result.freeGenerationLimit,
                regenerationLimit: result.regenerationLimit
            };
            chrome.storage.sync.set(updatedData, function () {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    chrome.runtime.sendMessage({ action: "logoutCompleted" });
                    sendResponse({ success: true });
                }
            });
        });
        return true; // Indicates that the response is asynchronous
    }
});