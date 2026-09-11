package com.nexora.finance.core.network

import com.nexora.finance.BuildConfig
import com.nexora.finance.core.auth.SupabaseProvider
import com.nexora.finance.data.BankingConnection
import com.nexora.finance.data.FinancialContext
import com.nexora.finance.data.Transaction
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.HttpResponseException
import io.ktor.client.engine.android.Android
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

class NexoraApi(
    private val http: HttpClient = HttpClient(Android) {
        expectSuccess = true
        install(HttpTimeout) {
            requestTimeoutMillis = 20_000
            connectTimeoutMillis = 10_000
            socketTimeoutMillis = 20_000
        }
        install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true; explicitNulls = false }) }
    },
) {
    private val baseUrl = BuildConfig.NEXORA_BASE_URL.trimEnd('/')

    init {
        require(baseUrl.isNotBlank()) { "NEXORA_BASE_URL manquant" }
        require(BuildConfig.DEBUG || baseUrl.startsWith("https://")) {
            "NEXORA_BASE_URL doit utiliser HTTPS en production"
        }
    }

    private fun userMessage(error: Throwable): String = when (error) {
        is HttpResponseException -> when (error.response.status.value) {
            401 -> "Session expirée. Reconnectez-vous."
            403 -> "Accès refusé pour cette opération."
            408, 429 -> "Service temporairement indisponible. Réessayez dans un instant."
            in 500..599 -> "Le serveur NEXORA est momentanément indisponible."
            else -> "La requête NEXORA a échoué (${error.response.status.value})."
        }
        else -> error.message ?: "Une erreur réseau est survenue."
    }

    suspend fun <T> safe(block: suspend () -> T): T = try {
        block()
    } catch (error: Throwable) {
        throw IllegalStateException(userMessage(error), error)
    }

    private suspend fun token(): String =
        SupabaseProvider.client.auth.currentSessionOrNull()?.accessToken
            ?: error("Session NEXORA absente")

    private suspend fun authHeader() = "Bearer ${token()}"

    suspend fun financialContext(): FinancialContext =
        http.get("$baseUrl/api/mobile/context") { header(HttpHeaders.Authorization, authHeader()) }.body()

    suspend fun transactions(): List<Transaction> =
        http.get("$baseUrl/api/mobile/transactions") { header(HttpHeaders.Authorization, authHeader()) }
            .body<TransactionResponse>().transactions

    suspend fun bankingStatus(): List<BankingConnection> =
        http.get("$baseUrl/api/mobile/banking/status") { header(HttpHeaders.Authorization, authHeader()) }
            .body<BankingResponse>().connections

    suspend fun createBankConnection(provider: String = "powens"): String =
        http.post("$baseUrl/api/mobile/banking/connect") {
            header(HttpHeaders.Authorization, authHeader())
            contentType(ContentType.Application.Json)
            setBody(BankConnectRequest(provider = provider))
        }.body<BankConnectResponse>().authorizationUrl

    suspend fun enterprise(): EnterpriseResponse =
        http.get("$baseUrl/api/mobile/enterprise") { header(HttpHeaders.Authorization, authHeader()) }.body()

    suspend fun chat(question: String, history: List<ChatMessage>): ChatResponse =
        http.post("$baseUrl/api/mobile/lia/chat") {
            header(HttpHeaders.Authorization, authHeader())
            contentType(ContentType.Application.Json)
            setBody(ChatRequest(question = question, history = history.takeLast(8)))
        }.body()
}

@Serializable data class TransactionResponse(val transactions: List<Transaction> = emptyList())
@Serializable data class BankingResponse(val connections: List<BankingConnection> = emptyList())
@Serializable data class BankConnectRequest(val provider: String)
@Serializable data class BankConnectResponse(val authorizationUrl: String)
@Serializable data class ChatMessage(val role: String, val content: String)
@Serializable data class ChatRequest(val question: String, val history: List<ChatMessage> = emptyList())
@Serializable data class ChatResponse(
    val analysis: String = "",
    val model: String? = null,
    val provider: String? = null,
    val warning: String? = null,
)
