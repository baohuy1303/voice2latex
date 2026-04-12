from google.cloud import speech


def transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe audio bytes using Google Cloud Speech-to-Text.

    Expects WebM/Opus audio from browser MediaRecorder.
    """
    client = speech.SpeechClient()

    audio = speech.RecognitionAudio(content=audio_bytes)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
        sample_rate_hertz=48000,
        language_code="en-US",
        enable_automatic_punctuation=True,
        model="latest_long",
    )

    response = client.recognize(config=config, audio=audio)

    transcript = " ".join(
        result.alternatives[0].transcript
        for result in response.results
        if result.alternatives
    )

    return transcript.strip()
