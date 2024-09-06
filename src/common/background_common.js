import { CONFIG } from './config.js';

/**
 * Constants for conversation types.
 * These are used to differentiate between different API call purposes.
 */
const CONVERSATION_TYPES = {
    FLASHCARD: 'flashcard',
    DEFINITION: 'definition',
    MNEMONIC: 'mnemonic',
    TRANSLATION: 'translation',
    EXAMPLES: 'examples'
};

/**
 * Check if a tab is valid for message sending
 * @param {Object} tab - The tab object to check
 * @returns {boolean} True if the tab is valid, false otherwise
 */
function isValidTab(tab) {
    return tab && tab.id && tab.id !== chrome.tabs.TAB_ID_NONE;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} unsafeText - The text to be escaped
 * @returns {string} The escaped text
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
 * Decrypt an API key
 * @param {Object} encryptedData - The encrypted API key data
 * @param {string} password - The password used for decryption
 * @returns {Promise<string>} The decrypted API key
 */
async function decryptApiKey(encryptedData, password) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        { name: "PBKDF2" },
        false,
        ["deriveBits", "deriveKey"]
    );
    const derivedKey = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: new Uint8Array(encryptedData.salt), iterations: 100000, hash: "SHA-256" },
        key,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(encryptedData.iv) },
        derivedKey,
        new Uint8Array(encryptedData.encrypted)
    );
    return new TextDecoder().decode(decrypted);
}

/**
 * Show a toast notification in the active tab
 * @param {string} message - The message to display
 * @param {boolean} keepOpen - Whether to keep the toast open
 * @param {boolean} ellipsis - Whether to show an ellipsis animation
 */
function showToast(message, keepOpen = false, ellipsis = false) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (tabs.length > 0 && isValidTab(tabs[0])) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: "showToast",
                message: message,
                keepOpen: keepOpen,
                ellipsis: ellipsis
            }, function (response) {
                if (chrome.runtime.lastError) {
                    console.log("Error showing toast:", chrome.runtime.lastError.message);
                }
            });
        } else {
            console.log("No valid tab found to show toast");
        }
    });
}

/**
 * Invoke an AnkiConnect action
 * @param {string} action - The action to invoke
 * @param {number} version - The API version
 * @param {Object} params - The parameters for the action
 * @returns {Promise} A promise that resolves with the result of the action
 */
function invoke(action, version, params = {}) {
    return fetch('http://127.0.0.1:8765', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, version, params })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(chrome.i18n.getMessage("networkResponseError"));
            }
            return response.json();
        })
        .then(response => {
            // Validate the response structure
            if (Object.keys(response).length !== 2) {
                throw new Error(chrome.i18n.getMessage("unexpectedFieldsError"));
            }
            if (!('error' in response)) {
                throw new Error(chrome.i18n.getMessage("missingErrorField"));
            }
            if (!('result' in response)) {
                throw new Error(chrome.i18n.getMessage("missingResultField"));
            }
            if (response.error) {
                throw new Error(response.error);
            }
            return response.result;
        })
        .catch(error => {
            console.log('Error in invoke function:', error);
            if (error.message === 'Failed to fetch' || error.message === 'Network response was not ok') {
                throw new Error(chrome.i18n.getMessage("ankiConnectionFailed"));
            } else {
                throw error;
            }
        });
}

/**
 * Create a custom Anki model for a specific language
 * @param {string} modelName - The name of the model to create
 * @returns {Promise} A promise that resolves when the model is created
 */
