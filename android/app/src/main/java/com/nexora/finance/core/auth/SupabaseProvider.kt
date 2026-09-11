package com.nexora.finance.core.auth

import com.nexora.finance.BuildConfig
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient

object SupabaseProvider {
    val client by lazy {
        require(BuildConfig.SUPABASE_URL.isNotBlank()) { "SUPABASE_URL manquant" }
        require(BuildConfig.SUPABASE_PUBLISHABLE_KEY.isNotBlank()) { "SUPABASE_PUBLISHABLE_KEY manquant" }
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY,
        ) {
            install(Auth) {
                flowType = io.github.jan.supabase.auth.FlowType.PKCE
            }
        }
    }
}
