package com.nexora.finance.data

import com.nexora.finance.core.auth.SupabaseProvider
import com.nexora.finance.core.network.ChatMessage
import com.nexora.finance.core.network.NexoraApi

class NexoraRepository(private val api: NexoraApi = NexoraApi()) {
    suspend fun currentUserId(): String? = SupabaseProvider.client.auth.currentUserOrNull()?.id
    suspend fun signIn(email: String, password: String) {
        SupabaseProvider.client.auth.signInWith(io.github.jan.supabase.auth.providers.builtin.Email) {
            this.email = email
            this.password = password
        }
    }
    suspend fun signOut() = SupabaseProvider.client.auth.signOut()
    suspend fun context() = api.safe { api.financialContext() }
    suspend fun transactions() = api.safe { api.transactions() }
    suspend fun banking() = api.safe { api.bankingStatus() }
    suspend fun createBankConnection() = api.safe { api.createBankConnection() }
    suspend fun enterprise() = api.safe { api.enterprise() }
    suspend fun lia(question: String, history: List<ChatMessage>) = api.safe { api.chat(question, history) }
}
