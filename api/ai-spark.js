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

    // Verify user via Supabase
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Admin client to fetch messages
    const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { match_id, my_name, match_name } = req.body;

    // Verify user owns this match
    const { data: match } = await admin.from('matches')
      .select('user_id_1, user_id_2').eq('id', match_id).single();
    if (!match || (match.user_id_1 !== user.id && match.user_id_2 !== user.id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Fetch last 10 text messages
    const { data: messages } = await admin.from('messages')
      .select('sender_id, content, created_at')
      .eq('match_id', match_id)
      .in('message_type', ['text', null])
      .order('created_at', { ascending: false })
      .limit(10);

    if (!messages || messages.length === 0) {
      return res.status(200).json({ openers: [] });
    }

    const thread = messages.reverse().map(m => {
      const who = m.sender_id === user.id ? my_name : match_name;
      return `${who}: ${m.content}`;
    }).join('\n');

    const hoursAgo = Math.round(
      (Date.now() - new Date(messages[messages.length - 1].created_at).getTime()) / 3600000
    );

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
    const parsed = JSON.parse(aiData.content[0].text);
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
}
