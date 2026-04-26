const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw.trim());
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, my_name, match_name } = req.body;
    if (!messages || messages.length === 0) return res.status(200).json({ openers: [] });

    const thread = messages.map(m => `${m.who}: ${m.text}`).join('\n');
    const hoursAgo = Math.round((Date.now() - new Date(messages[messages.length - 1].time).getTime()) / 3600000);

    const prompt = `Here is the recent conversation between ${my_name} and ${match_name} on a dating app:\n\n${thread}\n\nThe conversation has been quiet for about ${hoursAgo} hours. Generate exactly 3 re-opener messages for ${my_name} to send. Requirements:\n- Reference something specific from the conversation — no generic openers\n- Natural, warm, not pushy\n- 1–2 sentences max\n- Vary the tone: one warm/curious, one playful, one light/low-pressure\n- Do NOT start with "Hey"\n\nReturn ONLY valid JSON, no markdown:\n{"openers":["message one","message two","message three"]}`;

    const aiRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const aiData = await aiRes.json();
    const parsed = extractJSON(aiData.content[0].text);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
