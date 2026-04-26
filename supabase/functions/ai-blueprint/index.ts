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

    const { vibe, budget, time_of_day, constraints, match_name } = await req.json();

    const constraintsLine = constraints ? `\n- Important constraints: ${constraints}` : "";

    const prompt = `You are a creative date planner. Create a vivid, specific 3-stop date itinerary.

Parameters:
- Vibe: ${vibe}
- Budget: ${budget}
- Time of day: ${time_of_day}
- Planning for: someone going on a date with ${match_name}${constraintsLine}

Create a narrative plan. Each stop should feel like a real place that could exist in any city. Be specific but not tied to a real address. Write as if you're a friend who knows this city well.

Return ONLY a JSON object, no markdown, no explanation:
{
  "title": "a short poetic name for this date (5 words max)",
  "narrative": "one sentence setting the scene and tone for the whole evening",
  "stops": [
    {"emoji":"🍸","name":"venue name","why":"why this place works for this date (1 sentence)","convo_starter":"a specific question or observation to spark conversation here"},
    {"emoji":"🎶","name":"second venue name","why":"why this is the right next move","convo_starter":"a conversation prompt for this stop"},
    {"emoji":"🌙","name":"third venue name — the late option","why":"why this is perfect if things are going well","convo_starter":"something to say here"}
  ]
}`;

    const res = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
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
