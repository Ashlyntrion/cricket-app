// Supabase Edge Function — deploy with: supabase functions deploy invite-coach
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { email, full_name } = await req.json();
    const authHeader = req.headers.get("Authorization")!;

    // Verify the calling user with anon key
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Caller must be admin
    const { data: profile } = await userClient
      .from("profiles").select("role").eq("id", user.id).single();

    if (profile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Use service role to send the invite
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const siteUrl = Deno.env.get("SITE_URL") ?? "https://localhost:8081";

    const { data: invite, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
      redirectTo: `${siteUrl}/reset-password`,
    });

    if (inviteErr) {
      return new Response(JSON.stringify({ error: inviteErr.message }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Pre-create profile so the coach shows up in the list immediately
    await adminClient.from("profiles").upsert({
      id: invite.user.id,
      full_name,
      email,
      role: "coach",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
