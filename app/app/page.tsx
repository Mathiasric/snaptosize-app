import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function AppPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/login");
  }

  const primaryEmail = user.emailAddresses.find(
    (e) => e.id === user.primaryEmailAddressId
  )?.emailAddress;

  return (
    <div className="flex min-h-[calc(100vh-57px)] items-center justify-center">
      <div className="w-full max-w-md rounded-xl border border-black/10 p-8 dark:border-white/10">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">
          Dashboard
        </h1>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-foreground/50">Status</dt>
            <dd className="mt-1 font-medium">Logged in</dd>
          </div>
          <div>
            <dt className="text-foreground/50">User ID</dt>
            <dd className="mt-1 font-mono text-xs break-all">{user.id}</dd>
          </div>
          <div>
            <dt className="text-foreground/50">Primary email</dt>
            <dd className="mt-1">{primaryEmail ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
