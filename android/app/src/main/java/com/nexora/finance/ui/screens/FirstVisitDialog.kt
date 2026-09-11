package com.nexora.finance.ui.screens

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable

@Composable
fun FirstVisitDialog(onDone: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDone,
        title = { Text("Bienvenue sur NEXORA 👋") },
        text = { Text("Pas besoin de connaître la finance. Commence par regarder ton solde, tes dépenses et ton budget. Si tu ne comprends pas quelque chose, demande à LIA.") },
        confirmButton = { Button(onClick = onDone) { Text("J'ai compris") } },
        dismissButton = { TextButton(onClick = onDone) { Text("Plus tard") } },
    )
}
