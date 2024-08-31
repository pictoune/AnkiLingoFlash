const DEV_MODE = false;

// Wait for the DOM to be fully loaded before executing the main function
document.addEventListener('DOMContentLoaded', function () {
    const popupContainer = document.getElementById('popup-container');
    if (popupContainer) {
        popupContainer.classList.add('fixed-width-popup');
    }

    const elementsToTranslate = [
        { id: 'settingsTitle', key: 'settingsTitle', html: true },
        { id: 'aiModelToggle', key: 'aiModelToggle' },
        { id: 'chooseLanguage', key: 'chooseLanguage', html: true },
        { id: 'ownCreditsOrFreeTrial', key: 'ownCreditsOrFreeTrial', html: true },
        { id: 'enterOpenAIKey', key: 'enterOpenAIKey' },
        { id: 'validate', key: 'validate' },
        { id: 'chooseChatGPTModel', key: 'chooseChatGPTModel' },
        { id: 'pleaseSignIn', key: 'pleaseSignIn' },
        { id: 'signInWithGoogle', key: 'signInWithGoogle' },
        { id: 'notAvailableYet', key: 'notAvailableYet' },
        { id: 'welcome', key: 'welcome' },
        { id: 'loggedInMessage', key: 'loggedInMessage' },
        { id: 'freeFlashcardsLeft', key: 'freeFlashcardsLeft' },
        { id: 'signOut', key: 'signOut' },
        { id: 'local', key: 'local' },
        { id: 'remote', key: 'remote' },
        { id: 'ownCredits', key: 'ownCredits' },
        { id: 'freeTrial', key: 'freeTrial' }
    ];

    // Function to translate elements based on their data-i18n attribute
    function translateElements() {
        elementsToTranslate.forEach(item => {
            const elements = document.querySelectorAll(`[data-i18n="${item.key}"]`);
            elements.forEach(element => {
                const message = chrome.i18n.getMessage(item.key);
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = message;
                } else if (item.html || message.includes('<')) {
                    element.innerHTML = message;
                } else {
                    element.textContent = message;
                }
            });
        });
    }

    // Call the translation function
    translateElements();

    // Initialize various components and settings
    loadSavedLanguage();
    initializeToggleSwitches();
    addEventListeners();
    updateUserInfo();
    updateOptionsVisibility();
    addModelChoiceListener();
});

/**
 * Escapes HTML characters to prevent XSS attacks.
 * 
 * @param {string} unsafeText - The text to be escaped.
 * @returns {string} The escaped text.
 */