function createCustomModelForLanguage(modelName) {
    return invoke('modelNames', 6)
        .then(models => {
            if (!models.includes(modelName)) {
                return invoke('createModel', 6, {
                    modelName: modelName,
                    inOrderFields: ["Translation", "Definition", "Selection", "Example_1", "Example_2", "Example_3", "Mnemonic", "Add Reverse"],
                    cardTemplates: [
                        {
                            Name: "Card 1",
                            Front: `
                                <div style='font-family: "Arial"; font-size: 20px; text-align: center;'>
                                    <b>${chrome.i18n.getMessage('directTranslation')}</b><br>{{Translation}}
                                    <br><br><b>${chrome.i18n.getMessage('Definition')}</b><br>{{Definition}}
                                </div>`,
                            Back: `
                                {{FrontSide}}
                                <hr id="answer">
                                <div style='font-family: "Arial"; font-size: 20px; text-align: center;'>
                                    {{Selection}}
                                </div>
                                ${chrome.i18n.getMessage('moveLineHere')}
                                <br><br>
                                <i>1. {{Example_1}}</i><br>
                                <i>2. {{Example_2}}</i><br>
                                <i>3. {{Example_3}}</i>
                                {{#Mnemonic}}
                                <br><br>
                                <div style='font-family: "Arial"; font-size: 18px;'>
                                    <b>${chrome.i18n.getMessage('Mnemonic')}</b><br>{{Mnemonic}}
                                </div>
                                {{/Mnemonic}}`
                        },
                        {
                            Name: "Card 2 (Reverse)",
                            Front: `
                                {{#Add Reverse}}
                                    {{Selection}}
                                    ${chrome.i18n.getMessage('moveLineHere')}
                                    <br><br>
                                    <i>1. {{Example_1}}</i><br>
                                    <i>2. {{Example_2}}</i><br>
                                    <i>3. {{Example_3}}</i>
                                    {{#Mnemonic}}
                                    <br><br>
                                    <div style='font-family: "Arial"; font-size: 18px;'>
                                        <b>${chrome.i18n.getMessage('Mnemonic')}</b><br>{{Mnemonic}}
                                    </div>
                                    {{/Mnemonic}}
                                {{/Add Reverse}}`,
                            Back: `
                                {{#Add Reverse}}
                                <div style='font-family: "Arial"; font-size: 20px; text-align: center;'>
                                    <b>${chrome.i18n.getMessage('directTranslation')}</b><br>{{Translation}}
                                    <br><br><b>${chrome.i18n.getMessage('Definition')}</b><br>{{Definition}}
                                </div>
                                {{/Add Reverse}}`
                        }
                    ]
                });
            } else {
                console.log(`Model ${modelName} already exists.`);
                return Promise.resolve();
            }
        });
}

/**
 * Check and create Anki models for all supported languages
 */
function checkAndCreateModel() {
    const languages = [
        'english_us', 'english_uk', 'english_au', 'english_ca',
        'spanish_es', 'spanish_latam',
        'french_fr', 'french_ca',
        'german_de', 'german_ch',
        'italian_it', 'italian_ch',
        'dutch_nl', 'dutch_be',
        'portuguese_pt', 'portuguese_br',
        'russian', 'mandarin_simplified', 'mandarin_traditional', 'cantonese',
        'japanese', 'arabic', 'arabic_eg', 'korean', 'hindi'
    ];

    const createModels = languages.map(lang => {
        const modelName = `AnkiLingoFlash_${chrome.i18n.getMessage(lang)}`;
        return createCustomModelForLanguage(modelName);
    });

    Promise.all(createModels)
        .then(() => {
            console.log("All models checked/created.");
        })
        .catch(error => {
            console.log("Error checking/creating models:", error);
            if (error.message.includes('AnkiConnect not available')) {
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    if (tabs.length > 0) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            action: "showAnkiNotOpenModal",
                            message: chrome.i18n.getMessage("ankiConnectionFailed"),
                            flashcard: flashcardData
                        }, function (response) {
                            if (chrome.runtime.lastError) {
                                console.log("Error sending message:", chrome.runtime.lastError.message);
                            } else {
                                console.log("Message successfully sent to content script");
                            }
                        });
                    } else {
                        console.log("No active tab available to send the message.");
                    }
                });
            } else {
                console.log("Unexpected error:", error);
            }
        });
}

/**
 * Generate a unique ID
 * @returns {string} A unique ID
 */
function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Inject content scripts into a tab
 * @param {number} tabId - The ID of the tab to inject scripts into
 */
async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['franc/data.js', 'franc/expressions.js', 'franc/index.js', 'content.js']
        });
        console.log('Content script injected successfully in tab:', tabId);
        chrome.tabs.sendMessage(tabId, { action: "initialize" });
    } catch (err) {
        console.log('Failed to inject content script:', err);
    }
}

