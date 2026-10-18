const express = require("express");
const router = express.Router();

const RAG_API_URL = process.env.RAG_API_URL || "http://127.0.0.1:8000";
const OLLAMA_URL = process.env.OLLAMA_URL || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "gemma4:e2b";

/**
 * Determine if a user's prompt explicitly requests or implies product recommendations.
 * Only returns true if the user asks for suggestions, recommendations, outfits, styling, or specific garments.
 * Returns false for greetings, conversational chit-chat, or general questions about the app.
 */
function shouldSuggestProducts(userPrompt) {
    if (!userPrompt || typeof userPrompt !== "string") return false;
    const text = userPrompt.toLowerCase().trim();

    // 1. Definite greetings and casual chit-chat with NO garment request
    const isPureGreeting = /^(hi|hello|hey|heya|howdy|good\s*(morning|afternoon|evening|night|day)|greetings|sup|yo|hola)[\s!?.~]*$/i.test(text);
    const isChitChat = /^(how\s*are\s*you|who\s*are\s*you|what\s*(is\s*your\s*name|can\s*you\s*do)|what\s*are\s*you|help|thanks|thank\s*you|bye|goodbye|ok|okay|cool|great|nice|awesome|sure|fine|yes|no)[\s!?.~]*$/i.test(text);
    if (isPureGreeting || isChitChat) {
        return false;
    }

    // 2. Direct intent keywords requesting products, recommendations, outfits, styling, or browsing
    const suggestionKeywords = [
        "recommend", "recommendation", "suggest", "suggestion", "show", "find", "search", 
        "buy", "browse", "catalog", "collection", "inventory", "trending", "popular", "best",
        "outfit", "wear", "dress", "suit", "shirt", "pant", "trouser", "t-shirt", "tee",
        "kurta", "sherwani", "blazer", "jacket", "coat", "chinos", "jeans", "skirt",
        "fabric", "linen", "cotton", "silk", "wool", "denim",
        "wedding", "party", "gala", "reception", "formal", "casual", "festive", "traditional",
        "price", "budget", "under", "below", "cost", "cheap", "affordable", "rs", "inr", "₹",
        "options", "what to wear", "what should i wear", "look like"
    ];

    return suggestionKeywords.some((kw) => text.includes(kw));
}