function escapeHTML(unsafeText) {
    return unsafeText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Get a localized sort function based on the given language.
 * @param {string} language - The language code.
 * @returns {Function} A comparison function for sorting.
 */
function getLocalizedSort(language) {
    // Map of language codes to their respective locales
    const languageCodes = {
        'english_us': 'en-US',
        'english_uk': 'en-GB',
        'english_au': 'en-AU',
        'english_ca': 'en-CA',
        'spanish_es': 'es-ES',
        'spanish_latam': 'es-419',
        'french_fr': 'fr-FR',
        'french_ca': 'fr-CA',
        'german_de': 'de-DE',
        'german_ch': 'de-CH',
        'italian_it': 'it-IT',
        'italian_ch': 'it-CH',
        'dutch_nl': 'nl-NL',
        'dutch_be': 'nl-BE',
        'portuguese_pt': 'pt-PT',
        'portuguese_br': 'pt-BR',
        'russian': 'ru-RU',
        'mandarin_simplified': 'zh-Hans',
        'mandarin_traditional': 'zh-Hant',
        'cantonese': 'yue-Hant-HK',
        'japanese': 'ja-JP',
        'arabic_standard': 'ar-SA',
        'arabic_eg': 'ar-EG',
        'korean': 'ko-KR',
        'hindi': 'hi-IN'
    };

    const localeCode = languageCodes[language] || 'en-US';

    try {
        // Create and return a comparison function using Intl.Collator
        return new Intl.Collator(localeCode).compare;
    } catch (error) {
        console.warn(`Failed to create Collator for language ${language}. Falling back to default sort.`, error);
        // If Collator creation fails, return a simple string comparison function
        return (a, b) => a.localeCompare(b);
    }
}

/**
 * Generate language options for the dropdown.
 * @param {string} currentLanguage - The currently selected language.
 * @returns {Promise<string>} A promise that resolves to an HTML string of language options.
 */
async function generateLanguageOptions(currentLanguage) {
    return new Promise((resolve) => {
        chrome.i18n.getAcceptLanguages((languages) => {
            const sortFunction = getLocalizedSort(currentLanguage);

            const languageMapping = {
                'en_us': 'english_us',
                'en_uk': 'english_uk',
                'en_au': 'english_au',
                'en_ca': 'english_ca',
                'es_es': 'spanish_es',
                'es_latam': 'spanish_latam',
                'fr_fr': 'french_fr',
                'fr_ca': 'french_ca',
                'de_de': 'german_de',
                'de_ch': 'german_ch',
                'it_it': 'italian_it',
                'it_ch': 'italian_ch',
                'nl_nl': 'dutch_nl',
                'nl_be': 'dutch_be',
                'pt_pt': 'portuguese_pt',
                'pt_br': 'portuguese_br',
                'ru': 'russian',
                'mandarin_simplified': 'mandarin_simplified',
                'mandarin_traditional': 'mandarin_traditional',
                'cantonese': 'cantonese',
                'japanese': 'japanese',
                'arabic_standard': 'arabic_standard',
                'arabic_eg': 'arabic_eg',
                'korean': 'korean',
                'hindi': 'hindi'
            };

            // Generate HTML options for each language, sorted by the localized name
            const languageOptions = Object.entries(languageMapping)
                .map(([code, name]) => ({
                    code,
                    name: chrome.i18n.getMessage(name) || name
                }))
                .sort((a, b) => sortFunction(a.name, b.name))
                .map(({ code, name }) =>
                    `<option value="${code}" ${currentLanguage === code ? 'selected' : ''}>${name}</option>`
                )
                .join('');

            resolve(languageOptions);
        });
    });
}

/**
 * Decrypt an API key.
 * @param {Object} encryptedData - The encrypted API key data.
 * @param {string} password - The password used for decryption.
 * @returns {Promise<string>} A promise that resolves with the decrypted API key.
 */
async function decryptApiKey(encryptedData, password) {
    const encoder = new TextEncoder();
    // Import the password as a key
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    // Derive a key using PBKDF2
    const derivedKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: new Uint8Array(encryptedData.salt), iterations: 100000, hash: "SHA-256" },
        key,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );
    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) },
        derivedKey,
        new Uint8Array(encryptedData.encrypted)
    );
    // Return the decrypted data as a string
    return new TextDecoder().decode(decrypted);
}

/**
 * Load the saved language and set up the language dropdown.
 */
async function loadSavedLanguage() {
    const languageSelect = document.getElementById('languageSelect');
    if (languageSelect) {
        chrome.storage.sync.get(['language'], async function (result) {
            let currentLanguage = result.language;
            if (!currentLanguage) {
                currentLanguage = navigator.language.replace('-', '_').toLowerCase();

                const browserToAppLanguage = {
                    'en': 'en_us',
                    'es': 'es_es',
                    'fr': 'fr_fr',
                    'de': 'de_de',
                    'it': 'it_it',
                    'nl': 'nl_nl',
                    'pt': 'pt_pt',
                    'ru': 'ru',
                    'zh': 'mandarin_simplified',
                    'ja': 'japanese',
                    'ar': 'arabic_standard',
                    'ko': 'korean',
                    'hi': 'hindi'
                };
                currentLanguage = browserToAppLanguage[currentLanguage.split('_')[0]] || 'en_us';
            }
            // Generate language options and set the dropdown HTML
            const options = await generateLanguageOptions(currentLanguage);
            languageSelect.innerHTML = options;
            languageSelect.value = currentLanguage;
            // Save the current language
            chrome.storage.sync.set({ language: currentLanguage });
        });

        // Add event listener for language change
        languageSelect.addEventListener('change', function () {
            const selectedLanguage = this.value;
            chrome.storage.sync.set({ language: selectedLanguage }, function () {
                console.log('Language saved:', selectedLanguage);
                chrome.storage.sync.get(['language'], function (result) {
                    console.log('Language retrieved:', result.language);
                });
            });
        });
    }
}

