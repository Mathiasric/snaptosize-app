import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function Page() {
  return <AuthenticateWithRedirectCallback afterSignInUrl="/app/packs" afterSignUpUrl="/app/packs" />;
}
