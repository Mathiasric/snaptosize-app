import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function Page() {
  return <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/app/packs" signUpFallbackRedirectUrl="/app/packs" />;
}
