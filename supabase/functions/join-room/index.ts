import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const { qr_hash, device_id, nickname } = await req.json()

      if (!qr_hash || !device_id || !nickname) {
        return Response.json({ error: "qr_hash, device_id, and nickname are required" }, { status: 400 })
      }

      const { data, error } = await ctx.supabaseAdmin
        .from("room_participants")
        .upsert({ qr_hash, device_id, nickname }, { onConflict: "qr_hash, device_id" })
        .select("id, nickname, created_at")
        .single()

      if (error) throw error

      return Response.json(data, { status: 201 })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }),
}
