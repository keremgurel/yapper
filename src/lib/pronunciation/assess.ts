import type { AzureSegment } from "./summarize";

/**
 * Run Azure's pronunciation assessment on a WAV file from the browser, using a
 * short-lived token so the subscription key never leaves the server. The
 * speaker was not reading a script, so there is no reference text: the service
 * scores what it hears. Resolves with one entry per recognised phrase.
 *
 * The SDK is large, so it is loaded only when a rep is actually assessed.
 */
export async function assessPronunciation(
  wav: File,
  auth: { token: string; region: string },
): Promise<AzureSegment[]> {
  const sdk = await import("microsoft-cognitiveservices-speech-sdk");
  const speech = sdk.SpeechConfig.fromAuthorizationToken(
    auth.token,
    auth.region,
  );
  speech.speechRecognitionLanguage = "en-US";
  const assessment = new sdk.PronunciationAssessmentConfig(
    "",
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    false,
  );
  assessment.enableProsodyAssessment = true;
  const recognizer = new sdk.SpeechRecognizer(
    speech,
    sdk.AudioConfig.fromWavFileInput(wav),
  );
  assessment.applyTo(recognizer);

  const segments: AzureSegment[] = [];
  try {
    await new Promise<void>((resolve, reject) => {
      recognizer.recognized = (_sender, event) => {
        if (event.result.reason !== sdk.ResultReason.RecognizedSpeech) return;
        const json = event.result.properties.getProperty(
          sdk.PropertyId.SpeechServiceResponse_JsonResult,
        );
        try {
          segments.push(JSON.parse(json) as AzureSegment);
        } catch {
          // One unreadable phrase should not lose the rest.
        }
      };
      recognizer.sessionStopped = () => resolve();
      // The end of the file arrives as a cancellation with no error.
      recognizer.canceled = (_sender, event) =>
        event.reason === sdk.CancellationReason.Error
          ? reject(new Error(event.errorDetails))
          : resolve();
      recognizer.startContinuousRecognitionAsync(undefined, reject);
    });
  } finally {
    recognizer.close();
  }
  return segments;
}
