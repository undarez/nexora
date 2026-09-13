# Nexo voice providers

## Hume

Recommended first provider for Nexo. The server adapter uses Hume Octave TTS through `POST /v0/tts` and can select a saved voice by ID or name. Keep `HUME_API_KEY` server-side.

```env
NEXORA_VOICE_PROVIDER=hume
HUME_API_KEY=
HUME_VOICE_ID=
HUME_VOICE_NAME=
```

## ElevenLabs

Supported as an alternate provider through the same gateway. The adapter calls the official `/v1/text-to-speech/:voice_id` endpoint.

```env
NEXORA_VOICE_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=
ELEVENLABS_MODEL=eleven_multilingual_v2
```

The browser only calls `/api/lia/voice/synthesize`; provider credentials never cross the browser boundary.