/**
 * Fetch or initialize user data
 * @param {string} userId - The user's ID
 * @param {string} userName - The user's name
 * @param {string} userEmail - The user's email
 * @returns {Promise<Object>} A promise that resolves with the user data
 */
async function fetchOrInitializeUserData(userId = null, userName = null, userEmail = null) {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['userId', 'userName', 'userEmail', 'flashcardCount', 'freeGenerationLimit', 'regenerationLimit'], async function (result) {
            const existingOrNewUserId = userId || result.userId || generateUniqueId();
            try {
                const response = await fetch(`https://anki-lingo-flash.piriouvictor.workers.dev/api/user-data/${existingOrNewUserId}`);
                if (response.ok) {
                    const userData = await response.json();
                    chrome.storage.sync.set({
                        userId: existingOrNewUserId,
                        userName: userName || result.userName || userData.userName,
                        userEmail: userEmail || result.userEmail || userData.userEmail,
                        flashcardCount: userData.flashcardCount,
                        freeGenerationLimit: userData.freeGenerationLimit,
                        regenerationLimit: userData.regenerationLimit
                    }, () => {
                        resolve(userData);
                    });
                } else {
                    throw new Error('User data not found');
                }
            } catch (error) {
                console.log('Error fetching user data:', error);
                const limits = await fetchLimitsFromWorker();
                const newUserData = {
                    userId: existingOrNewUserId,
                    userName: userName || result.userName,
                    userEmail: userEmail || result.userEmail,
                    flashcardCount: result.flashcardCount || 0,
                    freeGenerationLimit: limits.freeGenerationLimit,
                    regenerationLimit: limits.regenerationLimit
                };
                chrome.storage.sync.set(newUserData, () => {
                    resolve(newUserData);
                });
            }
        });
    });
}

// Create an alarm to keep the service worker alive
chrome.alarms.create("keepAlive", { periodInMinutes: 1 });

// Listen for the alarm and log a message
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
        console.log("Keeping service worker alive");
    }
});

/**
 * Fetch generation limits from the worker
 * @returns {Promise<Object>} A promise that resolves with the limits
 */
async function fetchLimitsFromWorker() {
    try {
        const response = await fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/limits');
        if (!response.ok) {
            throw new Error('Failed to fetch limits from worker');
        }
        return await response.json();
    } catch (error) {
        console.log('Error fetching limits:', error);
        return { freeGenerationLimit: 5, regenerationLimit: 3 };
    }
}

// Listen for extension installation or update
chrome.runtime.onInstalled.addListener(async (details) => {
    // Set default settings
    chrome.storage.sync.set({
        choice: 'remote',
        model: CONFIG.DEFAULT_REMOTE_MODEL,
        isOwnCredits: false,
        apiKeyValidated: false,
    }, () => {
        console.log(chrome.i18n.getMessage("defaultSettingsSet"));
    });

    // Create context menu item
    chrome.contextMenus.create({
        id: "selectText",
        title: chrome.i18n.getMessage("generateFlashcard"),
        contexts: ["selection"]
    });

    // Inject content script into existing tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
        if (tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https') || tab.url.endsWith('.pdf'))) {
            await injectContentScript(tab.id);
        }
    }

    // Open tutorial page on first install
    if (details.reason === 'install') {
        chrome.tabs.create({ url: 'https://ankilingoflash.com/quick-tutorial.html' });
    }
});

// Track tab readiness
let tabReady = {};

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https') || tab.url.endsWith('.pdf'))) {
        tabReady[tabId] = true;
        injectContentScript(tabId);
    }
});

