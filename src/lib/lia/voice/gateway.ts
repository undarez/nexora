export type VoiceProvider = "hume" | "elevenlabs";
export type VoiceRequest = { text:string; provider?:VoiceProvider; voiceId?:string; voiceName?:string; style?:string };

function cleanText(text:string){return text.trim().slice(0,5000);}

async function hume(request:VoiceRequest){
  const key=process.env.HUME_API_KEY;
  if(!key) throw new Error("HUME_API_KEY n'est pas configurée.");
  const utterance:any={text:cleanText(request.text)};
  if(request.voiceId) utterance.voice={id:request.voiceId};
  else if(request.voiceName) utterance.voice={name:request.voiceName,provider:"HUME_AI"};
  if(request.style) utterance.description=request.style.slice(0,1000);
  const r=await fetch("https://api.hume.ai/v0/tts",{method:"POST",headers:{"Content-Type":"application/json","X-Hume-Api-Key":key},body:JSON.stringify({utterances:[utterance],format:{type:"mp3"}}),cache:"no-store"});
  if(!r.ok) throw new Error(`Hume TTS HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

async function elevenlabs(request:VoiceRequest){
  const key=process.env.ELEVENLABS_API_KEY;
  const voice=request.voiceId||process.env.ELEVENLABS_VOICE_ID;
  if(!key||!voice) throw new Error("ELEVENLABS_API_KEY et ELEVENLABS_VOICE_ID sont requis.");
  const r=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}`,{method:"POST",headers:{"Content-Type":"application/json","xi-api-key":key},body:JSON.stringify({text:cleanText(request.text),model_id:process.env.ELEVENLABS_MODEL||"eleven_multilingual_v2"}),cache:"no-store"});
  if(!r.ok) throw new Error(`ElevenLabs TTS HTTP ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

export async function synthesizeVoice(request:VoiceRequest){
  const provider=request.provider||((process.env.NEXORA_VOICE_PROVIDER as VoiceProvider)||"hume");
  if(provider === "elevenlabs") return elevenlabs(request);
  return hume(request);
}