/**
 * Initialize toggle switches and load saved settings.
 */
function initializeToggleSwitches() {
    const useOwnApiKeyToggle = document.getElementById('useOwnApiKeyToggle');
    const ownCreditsOption = document.getElementById('ownCreditsOption');
    const freeTrialOption = document.getElementById('freeTrialOption');

    if (useOwnApiKeyToggle && ownCreditsOption && freeTrialOption) {
        // Add event listener for API key toggle
        useOwnApiKeyToggle.addEventListener('change', function () {
            chrome.storage.sync.set({ isOwnCredits: this.checked }, function () {
                console.log('isOwnCredits saved:', this.checked);
                updateOptionsVisibility();
            });
        });
    }

    // Load saved settings and decrypt API key if available
    chrome.storage.sync.get(['isOwnCredits', 'encryptedApiKey', 'installationPassword'], async function (result) {
        if (useOwnApiKeyToggle) {
            useOwnApiKeyToggle.checked = result.isOwnCredits;
        }

        const apiKeyField = document.getElementById('apiKey');
        if (result.encryptedApiKey && result.installationPassword && apiKeyField) {
            try {
                const decryptedApiKey = await decryptApiKey(result.encryptedApiKey, result.installationPassword);
                apiKeyField.value = decryptedApiKey;
            } catch (decryptError) {
                console.log(chrome.i18n.getMessage("failedToDecryptApiKey"), decryptError);
                apiKeyField.value = '';
            }
        }

        updateOptionsVisibility();
    });
}

/**
 * Add event listeners to various elements.
 */
function addEventListeners() {
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const validateApiKey = document.getElementById('validateApiKey');

    if (loginButton) {
        loginButton.addEventListener('click', handleLogin);
    }
    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
    if (validateApiKey) {
        validateApiKey.addEventListener('click', handleValidateApiKey);
    }
}


/**
 * Handle API key validation.
 */
async function handleValidateApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    if (!apiKeyInput) {
        console.log("API Key input field not found");
        return;
    }
    const apiKey = apiKeyInput.value.trim();

    if (apiKey) {
        // Send message to background script to validate the API key
        chrome.runtime.sendMessage({ action: "validateApiKey", apiKey: apiKey }, async function (response) {
            if (chrome.runtime.lastError) {
                console.log('Error:', chrome.runtime.lastError);
                showToast(chrome.i18n.getMessage("errorOccurred"));
                return;
            }

            if (response && response.valid) {
                apiKeyInput.classList.remove('invalid');
                apiKeyInput.classList.add('valid');
                hideApiKeyError();

                // Generate a new installation password and encrypt the API key
                const installationPassword = await generateInstallationPassword();
                const encryptedApiKey = await encryptApiKey(apiKey, installationPassword);

                // Save the validated and encrypted API key
                chrome.storage.sync.set({
                    apiKeyValidated: true,
                    encryptedApiKey: encryptedApiKey,
                    installationPassword: installationPassword,
                    isOwnCredits: true
                }, function () {
                    console.log("API key validated and stored successfully");
                    updateOptionsVisibility();
                    fetchModels(apiKey);
                });
            } else {
                // If the API key is invalid, reset storage and show error
                chrome.storage.sync.set({
                    apiKeyValidated: false,
                    encryptedApiKey: null,
                    installationPassword: null
                }, function () {
                    console.log("Invalid API key, resetting storage");
                    updateOptionsVisibility();
                });
                showApiKeyError("invalidApiKey");
                apiKeyInput.classList.add('invalid');
                apiKeyInput.classList.remove('valid');
            }
        });
    } else {
        // If the API key format is invalid, reset storage and show error
        chrome.storage.sync.set({
            apiKeyValidated: false,
            encryptedApiKey: null,
            installationPassword: null
        }, function () {
            console.log("Invalid API key, resetting storage");
            updateOptionsVisibility();
        });
        showApiKeyError("invalidApiKey");
        apiKeyInput.classList.add('invalid');
        apiKeyInput.classList.remove('valid');
    }
}

