package com.nexora.finance.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.nexora.finance.data.Transaction
import com.nexora.finance.ui.AppState
import com.nexora.finance.ui.AppViewModel
import com.nexora.finance.ui.LiaUiMessage
import com.nexora.finance.ui.navigation.Destination
import java.text.NumberFormat
import java.util.Locale

private val eur = NumberFormat.getCurrencyInstance(Locale.FRANCE)
private fun money(value: Double) = eur.format(value)

@Composable
fun DashboardScreen(viewModel: AppViewModel, onNavigate: (String) -> Unit) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadContext() }
    val context = (state as? AppState.Ready)?.context
    val enterprise by viewModel.enterprise.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadEnterprise() }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Text("Bonjour 👋", style = MaterialTheme.typography.headlineMedium)
            Text("Voici l'essentiel de ta situation.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        item { MetricCard("Disponible", money(context?.liquidity?.primary_total ?: 0.0)) }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MetricCard("Revenus", money(context?.cashflow?.income ?: 0.0), Modifier.weight(1f))
            MetricCard("Dépenses", money(context?.cashflow?.expenses ?: 0.0), Modifier.weight(1f))
        }}
        item { Card(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) { Column(Modifier.padding(16.dp)) {
            Text("Budget", style = MaterialTheme.typography.titleMedium)
            Text(if (context?.budget?.available == true) "${money(context.budget.remaining)} restant" else "Aucun budget actif", modifier = Modifier.padding(top = 8.dp))
            Button(onClick = { onNavigate(Destination.Budget.route) }, modifier = Modifier.padding(top = 12.dp)) { Text("Voir mon budget") }
        }}}
        if (enterprise != null) item {
            OutlinedButton(onClick = { onNavigate("enterprise") }, modifier = Modifier.fillMaxWidth()) { Text("Ouvrir mon espace entreprise") }
        }
        item { Card(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) { Column(Modifier.padding(16.dp)) {
            Text("Besoin d'aide ?", style = MaterialTheme.typography.titleMedium)
            Text("Demande à LIA de t'expliquer un chiffre ou une dépense.", modifier = Modifier.padding(top = 6.dp))
            OutlinedButton(onClick = { onNavigate(Destination.Lia.route) }, modifier = Modifier.padding(top = 12.dp)) { Text("Parler à LIA") }
        }}}
    }
}

@Composable private fun MetricCard(title: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier, shape = MaterialTheme.shapes.large) { Column(Modifier.padding(16.dp)) { Text(title, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(value, style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 6.dp)) } }
}

@Composable
fun TransactionsScreen(viewModel: AppViewModel) {
    val transactions by viewModel.transactions.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadTransactions() }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Text("Opérations", style = MaterialTheme.typography.headlineMedium) }
        item { Text("Les opérations bancaires et manuelles sont réunies ici.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (transactions.isEmpty()) item { Text("Aucune opération à afficher.", modifier = Modifier.padding(top = 10.dp)) }
        items(transactions, key = { it.id }) { TransactionRow(it) }
    }
}

@Composable private fun TransactionRow(transaction: Transaction) {
    Card(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) { Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) { Text(transaction.merchant_name ?: transaction.description ?: "Opération"); Text(transaction.category ?: "Sans catégorie", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
        Text(money(transaction.amount))
    }}
}

@Composable
fun BudgetScreen(viewModel: AppViewModel) {
    val state by viewModel.state.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadContext() }
    val budget = (state as? AppState.Ready)?.context?.budget
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 18.dp)) {
        Text("Budget", style = MaterialTheme.typography.headlineMedium)
        if (budget?.available == true) {
            Text("Prévu : ${money(budget.planned)}", modifier = Modifier.padding(top = 18.dp))
            Text("Dépensé : ${money(budget.spent)}", modifier = Modifier.padding(top = 8.dp))
            Text("Reste : ${money(budget.remaining)}", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 8.dp))
        } else Text("Tu n'as pas encore de budget actif.", modifier = Modifier.padding(top = 18.dp))
    }
}

