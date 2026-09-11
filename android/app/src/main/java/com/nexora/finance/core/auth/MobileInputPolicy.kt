package com.nexora.finance.core.auth

/** Small client-side guards. Server-side validation remains authoritative. */
object MobileInputPolicy {
    const val MAX_LIA_QUESTION_CHARS = 8_000
    const val MAX_EMAIL_CHARS = 320

    fun validEmail(value: String): Boolean {
        val email = value.trim()
        if (email.isEmpty() || email.length > MAX_EMAIL_CHARS) return false
        val at = email.indexOf('@')
        return at > 0 && at == email.lastIndexOf('@') && at < email.lastIndex &&
            !email.contains("..") && email.substring(at + 1).contains('.')
    }

    fun validLiaQuestion(value: String): Boolean =
        value.trim().isNotEmpty() && value.trim().length <= MAX_LIA_QUESTION_CHARS
}