/**
 * Update user information in the UI.
 * @param {Object} user - The user object containing user information.
 * @param {number} flashcardCount - The number of flashcards created.
 * @param {number} freeGenerationLimit - The limit of free flashcard generations.
 */
function updateUserInfo(user = null, flashcardCount = 0, freeGenerationLimit) {
    const userInfo = document.getElementById('user-info');

    chrome.storage.sync.get(['isOwnCredits', 'freeGenerationLimit', 'userName', 'userEmail'], function (result) {
        const isOwnCreditsMode = result.isOwnCredits;
        const limit = freeGenerationLimit || result.freeGenerationLimit;

        if (user && !isOwnCreditsMode) {
            if (userInfo) {
                // Display user information if a user is logged in and not using own credits
                userInfo.style.display = 'block';
                userInfo.innerHTML = `
                    <h2>${chrome.i18n.getMessage("welcome")} ${escapeHTML(result.userName || user.name)}!</h2>
                    <p>${chrome.i18n.getMessage("loggedInMessage")}</p>
                    <p>Email: ${escapeHTML(result.userEmail || user.email)}</p>
                    <p id="flashcard-counter">${chrome.i18n.getMessage("freeFlashcardsLeft")} <span id="flashcard-count">${limit - flashcardCount}</span></p>
                    <button id="logout-button" class="btn">${chrome.i18n.getMessage("signOut")}</button>
                `;
                document.getElementById('logout-button').addEventListener('click', handleLogout);
            }
        } else {
            // Hide user information if no user is logged in or using own credits
            if (userInfo) userInfo.style.display = 'none';
        }
    });
}

/**
 * Update the login button in the UI.
 * @param {HTMLElement} container - The container element for the login button.
 */
function updateLoginButton(container) {
    if (!container.querySelector('#login-button')) {
        // Create login button if it doesn't exist
        container.innerHTML = `
            <p>${chrome.i18n.getMessage('pleaseSignIn')}</p>
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
                    <span class="gsi-material-button-contents">${chrome.i18n.getMessage('signInWithGoogle')}</span>
                    <span style="display: none;">${chrome.i18n.getMessage('signInWithGoogle')}</span>
                </div>
            </button>
        `;
        document.getElementById('login-button').addEventListener('click', handleLogin);
    }
}

/**
 * Show API key error message.
 * @param {string} message - The error message to display.
 */
function showApiKeyError(message) {
    const apiKeyInput = document.getElementById('apiKey');
    const errorElement = document.getElementById('apiKeyError');
    if (errorElement) {
        errorElement.textContent = chrome.i18n.getMessage(message);
        errorElement.style.display = 'block';
    }
    if (apiKeyInput) {
        apiKeyInput.classList.add('invalid');
        apiKeyInput.classList.remove('valid');
    }
}

/**
 * Hide API key error message.
 */
function hideApiKeyError() {
    const apiKeyInput = document.getElementById('apiKey');
    const errorElement = document.getElementById('apiKeyError');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
    if (apiKeyInput) {
        apiKeyInput.classList.remove('invalid');
    }
}

/**
 * Update the model choice dropdown.
 * @param {string[]} models - Array of available model names.
 */
function updateModelChoice(models) {
    if (!Array.isArray(models)) {
        console.log(chrome.i18n.getMessage("noGptModelsFound"), models);
        return;
    }

    // Filter models to only include GPT models
    const filteredModels = models.filter(model => typeof model === 'string' && model.startsWith('gpt-'));
    if (filteredModels.length === 0) {
        console.warn(chrome.i18n.getMessage("noGptModelsFound"));
        return;
    }
    const modelChoice = document.getElementById('modelChoice');
    if (modelChoice) {
        const currentValue = modelChoice.value;
        // Populate the dropdown with filtered models
        modelChoice.innerHTML = filteredModels.map(model => `<option value="${model}">${model}</option>`).join('');

        // Set the selected model based on stored preference or default to the first available model
        chrome.storage.sync.get(['model'], function (result) {
            if (result.model && filteredModels.includes(result.model)) {
                modelChoice.value = result.model;
            } else if (currentValue && filteredModels.includes(currentValue)) {
                modelChoice.value = currentValue;
            } else if (filteredModels.length > 0) {
                modelChoice.value = filteredModels[0];
                chrome.storage.sync.set({ model: filteredModels[0] });
            }
        });
    }
}