// Listen for context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "selectText") {
        console.log("Context menu clicked, injecting content script...");
        await injectContentScript(tab.id);
        console.log("Content script injected, sending message...");
        chrome.storage.sync.get(['language'], function (result) {
            // Utiliser chrome.tabs.query pour obtenir l'onglet actif
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                //console.error("TAB ID: " + tabs[0].id);
                if (tabs.length > 0) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: "generateFlashcard",
                        text: info.selectionText,
                        language: result.language || 'en'
                    })
                    .then(response => {
                        console.log(`Message sent successfully with response:`, response);
                    })
                    .catch(error => {
                        console.log(`Error sending message:`, error);
                        showToast(chrome.i18n.getMessage("flashcardGenerationError"));
                    });
                } else {
                    console.log("No active tab found");
                    showToast(chrome.i18n.getMessage("noActiveTabError"));
                }
            });
        });
    }
});

/**
 * Get or create a conversation for a user and type
 * @param {string} userId - The user's ID
 * @param {string} type - The conversation type
 * @returns {Promise<Object>} A promise that resolves with the conversation object
 */
async function getOrCreateConversation(userId, type) {
    const key = `conversation_${userId}_${type}`;
    const result = await chrome.storage.sync.get(key);
    const systemPrompt = getSystemPrompt(type);

    if (result[key]) {
        // Update the system message if the conversation already exists
        result[key].messages[0] = { role: 'system', content: systemPrompt };
        return result[key];
    }

    const newConversation = {
        messages: [{ role: 'system', content: systemPrompt }]
    };

    await chrome.storage.sync.set({ [key]: newConversation });
    return newConversation;
}

/**
 * Get the system prompt for a given conversation type
 * @param {string} type - The conversation type
 * @returns {string} The system prompt
 */
function getSystemPrompt(type) {
    console.log('Getting system prompt for type:', type);
    switch (type) {
        case CONVERSATION_TYPES.FLASHCARD:
            return chrome.i18n.getMessage("generateFlashcardInstructions");
        case CONVERSATION_TYPES.DEFINITION:
            return chrome.i18n.getMessage("helpfulAssistantDefinition");
        case CONVERSATION_TYPES.MNEMONIC:
            return chrome.i18n.getMessage("creativeAssistantMnemonic");
        case CONVERSATION_TYPES.TRANSLATION:
            return chrome.i18n.getMessage("translationAssistant");
        case CONVERSATION_TYPES.EXAMPLES:
            return chrome.i18n.getMessage("examplesAssistant");
        default:
            console.log(`Unknown conversation type: ${type}`);
            return chrome.i18n.getMessage("generateFlashcardInstructions");
    }
}

/**
 * Call the ChatGPT API
 * @param {string} userId - The user's ID
 * @param {string} type - The conversation type
 * @param {string} userMessage - The user's message
 * @param {string} language - The target language
 * @param {string} apiKey - The API key (optional)
 * @returns {Promise<Object>} A promise that resolves with the API response
 */
