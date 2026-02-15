import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <SignIn />
    </div>
  );
}
