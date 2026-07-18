import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const { qr_hash } = await req.json()

      if (!qr_hash) {
        return Response.json({ error: "qr_hash is required" }, { status: 400 })
      }

      const { data, error } = await ctx.supabaseAdmin
        .from("room_participants")
        .select("id, nickname, device_id, created_at")
        .eq("qr_hash", qr_hash)
        .order("created_at", { ascending: true })

      if (error) throw error

      return Response.json({ participants: data, count: data.length })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }),
}
