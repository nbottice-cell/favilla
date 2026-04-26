import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const anonSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await anonSb.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminSb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { match_id, my_name, match_name } = await req.json();

    // Verify ownership
    const { data: match } = await adminSb.from("matches")
      .select("user_id_1, user_id_2")
      .eq("id", match_id)
      .single();
    if (!match || (match.user_id_1 !== user.id && match.user_id_2 !== user.id)) {
      throw new Error("Unauthorized");
    }

    // Fetch up to 40 messages
    const { data: messages } = await adminSb.from("messages")
      .select("sender_id, content, created_at")
      .eq("match_id", match_id)
      .eq("message_type", "text")
      .order("created_at", { ascending: false })
      .limit(40);

    if (!messages || messages.length < 5) {
      throw new Error("Not enough messages for a vibe check");
    }

    const thread = messages.reverse().map(m => {
      const who = m.sender_id === user.id ? my_name : match_name;
      return `${who}: ${m.content}`;
    }).join("\n");

    const prompt = `You are a perceptive, grounded reader of conversation dynamics on a dating app. Read the following conversation between ${my_name} and ${match_name} and give ${my_name} a private, honest vibe check.

Conversation:
${thread}

Write a vibe check for ${my_name} only. Rules:
- No score, no rating
- Be observational and specific — reference actual moments or patterns from the conversation
- 3-4 sentences for the main read
- Three short, specific "signals" you noticed (each 1 sentence, starting with a verb)
- Warm but honest tone — like a perceptive friend who's read the thread
- Start the read with "The conversation..."

Return ONLY a JSON object, no markdown:
{"read":"3-4 sentence paragraph","signals":["signal one","signal two","signal three"]}`;

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 768,
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