async function callChatGPTAPI(userId, type, userMessage, language, apiKey = null) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['isOwnCredits', 'encryptedApiKey', 'installationPassword', 'apiKeyValidated'], async function (result) {
            if (result.isOwnCredits && !result.apiKeyValidated) {
                reject(new Error(chrome.i18n.getMessage("enterValidApiKey")));
                return;
            }

            let apiKeyToUse = apiKey;

            if (result.isOwnCredits && !apiKeyToUse) {
                if (result.encryptedApiKey && result.installationPassword) {
                    try {
                        apiKeyToUse = await decryptApiKey(result.encryptedApiKey, result.installationPassword);
                    } catch (error) {
                        console.log('Error decrypting API key:', error);
                        reject(new Error(chrome.i18n.getMessage("failedToDecryptApiKey")));
                        return;
                    }
                } else {
                    reject(new Error(chrome.i18n.getMessage("apiKeyMissingOrNotEncrypted")));
                    return;
                }
            }

            if (!apiKeyToUse && result.isOwnCredits) {
                reject(new Error(chrome.i18n.getMessage("apiKeyMissing")));
                return;
            }

            if (!Object.values(CONVERSATION_TYPES).includes(type)) {
                reject(new Error(`Invalid conversation type: ${type}`));
                return;
            }

            try {
                const conversation = await getOrCreateConversation(userId, type, language);
                conversation.messages.push({ role: 'user', content: userMessage });

                const url = result.isOwnCredits
                    ? 'https://api.openai.com/v1/chat/completions'
                    : 'https://anki-lingo-flash.piriouvictor.workers.dev/api/chat';

                const headers = {
                    'Content-Type': 'application/json',
                    ...(result.isOwnCredits && { 'Authorization': `Bearer ${apiKeyToUse}` })
                };

                let responseFormat;
                if (type === CONVERSATION_TYPES.FLASHCARD) {
                    // Vérifier si le message contient une demande de mnémonique
                    const includeMnemonic = userMessage.includes("mnemonic");

                    responseFormat = {
                        type: "json_schema",
                        json_schema: {
                            name: "flashcard_response",
                            schema: {
                                type: "object",
                                properties: {
                                    definition: {
                                        type: "string",
                                        description: `A clear and concise definition of the term or concept in ${language}`
                                    },
                                    translation: {
                                        type: "string",
                                        description: `A direct translation of the term, in ${language}.`
                                    },
                                    example_1: {
                                        type: "string",
                                        description: `First example sentence using the term or expression in the same language as the given term`
                                    },
                                    example_2: {
                                        type: "string",
                                        description: `Second example sentence using the term or expression in the same language as the given term`
                                    },
                                    example_3: {
                                        type: "string",
                                        description: `Third example sentence using the term or expression in the same language as the given term`
                                    },
                                    ...(includeMnemonic ? {
                                        mnemonic: {
                                            type: "string",
                                            description: `A memory aid to help remember the definition in ${language}`
                                        }
                                    } : {})
                                },
                                required: ["definition", "translation", "example_1", "example_2", "example_3"],
                                ...(includeMnemonic ? { required: ["definition", "translation", "example_1", "example_2", "example_3", "mnemonic"] } : {}),
                                additionalProperties: false
                            },
                            strict: true
                        }
                    };
                } else if (type === CONVERSATION_TYPES.EXAMPLES) {
                    responseFormat = {
                        type: "json_schema",
                        json_schema: {
                            name: "examples_response",
                            schema: {
                                type: "object",
                                properties: {
                                    example_1: {
                                        type: "string",
                                        description: `First example sentence using the term in the same language as the given term`
                                    },
                                    example_2: {
                                        type: "string",
                                        description: `Second example sentence using the term in the same language as the given term`
                                    },
                                    example_3: {
                                        type: "string",
                                        description: `Third example sentence using the term in the same language as the given term`
                                    }
                                },
                                required: ["example_1", "example_2", "example_3"],
                                additionalProperties: false
                            },
                            strict: true
                        }
                    };
                } else {
                    responseFormat = {
                        type: "json_schema",
                        json_schema: {
                            name: "component_response",
                            schema: {
                                type: "object",
                                properties: {
                                    [type]: {
                                        type: "string",
                                        description: `The ${type} for the term or expression in ${language}`
                                    }
                                },
                                required: [type],
                                additionalProperties: false
                            },
                            strict: true
                        }
                    };
                }

                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        model: CONFIG.DEFAULT_REMOTE_MODEL,
                        messages: conversation.messages,
                        response_format: responseFormat
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                console.log("Full API response:", data);

                if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                    throw new Error("Invalid API response: missing or empty choices array");
                }

                const assistantMessage = data.choices[0].message;
                if (!assistantMessage || !assistantMessage.content) {
                    throw new Error("Invalid API response: missing message content");
                }

                conversation.messages.push(assistantMessage);
                conversation.messages = [conversation.messages[0], ...conversation.messages.slice(-2)];
                await chrome.storage.sync.set({ [`conversation_${userId}_${type}`]: conversation });

                let parsedContent;
                try {
                    parsedContent = JSON.parse(assistantMessage.content);
                } catch (error) {
                    console.log('Error parsing API response content:', error);
                    throw new Error('Invalid JSON in API response content');
                }

                resolve(parsedContent);
            } catch (error) {
                console.log('Error calling ChatGPT API:', error);
                reject(error);
            }
        });
    });
}

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle various message actions
    if (request.action === "openTab") {
        chrome.tabs.create({ url: request.url });
    } else if (request.action === "getFreeGenerationLimit") {
        chrome.storage.sync.get(['freeGenerationLimit'], function (result) {
            sendResponse({ freeGenerationLimit: result.freeGenerationLimit });
        });
        return true;  // Will respond asynchronously
    }
    else if (request.action === "validateApiKey") {
        const apiKey = request.apiKey;

        if (!apiKey) {
            sendResponse({ valid: false, error: "Invalid API key format" });
            return true;
        }

        fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                sendResponse({ valid: true });
            })
            .catch(error => {
                console.log('Error validating API key:', error);
                sendResponse({ valid: false, error: error.message });
            });

        return true;
    }
    else if (request.action === "incrementFlashcardCount") {
        chrome.storage.sync.get(['userId', 'flashcardCount', 'freeGenerationLimit'], (result) => {
            fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/increment-flashcard-count', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: result.userId }),
            })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        const newCount = data.newCount;
                        const remainingCards = result.freeGenerationLimit - newCount;
                        chrome.storage.sync.set({ flashcardCount: newCount }, () => {
                            sendResponse({ success: true, newCount: newCount, remainingCards: remainingCards });
                        });
                    } else {
                        sendResponse({ success: false, error: "Failed to increment flashcard count" });
                    }
                })
                .catch(error => {
                    console.log('Error incrementing flashcard count:', error);
                    sendResponse({ success: false, error: error.message });
                });
        });
        return true; // Indicates that the response will be sent asynchronously
    } else if (request.action === "callChatGPTAPI") {
        callChatGPTAPI(request.userId, request.type, request.message, request.language, request.apiKey)
            .then(data => {
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                console.log('Error calling ChatGPT API:', error);
                sendResponse({ success: false, error: error.message });
            });
        return true;
    } else if (request.action === "getApiKey") {
        chrome.storage.sync.get(['encryptedApiKey', 'installationPassword'], async (result) => {
            if (result.encryptedApiKey && result.installationPassword) {
                try {
                    const apiKey = await decryptApiKey(result.encryptedApiKey, result.installationPassword);
                    sendResponse({ apiKey: apiKey });
                } catch (error) {
                    console.log('Error decrypting API key:', error);
                    sendResponse({ error: 'Failed to decrypt API key' });
                }
            } else {
                sendResponse({ error: 'API key not found' });
            }
        });
        return true;
    } else if (request.action === "retryCreateModel") {
        checkAndCreateModel();
    } else if (request.action === "getModels") {
        fetch('https://anki-lingo-flash.piriouvictor.workers.dev/api/models')
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                sendResponse({ models: data.result });
            })
            .catch(error => {
                console.log('Error fetching models:', error);
                sendResponse({ error: error.message });
            });
        return true;
    } else if (request.action === "fetchModels") {
        fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${request.apiKey}`
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                const models = data.data.map(model => model.id);
                sendResponse({ models: models });
            })
            .catch(error => {
                console.log('Error fetching models:', error);
                sendResponse({ error: error.message });
            });
        return true;
    } else if (request.action === "invokeAnkiConnect") {
        fetch('http://127.0.0.1:8765', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(request.params)
        })
            .then(response => response.json())
            .then(data => sendResponse({ success: true, data: data }))
            .catch(error => sendResponse({ success: false, error: error.toString() }));
        return true;  // Will respond asynchronously
    }
});

/**
 * Handle user logout
 */
function handleLogout() {
    chrome.runtime.sendMessage({ action: "logout" }, function (response) {
        if (response && response.success) {
            chrome.storage.sync.get(['userId', 'flashcardCount', 'freeGenerationLimit', 'regenerationLimit'], function (result) {
                const updatedData = {
                    userId: result.userId,
                    user: null,
                    flashcardCount: result.flashcardCount,
                    freeGenerationLimit: result.freeGenerationLimit,
                    regenerationLimit: result.regenerationLimit
                };
                chrome.storage.sync.set(updatedData, function () {
                    updateUserInfo(null, 0);
                    updateOptionsVisibility();
                });
            });
        } else {
            console.log("Logout error");
            showToast("Logout failed. Please try again.");
        }
    });
}