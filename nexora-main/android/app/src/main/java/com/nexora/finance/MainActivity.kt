package com.nexora.finance

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import com.nexora.finance.ui.theme.NexoraTheme
import androidx.compose.material3.Surface
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.nexora.finance.core.auth.SupabaseProvider
import com.nexora.finance.ui.AppState
import com.nexora.finance.ui.AppViewModel
import com.nexora.finance.ui.NexoraApp
import com.nexora.finance.ui.screens.FirstVisitDialog
import com.nexora.finance.ui.screens.LoadingScreen
import com.nexora.finance.ui.screens.LoginScreen

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<AppViewModel>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        setContent {
            NexoraTheme {
                Surface {
                    when (val state = viewModel.state.collectAsStateWithLifecycle().value) {
                        AppState.Loading -> LoadingScreen()
                        AppState.SignedOut -> LoginScreen(onLogin = viewModel::signIn)
                        is AppState.Error -> LoginScreen(error = state.message, onLogin = viewModel::signIn)
                        is AppState.Ready -> {
                            NexoraApp(viewModel)
                            if (state.firstVisit) FirstVisitDialog(onDone = viewModel::markFirstVisitSeen)
                        }
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        intent ?: return
        runCatching { SupabaseProvider.client.handleDeeplinks(intent) }
        val uri = intent.data ?: return
        if (uri.scheme == "nexora" && uri.host == "auth") {
            viewModel.refreshSession()
            viewModel.loadBanking()
        }
    }
}
