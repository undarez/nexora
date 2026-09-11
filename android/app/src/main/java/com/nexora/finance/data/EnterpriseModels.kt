package com.nexora.finance.data

import kotlinx.serialization.Serializable

@Serializable
data class EnterpriseCompany(
    val name: String = "Mon entreprise",
    val legal_name: String? = null,
    val trade_name: String? = null,
    val siret: String? = null,
    val verified: Boolean = false,
)

@Serializable
data class EnterpriseResponse(val available: Boolean = false, val context: EnterpriseContext? = null)

@Serializable
data class EnterpriseContext(
    val company: EnterpriseCompany = EnterpriseCompany(),
    val financial: FinancialContext = FinancialContext(),
    val fixed_commitments: Double = 0.0,
    val data_quality: EnterpriseQuality = EnterpriseQuality(),
)

@Serializable
data class EnterpriseQuality(
    val transaction_count: Int = 0,
    val connected_accounts: Int = 0,
    val budget_available: Boolean = false,
)
