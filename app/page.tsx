import Link from "next/link";

export default function Home() {
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", gap: 12 }}>
      <h1>SnapToSize</h1>
      <Link href="/dashboard">Go to app</Link>
      <Link href="/login">Login</Link>
      <Link href="/signup">Sign up</Link>
    </main>
  );
}
