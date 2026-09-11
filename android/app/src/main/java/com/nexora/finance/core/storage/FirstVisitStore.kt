package com.nexora.finance.core.storage

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.dataStore by preferencesDataStore("nexora_settings")

class FirstVisitStore(private val context: Context) {
    private fun key(userId: String) = booleanPreferencesKey("first_visit_seen_$userId")

    suspend fun hasSeen(userId: String): Boolean = context.dataStore.data.first()[key(userId)] == true

    suspend fun markSeen(userId: String) {
        context.dataStore.edit { it[key(userId)] = true }
    }
}
