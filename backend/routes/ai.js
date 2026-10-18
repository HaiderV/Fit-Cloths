
const express = require("express");

const router = express.Router();

const RAG_API_URL =
    process.env.RAG_API_URL || "http://127.0.0.1:8000";

const OLLAMA_URL =
    process.env.OLLAMA_URL || "http://127.0.0.1:11434";

const OLLAMA_MODEL =
    process.env.OLLAMA_MODEL || "gemma4:e2b";

router.post("/chat", async (req, res) => {
    try {
        const { message, max_price, category } = req.body || {};

        if (typeof message !== "string" || !message.trim()) {
            return res.status(400).json({
                error: "Please enter a message."
            });
        }

        // 1. Retrieve relevant products from Supabase via Python.
        const searchResponse = await fetch(
            `${RAG_API_URL}/search`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    query: message.trim(),
                    max_price:
                        Number.isFinite(max_price) && max_price > 0
                            ? max_price
                            : null,
                    category:
                        typeof category === "string" && category.trim()
                            ? category.trim()
                            : null,
                    match_count: 5
                }),
                signal: AbortSignal.timeout(30000)
            }
        );

        if (!searchResponse.ok) {
            throw new Error(
                `Product retrieval failed: ${searchResponse.status}`
            );
        }

        const searchData = await searchResponse.json();
        const products = searchData.products || [];

        // 2. Build grounded context for Gemma.
        const productContext = products.map((p) => ({
            product_code: p.product_code,
            name: p.name,
            category: p.category,
            target_audience: p.target_audience,
            description: p.description,
            colors: p.colors,
            fabric: p.fabric_composition,
            fit: p.fit_type,
            occasions: p.occasion,
            style_tags: p.style_tags,
            price_inr: p.price_inr,
            image_urls: p.image_urls,
            customization_options: p.customization_options,
            tailoring_details: p.tailoring_details
        }));

        const systemPrompt = `
You are Fit Cloths AI, a friendly fashion and custom-tailoring
assistant for an e-commerce store.

Rules:
- Use the supplied product context for store-specific claims.
- Never invent product names, prices, stock status, discounts,
  fabrics, customization options, or image links.
- Recommend only products present in the supplied context.
- If no relevant products were retrieved, say so honestly.
  You may still offer general fashion advice, clearly separated
  from verified store information.
- Explain briefly why each recommendation fits the request.
- Respect the customer's stated budget and preferences.
- This store focuses on custom tailoring, not standard clothing sizes.
- Be conversational, concise, and helpful.
`;

        // 3. Ask local Gemma to answer using retrieved product data.
        const ollamaResponse = await fetch(
            `${OLLAMA_URL}/api/chat`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: OLLAMA_MODEL,
                    stream: false,
                    messages: [
                        { role: "system", content: systemPrompt },
                        {
                            role: "user",
                            content:
                                `Customer message:\n${message.trim()}\n\n` +
                                `Retrieved store products (JSON):\n` +
                                `${JSON.stringify(productContext)}\n\n` +
                                `Answer the customer using this information.`
                        }
                    ],
                    options: {
                        temperature: 0.3
                    }
                }),
                signal: AbortSignal.timeout(180000)
            }
        );

        if (!ollamaResponse.ok) {
            throw new Error(`Ollama failed: ${ollamaResponse.status}`);
        }

        const ollamaData = await ollamaResponse.json();

        return res.json({
            reply: ollamaData.message?.content ||
                "Sorry, I couldn't generate a response.",
            products,
            model: OLLAMA_MODEL
        });

    } catch (error) {
        console.error("Fit Cloths AI error:", error.message);

        return res.status(502).json({
            error:
                "The AI service is temporarily unavailable. Check that the RAG API and Ollama are running."
        });
    }
});

module.exports = router;