@Composable
fun BankingScreen(viewModel: AppViewModel) {
    val connections by viewModel.banking.collectAsState()
    val busy by viewModel.busy.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadBanking() }
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Banque", style = MaterialTheme.typography.headlineMedium) }
        item { Text("Connecte ta banque pour retrouver automatiquement tes comptes et opérations.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { Button(onClick = { viewModel.connectBank() }, enabled = !busy, modifier = Modifier.fillMaxWidth()) { if (busy) CircularProgressIndicator(modifier = Modifier.padding(2.dp), strokeWidth = 2.dp) else Text("Connecter une banque") } }
        item { Text("Connexions", style = MaterialTheme.typography.titleMedium) }
        if (connections.isEmpty()) item { Text("Aucune banque connectée.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        items(connections, key = { it.id }) { connection ->
            Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(16.dp)) {
                Text(connection.institution_name ?: "Banque", style = MaterialTheme.typography.titleMedium)
                Text("Statut : ${connection.status}", modifier = Modifier.padding(top = 4.dp))
                if (connection.consent_expires_at != null) Text("Consentement : ${connection.consent_expires_at}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }}
        }
    }
}

@Composable
fun LiaScreen(viewModel: AppViewModel) {
    val messages by viewModel.liaMessages.collectAsState()
    val busy by viewModel.busy.collectAsState()
    var input by rememberSaveable { mutableStateOf("") }
    Column(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 18.dp)) {
        Text("LIA", style = MaterialTheme.typography.headlineMedium)
        Text("Pose ta question comme tu parlerais à quelqu'un.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
        LazyColumn(Modifier.weight(1f).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (messages.isEmpty()) item { Suggestion("« Où part mon argent ce mois-ci ? »", onClick = { input = "Où part mon argent ce mois-ci ?" }) }
            items(messages) { MessageBubble(it) }
            if (busy) item { Text("LIA réfléchit…", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
        Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(input, { input = it }, label = { Text("Ta question") }, modifier = Modifier.weight(1f), maxLines = 4)
            Button(onClick = { viewModel.sendLia(input); input = "" }, enabled = input.isNotBlank() && !busy) { Text("Envoyer") }
        }
    }
}

@Composable private fun Suggestion(text: String, onClick: () -> Unit) {
    OutlinedButton(onClick = onClick) { Text(text) }
}

@Composable private fun MessageBubble(message: LiaUiMessage) {
    Card(Modifier.fillMaxWidth()) { Column(Modifier.padding(14.dp)) {
        Text(if (message.role == "user") "Toi" else "LIA", style = MaterialTheme.typography.labelLarge)
        Text(message.content, modifier = Modifier.padding(top = 4.dp))
    }}
}

@Composable
fun EnterpriseScreen(viewModel: AppViewModel) {
    val enterprise by viewModel.enterprise.collectAsState()
    LaunchedEffect(Unit) { viewModel.loadEnterprise() }
    val company = enterprise?.company
    val financial = enterprise?.financial
    LazyColumn(Modifier.fillMaxSize().padding(horizontal = 16.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Entreprise", style = MaterialTheme.typography.headlineMedium) }
        if (enterprise == null) {
            item { Text("Vérification de l'espace entreprise…") }
        } else {
            item { Card(Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) { Column(Modifier.padding(16.dp)) {
                Text(company?.name ?: "Mon entreprise", style = MaterialTheme.typography.titleLarge)
                Text(if (company?.verified == true) "Entreprise vérifiée" else "Espace entreprise non disponible", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
                company?.siret?.let { Text("SIRET : $it", style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 6.dp)) }
            }}}
            item { MetricCard("Trésorerie disponible", money(financial?.liquidity?.primary_total ?: 0.0)) }
            item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard("Entrées", money(financial?.cashflow?.income ?: 0.0), Modifier.weight(1f))
                MetricCard("Sorties", money(financial?.cashflow?.expenses ?: 0.0), Modifier.weight(1f))
            }}
        }
    }
}
