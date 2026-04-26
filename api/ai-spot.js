const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

function extractJSON(text) {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw.trim());
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, my_name, match_name, venues, vibe } = req.body;

    const venueList = venues.map(v =>
      `- ${v.name} (${v.tags.join(', ')}) — ${v.distance} away`
    ).join('\n');

    let contextBlock;
    if (messages && messages.length >= 3) {
      const thread = messages.slice(-20).map(m => `${m.who}: ${m.text}`).join('\n');
      contextBlock = `Here is the recent conversation between ${my_name} and ${match_name}:\n\n${thread}\n\nRead this conversation carefully. Pick up on their energy, what they seem to value, and any hints about what kind of place would suit them.`;
    } else {
      contextBlock = `${my_name} and ${match_name} just matched on a dating app. They want a "${vibe || 'low-key'}" vibe for their first meetup. No conversation history yet.`;
    }

    const prompt = `${contextBlock}

Available venues:
${venueList}

Based on everything above, recommend the single best venue for their first meetup, then list 2 alternatives. For each, write a reason that feels specific — reference something from the conversation if available, otherwise reference the vibe. The top recommendation should also include a one-sentence "insight" that explains what you picked up that drove the recommendation (e.g. "You both seem like people who actually want to hear each other.").

Return ONLY valid JSON, no markdown:
{
  "insight": "one sentence about what you picked up from them — conversational, like a friend who read the thread",
  "top": {"name": "venue name exactly as listed", "reason": "specific reason referencing the conversation or vibe"},
  "alternatives": [
    {"name": "venue name exactly as listed", "reason": "short reason"},
    {"name": "venue name exactly as listed", "reason": "short reason"}
  ]
}`;

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
};