/**
 * Send a request to fetch available models.
 * @param {string} apiKey - The API key to use for fetching models.
 */
function sendFetchModelsRequest(apiKey) {
    chrome.runtime.sendMessage({
        action: "fetchModels",
        apiKey: apiKey
    }, function (response) {
        if (response.error) {
            console.log(chrome.i18n.getMessage("errorFetchingModels"), response.error);
        } else {
            updateModelChoice(response.models);
        }
    });
}

/**
 * Fetch available models based on user settings.
 * @param {string} apiKey - The API key to use for fetching models.
 */
function fetchModels(apiKey) {
    chrome.storage.sync.get(['isOwnCredits'], function (result) {
        if (result.isOwnCredits) {
            if (!apiKey) {
                // If no API key is provided, try to decrypt the stored one
                chrome.storage.sync.get(['encryptedApiKey', 'installationPassword'], async function (result) {
                    if (result.encryptedApiKey && result.installationPassword) {
                        try {
                            const decryptedApiKey = await decryptApiKey(result.encryptedApiKey, result.installationPassword);
                            sendFetchModelsRequest(decryptedApiKey);
                        } catch (error) {
                            console.log('Error decrypting API key:', error);
                        }
                    } else {
                        console.log(chrome.i18n.getMessage("apiKeyMissing"));
                    }
                });
            } else {
                sendFetchModelsRequest(apiKey);
            }
        } else {
            // If not using own credits, fetch models from the extension's API
            fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/models')
                .then(response => response.json())
                .then(data => {
                    if (data.error) {
                        console.log(chrome.i18n.getMessage("errorFetchingModels"), data.error);
                    } else {
                        updateModelChoice(data.result);
                    }
                })
                .catch(error => {
                    console.log(chrome.i18n.getMessage("errorFetchingModels"), error);
                });
        }
    });
}

// Variable to store the current toast notification
let creationToast;

/**
 * Show a toast notification.
 * @param {string} message - The message to display in the toast.
 * @param {boolean} keepOpen - Whether to keep the toast open indefinitely.
 * @param {boolean} ellipsis - Whether to show an ellipsis animation in the toast.
 */
function showToast(message, keepOpen = false, ellipsis = false) {
    let toastContainer = document.querySelector('#toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = chrome.i18n.getMessage(message);

    if (ellipsis) {
        const ellipsisSpan = document.createElement('span');
        ellipsisSpan.className = 'ellipsis';
        toast.appendChild(ellipsisSpan);
    }

    toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);

    if (!keepOpen) {
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toastContainer.removeChild(toast);
            }, 500);
        }, 3000);
    } else {
        creationToast = toast;
    }
}

/**
 * Add event listener for model choice changes.
 */
function addModelChoiceListener() {
    const modelChoice = document.getElementById('modelChoice');
    if (modelChoice) {
        modelChoice.addEventListener('change', function () {
            chrome.storage.sync.set({ model: this.value }, function () {
                console.log('Model choice saved:', this.value);
            });
        });
    }
}

// Event listener for messages from the background script
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === "updateFlashcardCount") {
        updateFlashcardCounter(request.count, request.remainingCards);
    }
});

/**
 * Generate a random installation password.
 * @returns {Promise<string>} A promise that resolves to a random installation password.
 */
async function generateInstallationPassword() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

/**
 * Encrypt the API key.
 * @param {string} apiKey - The API key to encrypt.
 * @param {string} password - The password to use for encryption.
 * @returns {Promise<Object>} A promise that resolves to an object containing the encrypted data.
 */
