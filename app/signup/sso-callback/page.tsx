import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { SignedUpTracker } from "./SignedUpTracker";

export default function Page() {
  return (
    <>
      <SignedUpTracker />
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/app/packs" signUpFallbackRedirectUrl="/app/packs" />
    </>
  );
}
