// Supabase Edge Function — déployer avec: supabase functions deploy send-push
// Variables requises: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:support@monbudget.fr)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { title, body, userId } = await req.json();
    if (!title || !body) {
      return new Response(JSON.stringify({ error: "title and body required" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let query = supabase.from("push_subscriptions").select("*");
    if (userId) query = query.eq("user_id", userId);
    const { data: subs } = await query;

    if (!subs?.length) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Les push Web nécessitent web-push côté serveur avec les clés VAPID.
    // Cette fonction enregistre la notification et retourne le nombre de cibles.
    await supabase.from("notifications").insert({
      user_id: userId || null,
      title,
      body,
      type: "info",
    });

    return new Response(JSON.stringify({ sent: subs.length, message: "Configure web-push with VAPID keys for delivery" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
