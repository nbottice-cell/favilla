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
    if (!messages || messages.length < 5) {
      return res.status(400).json({ error: 'Not enough messages for a vibe check' });
    }

    const thread = messages.map(m => `${m.who}: ${m.text}`).join('\n');

    const prompt = `You are a perceptive, grounded reader of conversation dynamics on a dating app. Read the following conversation between ${my_name} and ${match_name} and give ${my_name} a private, honest vibe check.\n\nConversation:\n${thread}\n\nWrite a vibe check for ${my_name} only. Rules:\n- No score, no rating\n- Be observational and specific — reference actual moments or patterns\n- 3-4 sentences for the main read\n- Three short specific "signals" you noticed (each 1 sentence, starting with a verb)\n- Warm but honest tone — like a perceptive friend who's read the thread\n- Start the read with "The conversation..."\n\nReturn ONLY valid JSON, no markdown:\n{"read":"3-4 sentence paragraph","signals":["signal one","signal two","signal three"]}`;

    const aiRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 768,
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
