import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const { hash } = await req.json()

      if (!hash) {
        return Response.json({ error: "hash is required" }, { status: 400 })
      }

      const { data, error } = await ctx.supabaseAdmin
        .from("qr_codes")
        .select("lat, lng")
        .eq("hash", hash)
        .single()

      if (error) throw error

      return Response.json(data)
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }),
}
