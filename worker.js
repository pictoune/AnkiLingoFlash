const USER_DATA = self.USER_DATA;
const OPENAI_API_URL = 'https://api.openai.com/v1';
const FREE_GENERATION_LIMIT = 100; 
const REGENERATION_LIMIT = 5;

console.log("Worker script initialized");

addEventListener('fetch', event => {
    console.log("Fetch event received:", event.request.url);
    event.respondWith(handleRequest(event.request));
});

function handleConnectivityCheckRequest(request) {
    console.log("Processing connectivity check request");
    return new Response(JSON.stringify({ status: 'online' }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

async function handleRequest(request) {
    console.log("Handling request:", request.url);
    if (request.method === 'OPTIONS') {
        console.log("Handling CORS preflight request");
        return handleCORS(request);
    }

    const url = new URL(request.url);

    if (url.pathname === '/api/chat') {
        console.log("Handling chat request");
        return handleChatRequest(request);
    } else if (url.pathname === '/api/models') {
        console.log("Handling models request");
        return handleModelsRequest(request);
    } else if (url.pathname ===  '/api/limits') {
        console.log("Handling limits request");
        return handleLimitsRequest(request);
    } else if (url.pathname.startsWith('/api/user-data')) {
        console.log("Handling user data request");
        return handleUserDataRequest(request);
    } else if (url.pathname === '/api/generate-flashcard') {
        console.log("Handling generate flashcard request");
        return handleGenerateFlashcardRequest(request);
    } else if (url.pathname === '/api/increment-flashcard-count') {
        console.log("Handling increment flashcard count request");
        return handleIncrementFlashcardCountRequest(request);
    } else if (url.pathname === '/oauth-redirect') {
        console.log("Handling OAuth redirect");
        return handleOAuthRedirect(request);
    } else if (url.pathname === '/api/check-connectivity') {
        console.log("Handling connectivity check request");
        return handleConnectivityCheckRequest(request);
    }

    console.log("Request not matched, returning 404");
    return new Response('Not Found', { status: 404 });
}

async function handleOAuthRedirect(request) {
    const url = new URL(request.url);
    const fragmentParams = new URLSearchParams(url.hash.slice(1));
    const token = fragmentParams.get('access_token');

    if (token) {
        return new Response(`
            <html>
                <body>
                    <script>
                        if (window.opener) {
                            window.opener.postMessage({token: "${token}"}, "*");
                        } else {
                            // For Firefox, we need to use browser.runtime.sendMessage
                            browser.runtime.sendMessage({action: "auth_success", token: "${token}"});
                        }
                        window.close();
                    </script>
                </body>
            </html>
        `, {
            headers: {
                'Content-Type': 'text/html',
            },
        });
    } else {
        return new Response('Authentication failed', { status: 400 });
    }
}

async function handleChatRequest(request) {
    console.log("Processing chat request");
    const body = await request.json();
    const API_KEY = OPENAI_API_KEY;

    console.log("Sending request to OpenAI API");
    const openAIResponse = await fetch(`${OPENAI_API_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: body.model,
            messages: body.messages,
            response_format: body.response_format
        })
    });

    const data = await openAIResponse.json();
    console.log("Received response from OpenAI API");

    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

async function handleModelsRequest(request) {
    console.log("Processing models request");
    try {
        const API_KEY = OPENAI_API_KEY;
        
        console.log("Fetching models from OpenAI API");
        const response = await fetch(`${OPENAI_API_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch models from OpenAI');
        }

        const data = await response.json();
        const models = data.data.filter(model => model.id.startsWith('gpt-')).map(model => model.id);

        const result = { result: models, error: null };
        console.log("Models fetched successfully:", models);

        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error("Error fetching models:", error);
        const result = { result: null, error: error.message };

        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
}

function handleLimitsRequest(request) {
    console.log("Processing limits request");
    const limits = {
        freeGenerationLimit: FREE_GENERATION_LIMIT,
        regenerationLimit: REGENERATION_LIMIT
    };

    console.log("Returning limits:", limits);
    return new Response(JSON.stringify(limits), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    }); 
}

async function handleUserDataRequest(request) {
    if (request.method === 'GET') {
        const url = new URL(request.url);
        const userId = url.pathname.split('/').pop();
        if (userId === 'undefined' || !userId) {
            return new Response(JSON.stringify({ error: 'Invalid user ID' }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
        const userData = await USER_DATA.get(userId);
        if (userData) {
            return new Response(userData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } else {
            const newUserData = JSON.stringify({
                userId: userId,
                userName: '',
                userEmail: '',
                flashcardCount: 0,
                freeGenerationLimit: FREE_GENERATION_LIMIT,
                regenerationLimit: REGENERATION_LIMIT
            });
            await USER_DATA.put(userId, newUserData);
            return new Response(newUserData, {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        }
    } else if (request.method === 'POST') {
        const { userId, userName, userEmail } = await request.json();
        let userData = await USER_DATA.get(userId);
        if (userData) {
            userData = JSON.parse(userData);
        } else {
            userData = {
                userId,
                flashcardCount: 0,
                freeGenerationLimit: FREE_GENERATION_LIMIT,
                regenerationLimit: REGENERATION_LIMIT
            };
        }
        userData.userName = userName;
        userData.userEmail = userEmail;
        await USER_DATA.put(userId, JSON.stringify(userData));
        return new Response(JSON.stringify(userData), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    return new Response('Method Not Allowed', { status: 405 });
}

async function handleGenerateFlashcardRequest(request) {
    console.log("Processing generate flashcard request");
    const { userId, isOwnCredits } = await request.json();
    console.log("Request data:", { userId, isOwnCredits });
    const userData = await USER_DATA.get(userId);
    let parsedUserData = userData ? JSON.parse(userData) : { flashcardCount: 0 };
    console.log("User data:", parsedUserData);

    if (!isOwnCredits && parsedUserData.flashcardCount >= parsedUserData.freeGenerationLimit) {
        console.log("User has reached flashcard generation limit");
        return new Response(JSON.stringify({ canGenerate: false, reason: 'LIMIT_REACHED' }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    console.log("User can generate flashcard");
    return new Response(JSON.stringify({ canGenerate: true }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

async function handleIncrementFlashcardCountRequest(request) {
    console.log("Processing increment flashcard count request");
    const { userId } = await request.json();
    console.log("Request data:", { userId });
    const userData = await USER_DATA.get(userId);
    let parsedUserData = userData ? JSON.parse(userData) : { flashcardCount: 0, freeGenerationLimit: FREE_GENERATION_LIMIT };
    console.log("Current user data:", parsedUserData);
    
    parsedUserData.flashcardCount++;
    console.log("Updated flashcard count:", parsedUserData.flashcardCount);
     
    await USER_DATA.put(userId, JSON.stringify(parsedUserData));

    return new Response(JSON.stringify({ 
        success: true, 
        newCount: parsedUserData.flashcardCount,
        remainingCards: parsedUserData.freeGenerationLimit - parsedUserData.flashcardCount
    }), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

function handleCORS(request) {
    console.log("Handling CORS request");
    const headers = request.headers;
    if (
        headers.get('Origin') !== null &&
        headers.get('Access-Control-Request-Method') !== null &&
        headers.get('Access-Control-Request-Headers') !== null
    ) {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400',
            }
        });
    } else {
        return new Response(null, {
            headers: {
                'Allow': 'GET, POST, OPTIONS'
            }
        });
    }
}

console.log("Worker script fully loaded"); 