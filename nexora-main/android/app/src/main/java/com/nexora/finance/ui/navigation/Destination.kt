package com.nexora.finance.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBalance
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.PieChart
import androidx.compose.material.icons.filled.ReceiptLong
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.ui.graphics.vector.ImageVector

data class Destination(val route: String, val label: String, val icon: ImageVector) {
    companion object {
        val Home = Destination("home", "Accueil", Icons.Filled.Home)
        val Transactions = Destination("transactions", "Opérations", Icons.Filled.ReceiptLong)
        val Budget = Destination("budget", "Budget", Icons.Filled.PieChart)
        val Banking = Destination("banking", "Banque", Icons.Filled.AccountBalance)
        val Lia = Destination("lia", "LIA", Icons.Filled.SmartToy)
    }
}

val destinations = listOf(Destination.Home, Destination.Transactions, Destination.Budget, Destination.Banking, Destination.Lia)
