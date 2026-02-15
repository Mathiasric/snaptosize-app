import { UserButton } from "@clerk/nextjs";

export default function AppPage() {
  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>SnapToSize App</h1>
        <UserButton />
      </div>
      <p>Du er logget inn.</p>
    </main>
  );
}
