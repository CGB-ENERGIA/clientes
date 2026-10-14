import { boot } from 'quasar/wrappers'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// O PostgREST do Supabase devolve no máximo 1000 linhas por requisição.
// `buildQuery` deve retornar uma query nova e com ordenação estável.
export async function fetchAll (buildQuery, pageSize = 1000) {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...data)
    if (data.length < pageSize) return { data: rows, error: null }
  }
}

export default boot(() => {})
