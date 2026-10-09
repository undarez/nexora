# LIA / Nexo Voice

Nexo is the user-facing voice/mascot surface for LIA. Voice does not create a separate agent or bypass the existing LIA pipeline.

## Flow

`microphone → browser speech recognition → /api/lia/chat → LIA governance/evaluation → response → /api/lia/voice/synthesize → audio`

The browser never receives provider API keys.

## Speech input

Nexo uses the browser Web Speech recognition API when available, configured for `fr-FR`. If unavailable, the text composer remains the fallback.

Speech recognition availability depends on the browser/device and its permission model.

### Fish Audio

```env
NEXORA_VOICE_PROVIDER=fish
FISH_AUDIO_API_KEY=
FISH_AUDIO_VOICE_ID=
FISH_AUDIO_MODEL=s2.1-pro-free
```

Fish Audio is integrated server-side through its TTS endpoint. Provider-specific capabilities should be verified against the current provider documentation before production changes.

## Speech output

The server-side voice gateway supports:

- Fish Audio S2.1 Pro (primary Nexo provider);
- Hume Octave TTS;
- ElevenLabs TTS.

Configure one provider:

```env
NEXORA_VOICE_PROVIDER=hume
HUME_API_KEY=
HUME_VOICE_ID=
HUME_VOICE_NAME=
```

or:

```env
NEXORA_VOICE_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL=eleven_multilingual_v2
```

Provider secrets are server-only.

## Governance

Voice is presentation only. It cannot:

- authorize a financial action;
- bypass the Policy Engine;
- bypass Human Gate;
- modify autonomy;
- modify memory policy.

The response delivered to voice is the same response that passed LIA response evaluation.

## Nexo responsibilities

Nexo owns:

- conversation surface;
- microphone interaction;
- spoken response playback;
- user-visible cognitive status;
- live financial observation prompts.

LIA owns:

- intent;
- reasoning;
- evidence;
- tool execution;
- response evaluation;
- governance;
- learning boundaries.

This keeps Nexo lightweight and prevents the mascot/UI from becoming an authority layer.
