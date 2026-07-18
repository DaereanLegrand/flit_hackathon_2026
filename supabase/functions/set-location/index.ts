import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const { hash, lat, lng } = await req.json()

      if (!hash || lat === undefined || lng === undefined) {
        return Response.json({ error: "hash, lat, and lng are required" }, { status: 400 })
      }

      const { data, error } = await ctx.supabaseAdmin
        .from("qr_codes")
        .update({ lat, lng })
        .eq("hash", hash)
        .select("lat, lng")
        .single()

      if (error) throw error

      return Response.json(data)
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }),
}
