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

    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { match_id, my_name, match_name } = req.body;

    const { data: match } = await admin.from('matches')
      .select('user_id_1, user_id_2').eq('id', match_id).single();
    if (!match || (match.user_id_1 !== user.id && match.user_id_2 !== user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { data: messages } = await admin.from('messages')
      .select('sender_id, content, created_at')
      .eq('match_id', match_id)
      .order('created_at', { ascending: false })
      .limit(40);

    if (!messages || messages.length < 5) {
      return res.status(400).json({ error: 'Not enough messages for a vibe check' });
    }

    const thread = messages.reverse().map(m => {
      const who = m.sender_id === user.id ? my_name : match_name;
      return `${who}: ${m.content}`;
    }).join('\n');

    const prompt = `You are a perceptive, grounded reader of conversation dynamics on a dating app. Read the following conversation between ${my_name} and ${match_name} and give ${my_name} a private, honest vibe check.\n\nConversation:\n${thread}\n\nWrite a vibe check for ${my_name} only. Rules:\n- No score, no rating\n- Be observational and specific — reference actual moments or patterns from the conversation\n- 3-4 sentences for the main read\n- Three short, specific "signals" you noticed (each 1 sentence, starting with a verb)\n- Warm but honest tone — like a perceptive friend who's read the thread\n- Start the read with "The conversation..."\n\nReturn ONLY valid JSON, no markdown:\n{"read":"3-4 sentence paragraph","signals":["signal one","signal two","signal three"]}`;

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
    const parsed = JSON.parse(aiData.content[0].text);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
