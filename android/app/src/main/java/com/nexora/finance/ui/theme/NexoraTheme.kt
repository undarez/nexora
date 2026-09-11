package com.nexora.finance.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape

private val LightColors = lightColorScheme(
    primary = Color(0xFF6750E8),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFF0EDFF),
    onPrimaryContainer = Color(0xFF24145E),
    secondary = Color(0xFF5F7CFF),
    background = Color(0xFFF7F8FC),
    surface = Color.White,
    surfaceVariant = Color(0xFFF0F2F8),
    onSurface = Color(0xFF111936),
    onSurfaceVariant = Color(0xFF68728D),
    outline = Color(0xFFE2E6F0),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFF9B86FF),
    onPrimary = Color(0xFF1A1238),
    primaryContainer = Color(0xFF2A2152),
    onPrimaryContainer = Color(0xFFEAE4FF),
    secondary = Color(0xFF91A3FF),
    background = Color(0xFF0C1323),
    surface = Color(0xFF111A2D),
    surfaceVariant = Color(0xFF18233A),
    onSurface = Color(0xFFF5F7FF),
    onSurfaceVariant = Color(0xFFA8B2C8),
    outline = Color(0xFF283750),
)

@Composable
fun NexoraTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        typography = Typography().let { base ->
            base.copy(
                headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.ExtraBold),
                titleLarge = base.titleLarge.copy(fontWeight = FontWeight.Bold),
                titleMedium = base.titleMedium.copy(fontWeight = FontWeight.Bold),
            )
        },
        shapes = Shapes(
            small = RoundedCornerShape(10.dp),
            medium = RoundedCornerShape(16.dp),
            large = RoundedCornerShape(20.dp),
        ),
        content = content,
    )
}
