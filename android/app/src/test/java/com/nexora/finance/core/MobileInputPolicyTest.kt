package com.nexora.finance.core

import com.nexora.finance.core.auth.MobileInputPolicy
import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MobileInputPolicyTest {
    @Test fun acceptsNormalEmail() { assertTrue(MobileInputPolicy.validEmail("user@example.fr")) }
    @Test fun rejectsMultipleAtSigns() { assertFalse(MobileInputPolicy.validEmail("user@@example.fr")) }
    @Test fun rejectsDomainWithoutDot() { assertFalse(MobileInputPolicy.validEmail("user@example")) }
    @Test fun acceptsNormalQuestion() { assertTrue(MobileInputPolicy.validLiaQuestion("Quel est mon solde ?")) }
    @Test fun rejectsOversizedQuestion() { assertFalse(MobileInputPolicy.validLiaQuestion("x".repeat(8_001))) }
}
