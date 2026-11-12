// api/groq.js  -  Vercel serverless function (hides GROQ_API_KEY)
module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Use POST' });
        return;
    }
    if (!process.env.GROQ_API_KEY) {
        res.status(500).json({ error: 'missing_key' });
        return;
    }

    const body = req.body || {};
    const messages = (Array.isArray(body.messages) ? body.messages : [])
        .slice(-20)
        .map(m => ({ role: String(m.role), content: String(m.content).slice(0, 6000) }));

    const payload = {
        model: process.env.MODEL || 'llama-3.3-70b-versatile',
        messages,
        temperature: Math.min(1, Number(body.temperature) || 0.6),
        max_tokens: Math.min(1000, Number(body.max_tokens) || 700),
        stream: true
    };

    let upstream;
    try {
        upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.GROQ_API_KEY
            },
            body: JSON.stringify(payload)
        });
    } catch (e) {
        res.status(502).json({ error: 'groq_unreachable' });
        return;
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');

    const reader = upstream.body.getReader();
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
        }
    } finally {
        res.end();
    }
};