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

    const { match_name, scenario } = await req.json();

    const scenarioLine = scenario
      ? `Use this scenario (do not change it): "${scenario}"`
      : `Create a new funny, universally relatable scenario — something like a reaction image would depict. Think: social situations, awkward moments, late-night decisions. Keep it under 12 words.`;

    const prompt = `You are writing captions for a two-player caption game on a dating app called Meme Duel. One player is playing against ${match_name}.

${scenarioLine}

Generate 6 caption options for one player to choose from. Make them funny in different ways:
- One dry/deadpan
- One absurdist
- One self-aware/meta
- One that escalates unexpectedly
- One uncomfortably relatable
- One that is just chaos

Keep each caption under 15 words. They should feel like things a real person would actually say, not polished jokes.

Return ONLY a JSON object, no markdown:
{"scenario":"the scenario text","captions":["caption1","caption2","caption3","caption4","caption5","caption6"]}`;

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
