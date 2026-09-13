package com.nexora.finance.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.nexora.finance.core.network.ChatMessage
import com.nexora.finance.core.auth.MobileInputPolicy
import com.nexora.finance.core.storage.FirstVisitStore
import com.nexora.finance.data.BankingConnection
import com.nexora.finance.data.FinancialContext
import com.nexora.finance.data.EnterpriseContext
import com.nexora.finance.data.NexoraRepository
import com.nexora.finance.data.Transaction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface AppState {
    data object Loading : AppState
    data object SignedOut : AppState
    data class Ready(val firstVisit: Boolean, val context: FinancialContext? = null) : AppState
    data class Error(val message: String) : AppState
}

data class LiaUiMessage(val role: String, val content: String)

class AppViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = NexoraRepository()
    private val firstVisitStore = FirstVisitStore(application)
    private val _state = MutableStateFlow<AppState>(AppState.Loading)
    val state: StateFlow<AppState> = _state.asStateFlow()
    private val _transactions = MutableStateFlow<List<Transaction>>(emptyList())
    val transactions: StateFlow<List<Transaction>> = _transactions.asStateFlow()
    private val _banking = MutableStateFlow<List<BankingConnection>>(emptyList())
    private val _enterprise = MutableStateFlow<EnterpriseContext?>(null)
    val enterprise: StateFlow<EnterpriseContext?> = _enterprise.asStateFlow()
    val banking: StateFlow<List<BankingConnection>> = _banking.asStateFlow()
    private val _liaMessages = MutableStateFlow<List<LiaUiMessage>>(emptyList())
    val liaMessages: StateFlow<List<LiaUiMessage>> = _liaMessages.asStateFlow()
    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()
    private val _message = MutableStateFlow<String?>(null)
    val message: StateFlow<String?> = _message.asStateFlow()

    init { refreshSession() }

    fun clearMessage() { _message.value = null }

    fun refreshSession() = viewModelScope.launch {
        try {
            val userId = repository.currentUserId()
            if (userId == null) _state.value = AppState.SignedOut
            else _state.value = AppState.Ready(firstVisitStore.hasSeen(userId))
        } catch (e: Exception) { _state.value = AppState.Error(e.message ?: "Impossible de vérifier la session.") }
    }

    fun signIn(email: String, password: String) = viewModelScope.launch {
        _state.value = AppState.Loading
        runCatching { repository.signIn(email.trim(), password) }
            .onSuccess { refreshSession() }
            .onFailure { _state.value = AppState.Error(it.message ?: "Connexion impossible.") }
    }

    fun markFirstVisitSeen() = viewModelScope.launch {
        repository.currentUserId()?.let { userId ->
            firstVisitStore.markSeen(userId)
            val current = _state.value
            if (current is AppState.Ready) _state.value = current.copy(firstVisit = false)
        }
    }

    fun loadContext() = viewModelScope.launch {
        val current = _state.value as? AppState.Ready ?: return@launch
        runCatching { repository.context() }
            .onSuccess { _state.value = current.copy(context = it) }
            .onFailure { _message.value = it.message ?: "Données financières indisponibles." }
    }

    fun loadTransactions() = viewModelScope.launch {
        runCatching { repository.transactions() }.onSuccess { _transactions.value = it }
            .onFailure { _message.value = it.message ?: "Transactions indisponibles." }
    }

    fun loadEnterprise() = viewModelScope.launch {
        runCatching { repository.enterprise() }.onSuccess { if (it.available) _enterprise.value = it.context }
            .onFailure { _message.value = it.message ?: "Espace entreprise indisponible." }
    }

    fun loadBanking() = viewModelScope.launch {
        runCatching { repository.banking() }.onSuccess { _banking.value = it }
            .onFailure { _message.value = it.message ?: "Connexions bancaires indisponibles." }
    }

    fun connectBank() = viewModelScope.launch {
        if (_busy.value) return@launch
        _busy.value = true
        try {
            runCatching { repository.createBankConnection() }
                .onSuccess { _androidBrowserUrl.value = it }
                .onFailure { _message.value = it.message ?: "Connexion bancaire impossible." }
        } finally {
            _busy.value = false
        }
    }

    private val _androidBrowserUrl = MutableStateFlow<String?>(null)
    val androidBrowserUrl: StateFlow<String?> = _androidBrowserUrl.asStateFlow()
    fun consumeBrowserUrl() { _androidBrowserUrl.value = null }

    fun sendLia(text: String) = viewModelScope.launch {
        val question = text.trim()
        if (!MobileInputPolicy.validLiaQuestion(question) || _busy.value) {
            if (question.length > MobileInputPolicy.MAX_LIA_QUESTION_CHARS) {
                _message.value = "Question trop longue (maximum 8 000 caractères)."
            }
            return@launch
        }
        val current = _liaMessages.value + LiaUiMessage("user", question)
        _liaMessages.value = current
        _busy.value = true
        val history = current.dropLast(1).map { ChatMessage(it.role, it.content) }
        try {
            runCatching { repository.lia(question, history) }
                .onSuccess { response -> _liaMessages.value = _liaMessages.value + LiaUiMessage("assistant", response.analysis) }
                .onFailure { _message.value = it.message ?: "LIA est momentanément indisponible." }
        } finally {
            _busy.value = false
        }
    }

    fun signOut() = viewModelScope.launch {
        runCatching { repository.signOut() }
        _state.value = AppState.SignedOut
        _liaMessages.value = emptyList()
        _transactions.value = emptyList()
        _banking.value = emptyList()
        _enterprise.value = null
        _message.value = null
    }
}
