import { createClient } from '@supabase/supabase-js';

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });

    const sb = createClient('https://aoquyilyrvsefhfrnukb.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvcXV5aWx5cnZzZWZoZnJudWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyMDY0NTYsImV4cCI6MjA4OTc4MjQ1Nn0.xn7zoQeic5mW-S0DnHQZxe6UcmoJ3r1QRiw30-dpMIw', {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { vibe, budget, time_of_day, constraints, match_name } = req.body;
    const constraintsLine = constraints ? `\n- Important constraints: ${constraints}` : '';

    const prompt = `You are a creative date planner. Create a vivid, specific 3-stop date itinerary.\n\nParameters:\n- Vibe: ${vibe}\n- Budget: ${budget}\n- Time of day: ${time_of_day}\n- Planning for: someone going on a date with ${match_name}${constraintsLine}\n\nCreate a narrative plan. Each stop should feel like a real place that could exist in any city. Be specific but not tied to a real address. Write as if you're a friend who knows this city well.\n\nReturn ONLY valid JSON, no markdown:\n{\n  "title": "a short poetic name for this date (5 words max)",\n  "narrative": "one sentence setting the scene and tone for the whole evening",\n  "stops": [\n    {"emoji":"🍸","name":"venue name","why":"why this place works for this date (1 sentence)","convo_starter":"a specific question or observation to spark conversation here"},\n    {"emoji":"🎶","name":"second venue name","why":"why this is the right next move","convo_starter":"a conversation prompt for this stop"},\n    {"emoji":"🌙","name":"third venue name","why":"why this is perfect if things are going well","convo_starter":"something to say here"}\n  ]\n}`;

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
    const parsed = JSON.parse(aiData.content[0].text);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
