import "@supabase/functions-js/edge-runtime.d.ts"
import { withSupabase } from "@supabase/server"

function generateHash(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
  let result = ""
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  for (let i = 0; i < 16; i++) {
    result += chars[array[i] % chars.length]
  }
  return result
}

export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
    try {
      const hash = generateHash()

      const { data, error } = await ctx.supabaseAdmin
        .from("qr_codes")
        .insert({ hash })
        .select("id, hash, created_at")
        .single()

      if (error) throw error

      return Response.json(data, { status: 201 })
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 })
    }
  }),
}
