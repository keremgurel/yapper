/** The steps to switch an Instagram account to Professional (Creator/Business),
 * the one hard requirement for API posting. Shown upfront in the Instagram
 * compose body and again if a post fails because the account is still personal. */
export default function ProfessionalAccountHelp() {
  return (
    <div className="text-muted-foreground text-xs">
      <p>
        Instagram only lets apps post to Business or Creator accounts. Switching
        is free and takes about 30 seconds:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-4">
        <li>Open Instagram and go to your profile</li>
        <li>Tap the menu, then Settings and privacy</li>
        <li>Account type and tools, then Switch to professional account</li>
        <li>Choose Creator (or Business) and finish</li>
      </ol>
      <p className="mt-2">
        Then come back and post again. You do not need to reconnect.
      </p>
    </div>
  );
}
