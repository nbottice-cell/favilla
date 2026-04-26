import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    // Verify user via anon client
    const anonSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonSb.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Admin client for data access
    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { match_id, my_name, match_name } = await req.json();

    // Verify user owns this match
    const { data: match } = await adminSb.from("matches")
      .select("user_id_1, user_id_2")
      .eq("id", match_id)
      .single();
    if (!match || (match.user_id_1 !== user.id && match.user_id_2 !== user.id)) {
      throw new Error("Unauthorized");
    }

    // Fetch last 10 messages
    const { data: messages } = await adminSb.from("messages")
      .select("sender_id, content, created_at")
      .eq("match_id", match_id)
      .eq("message_type", "text")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ openers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const thread = messages.reverse().map(m => {
      const who = m.sender_id === user.id ? my_name : match_name;
      return `${who}: ${m.content}`;
    }).join("\n");

    const lastTime = new Date(messages[messages.length - 1].created_at);
    const hoursAgo = Math.round((Date.now() - lastTime.getTime()) / 3600000);

    const prompt = `Here is the recent conversation between ${my_name} and ${match_name} on a dating app:

${thread}

The conversation has been quiet for about ${hoursAgo} hours. Generate exactly 3 re-opener messages for ${my_name} to send. Requirements:
- Each must reference something specific from the conversation — no generic openers
- Natural, warm, not pushy
- 1–2 sentences max
- Vary the tone: one warm/curious, one playful, one light/low-pressure
- Do NOT use "Hey" as an opener

Return ONLY a JSON object like this, no markdown, no explanation:
{"openers":["message one","message two","message three"]}`;

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const aiData = await res.json();
    const text = aiData.content?.[0]?.text || "{}";
    const parsed = JSON.parse(text);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
