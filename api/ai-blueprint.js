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
    const { vibe, budget, time_of_day, constraints, match_name } = req.body;
    const constraintsLine = constraints ? `\n- Important constraints: ${constraints}` : '';

    const prompt = `You are a creative date planner. Create a vivid, specific 3-stop date itinerary.\n\nParameters:\n- Vibe: ${vibe}\n- Budget: ${budget}\n- Time of day: ${time_of_day}\n- Planning for: someone going on a date with ${match_name}${constraintsLine}\n\nCreate a narrative plan. Each stop should feel like a real place that could exist in any city. Be specific but not tied to a real address. Write as if you're a friend who knows this city well.\n\nReturn ONLY valid JSON, no markdown:\n{"title":"a short poetic name for this date (5 words max)","narrative":"one sentence setting the scene and tone","stops":[{"emoji":"🍸","name":"venue name","why":"why this place works (1 sentence)","convo_starter":"a specific question to spark conversation"},{"emoji":"🎶","name":"second venue","why":"why this is the right next move","convo_starter":"a conversation prompt for this stop"},{"emoji":"🌙","name":"third venue","why":"why this is perfect if things are going well","convo_starter":"something to say here"}]}`;

    const aiRes = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
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
