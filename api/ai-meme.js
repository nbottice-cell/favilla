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

    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { match_name, scenario } = req.body;
    const scenarioLine = scenario
      ? `Use this exact scenario (do not change it): "${scenario}"`
      : `Create a new funny, universally relatable scenario — something like a reaction image would depict. Think: social situations, awkward moments, late-night decisions. Keep it under 12 words.`;

    const prompt = `You are writing captions for a two-player caption game on a dating app called Meme Duel. One player is playing against ${match_name}.\n\n${scenarioLine}\n\nGenerate 6 caption options for one player to choose from. Make them funny in different ways:\n- One dry/deadpan\n- One absurdist\n- One self-aware/meta\n- One that escalates unexpectedly\n- One uncomfortably relatable\n- One that is just chaos\n\nKeep each caption under 15 words. They should feel like things a real person would actually say, not polished jokes.\n\nReturn ONLY valid JSON, no markdown:\n{"scenario":"the scenario text","captions":["caption1","caption2","caption3","caption4","caption5","caption6"]}`;

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
    const parsed = JSON.parse(aiData.content[0].text);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
