package com.nexora.finance.data

import kotlinx.serialization.Serializable

@Serializable
data class FinancialContext(
    val liquidity: Liquidity = Liquidity(),
    val cashflow: Cashflow = Cashflow(),
    val budget: Budget = Budget(),
)

@Serializable
data class Liquidity(
    val primary_total: Double = 0.0,
    val primary_currency: String = "EUR",
)

@Serializable
data class Cashflow(
    val income: Double = 0.0,
    val expenses: Double = 0.0,
    val net: Double = 0.0,
)

@Serializable
data class Budget(
    val available: Boolean = false,
    val planned: Double = 0.0,
    val spent: Double = 0.0,
    val remaining: Double = 0.0,
)

@Serializable
data class Transaction(
    val id: String = "",
    val amount: Double = 0.0,
    val currency: String = "EUR",
    val category: String? = null,
    val description: String? = null,
    val merchant_name: String? = null,
    val booked_at: String? = null,
)

@Serializable
data class BankingConnection(
    val id: String = "",
    val provider: String = "",
    val status: String = "",
    val institution_name: String? = null,
    val last_synced_at: String? = null,
    val consent_expires_at: String? = null,
)