router.post("/chat", async (req, res) => {
    const startTime = performance.now();
    try {
        const { message, max_price, category } = req.body || {};
        const isStream = req.query.stream === "true" || (req.headers.accept && req.headers.accept.includes("text/event-stream"));

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Please enter a message."
            });
        }

        const needsSuggestions = shouldSuggestProducts(message);
        let products = [];
        let ragDurationMs = 0;

        // 1. Only perform RAG product search if suggestions/products are requested
        if (needsSuggestions) {
            const ragStartTime = performance.now();
            try {
                const searchResponse = await fetch(`${RAG_API_URL}/search`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        query: message.trim(),
                        max_price: Number.isFinite(max_price) && max_price > 0 ? max_price : null,
                        category: typeof category === "string" && category.trim() ? category.trim() : null,
                        match_count: 3 // 3 top-k matches is optimal for high speed and relevance
                    }),
                    signal: AbortSignal.timeout(10000)
                });

                if (searchResponse.ok) {
                    const searchData = await searchResponse.json();
                    products = searchData.products || [];
                }
            } catch (err) {
                console.warn("RAG search non-fatal warning:", err.message);
            }
            ragDurationMs = Math.round(performance.now() - ragStartTime);
        }

        // 2. Build lean, context-appropriate prompts for Gemma
        let systemPrompt;
        let userPrompt;

        if (needsSuggestions && products.length > 0) {
            const compactProductContext = products.map((p) => ({
                code: p.product_code,
                name: p.name,
                category: p.category,
                price: `INR ${p.price_inr}`,
                fabric: p.fabric_composition,
                fit: p.fit_type,
                summary: p.description ? p.description.slice(0, 140) : ""
            }));

            systemPrompt = `You are Fit Cloths AI, a personal styling and bespoke tailoring advisor.
Directly speak to the customer with a helpful, friendly, and conversational tone in 2-3 sentences.
Recommend 1 to 2 best matching garments from the store context below, citing their exact name and price.
Never output analysis steps, numbered thought lists, or headings like "Analyze the Request".`;

            userPrompt = `Customer Request: "${message.trim()}"\n\nStore Inventory:\n${JSON.stringify(compactProductContext)}\n\nRecommendation:`;
        } else {
            systemPrompt = `You are Fit Cloths AI, a personal styling and bespoke tailoring advisor.
Directly greet and speak to the customer in a warm, welcoming tone (1-2 sentences).
Ask how you can assist them with custom tailoring, body measurements, or outfit styling today.
Never suggest or invent specific products unless the customer asks for recommendations.
Never output analysis steps, numbered thought lists, or headings like "Analyze the Request".`;

            userPrompt = `Customer: "${message.trim()}"\n\nResponse:`;
        }

        // 3. Query Ollama with keep_alive, think: false, and optimized CPU token options
        const ollamaPayload = {
            model: OLLAMA_MODEL,
            stream: Boolean(isStream),
            think: false, // Disables thinking tokens; guarantees immediate content streaming
            keep_alive: "60m", // Prevent model unloading between requests
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            options: {
                temperature: 0.3,
                num_predict: 250, // Constrain response length to guarantee low latency on CPU
                num_thread: 8     // Utilize all 8 cores of Ryzen 7 7730U
            }
        };

        if (isStream) {
            // Server-Sent Events (SSE) Streaming
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");

            const ollamaStreamRes = await fetch(`${OLLAMA_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ollamaPayload),
                signal: AbortSignal.timeout(60000)
            });

            if (!ollamaStreamRes.ok) {
                res.write(`data: ${JSON.stringify({ type: "error", error: "Ollama stream failed" })}\n\n`);
                return res.end();
            }

            const reader = ollamaStreamRes.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let generatedAnyToken = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop(); // keep remainder

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const parsed = JSON.parse(line);
                        const token = parsed.message?.content || "";
                        if (token) {
                            generatedAnyToken = true;
                            res.write(`data: ${JSON.stringify({ type: "token", text: token })}\n\n`);
                        }
                    } catch {}
                }
            }

            // If model returned no tokens, provide graceful fallback text
            if (!generatedAnyToken) {
                const fallbackText = needsSuggestions && products.length > 0
                    ? "Here are our top recommended bespoke garments tailored to your request:"
                    : "Hello! Welcome to Fit Cloths. How can I assist you with bespoke sizing or styling today?";
                res.write(`data: ${JSON.stringify({ type: "token", text: fallbackText })}\n\n`);
            }

            // Render products together with Gemma's suggestions
            res.write(`data: ${JSON.stringify({ type: "products", products, rag_duration_ms: ragDurationMs })}\n\n`);

            const totalDurationMs = Math.round(performance.now() - startTime);
            res.write(`data: ${JSON.stringify({ type: "done", total_duration_ms: totalDurationMs })}\n\n`);
            return res.end();
        }

        // Non-streaming fallback
        const ollamaResponse = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ollamaPayload),
            signal: AbortSignal.timeout(60000)
        });

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama failed: ${ollamaResponse.status}`);
        }

        const ollamaData = await ollamaResponse.json();
        const ollamaDurationMs = Math.round(performance.now() - ollamaStartTime);
        const totalDurationMs = Math.round(performance.now() - startTime);

        let replyText = ollamaData.message?.content || "";
        if (!replyText.trim() && ollamaData.message?.thinking) {
            // Strip out internal reasoning boilerplate if model output fell into thinking field
            replyText = ollamaData.message.thinking
                .replace(/^Thinking Process:[\s\S]*?\n\n/i, "")
                .replace(/^[\s\S]*?(?=(?:Here (?:are|is)|I recommend|Our|Welcome|Hello|These|For|\d+\.\s+\*\*Final|\*\*Recommendation|\n\n[A-Z]))/i, "")
                .replace(/\*\*Final (?:Response|Recommendation):\*\*/i, "")
                .trim();
        }
        if (!replyText.trim()) {
            replyText = needsSuggestions 
                ? "Here are our best bespoke options matching your style and budget from the collection."
                : "Hello! Welcome to Fit Cloths. How can I assist you with your custom fit, sizing, or styling today?";
        }

        return res.json({
            reply: replyText,
            products,
            model: OLLAMA_MODEL,
            timings: {
                rag_ms: ragDurationMs,
                ollama_ms: ollamaDurationMs,
                total_ms: totalDurationMs
            }
        });

    } catch (error) {
        console.error("Fit Cloths AI error:", error.message);
        return res.status(502).json({
            error: "The AI service is temporarily unavailable. Check that the RAG API and Ollama are running."
        });
    }
});

module.exports = router;
