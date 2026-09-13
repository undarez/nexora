package com.nexora.finance.ui

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.DisposableEffect
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.runtime.getValue
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.nexora.finance.ui.navigation.Destination
import com.nexora.finance.ui.navigation.destinations
import com.nexora.finance.ui.screens.*

@Composable
fun NexoraApp(viewModel: AppViewModel) {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    val browserUrl by viewModel.androidBrowserUrl.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.refreshSession()
                viewModel.loadContext()
                viewModel.loadTransactions()
                viewModel.loadBanking()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(browserUrl) {
        browserUrl?.let {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it)))
            viewModel.consumeBrowserUrl()
        }
    }

    Scaffold(bottomBar = {
        NavigationBar {
            destinations.forEach { destination ->
                NavigationBarItem(
                    selected = current == destination.route,
                    onClick = {
                        nav.navigate(destination.route) {
                            popUpTo(nav.graph.startDestinationId) { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    icon = { androidx.compose.material3.Icon(destination.icon, contentDescription = destination.label) },
                    label = { Text(destination.label) },
                )
            }
        }
    }) { padding ->
        NavHost(navController = nav, startDestination = Destination.Home.route, modifier = Modifier.padding(padding)) {
            composable(Destination.Home.route) { DashboardScreen(viewModel, onNavigate = { nav.navigate(it) }) }
            composable(Destination.Transactions.route) { TransactionsScreen(viewModel) }
            composable(Destination.Budget.route) { BudgetScreen(viewModel) }
            composable(Destination.Banking.route) { BankingScreen(viewModel) }
            composable(Destination.Lia.route) { LiaScreen(viewModel) }
            composable("enterprise") { EnterpriseScreen(viewModel) }
        }
    }
}