async function encryptApiKey(apiKey, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const derivedKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
        key,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        derivedKey,
        data
    );
    return {
        salt: Array.from(salt),
        iv: Array.from(iv),
        encrypted: Array.from(new Uint8Array(encrypted))
    };
}

/**
 * Update the flashcard counter in the UI.
 * @param {number} count - The new flashcard count.
 * @param {number} remainingCards - The number of remaining cards.
 */
function updateFlashcardCounter(count, remainingCards) {
    const flashcardCountElement = document.getElementById('flashcard-count');
    if (flashcardCountElement) {
        flashcardCountElement.textContent = remainingCards - count;
    }
}

/**
 * Update the visibility of various UI options based on user settings.
 */
function updateOptionsVisibility() {
    chrome.storage.sync.get(['user', 'apiKeyValidated', 'choice', 'isOwnCredits', 'flashcardCount'], function (result) {
        const modelToggleContainer = document.querySelector('.form-group:has(#modelToggle)');
        const remoteSettings = document.getElementById('remoteSettings');
        const useOwnApiKeyToggle = document.getElementById('useOwnApiKeyToggle');
        const ownCreditsOption = document.getElementById('ownCreditsOption');
        const freeTrialOption = document.getElementById('freeTrialOption');
        const userInfo = document.getElementById('user-info');
        const modelChoiceSection = document.getElementById('modelChoiceSection');
        const localModelMessage = document.getElementById('localModelMessage');

        // Hide model toggle container
        modelToggleContainer.style.display = 'none';

        const isRemoteMode = result.choice === 'remote';
        const isOwnCreditsMode = result.isOwnCredits;

        // Update UI based on remote/local mode
        if (modelToggle) modelToggle.checked = isRemoteMode;
        if (remoteSettings) remoteSettings.style.display = isRemoteMode ? 'block' : 'none';
        if (localModelMessage) localModelMessage.style.display = isRemoteMode ? 'none' : 'block';

        if (!isRemoteMode) {
            // Hide options not relevant for local mode
            if (ownCreditsOption) ownCreditsOption.style.display = 'none';
            if (freeTrialOption) freeTrialOption.style.display = 'none';
            if (userInfo) userInfo.style.display = 'none';
            if (modelChoiceSection) modelChoiceSection.style.display = 'none';
            return;
        }

        // Update UI for remote mode
        if (useOwnApiKeyToggle) useOwnApiKeyToggle.checked = isOwnCreditsMode;
        if (ownCreditsOption) ownCreditsOption.style.display = isOwnCreditsMode ? 'block' : 'none';

        if (isOwnCreditsMode) {
            // Settings for users using their own API key
            if (freeTrialOption) freeTrialOption.style.display = 'none';
            if (userInfo) userInfo.style.display = 'none';
            if (modelChoiceSection) {
                const wasHidden = modelChoiceSection.style.display === 'none';
                modelChoiceSection.style.display = result.apiKeyValidated ? 'block' : 'none';
                if (wasHidden && result.apiKeyValidated) {
                    fetchModels();
                }
            }
        } else {
            // Settings for users not using their own API key
            if (result.user) {
                if (freeTrialOption) freeTrialOption.style.display = 'none';
                if (userInfo) userInfo.style.display = 'block';
                if (modelChoiceSection) modelChoiceSection.style.display = 'none';
            } else {
                if (freeTrialOption) {
                    freeTrialOption.style.display = 'block';
                    updateLoginButton(freeTrialOption);
                }
                if (userInfo) userInfo.style.display = 'none';
                if (modelChoiceSection) modelChoiceSection.style.display = 'none';
            }
        }

        // Update user info display
        updateUserInfo(result.user, result.flashcardCount, result.freeGenerationLimit);
    });
}

/**
 * Initialize the popup by setting up all necessary components and event listeners.
 */
function initializePopup() {
    loadSavedLanguage();
    initializeToggleSwitches();
    addEventListeners();
    updateUserInfo();
    updateOptionsVisibility();
    addModelChoiceListener();
}

// Event listener for when the DOM content is loaded
document.addEventListener('DOMContentLoaded', initializePopup);