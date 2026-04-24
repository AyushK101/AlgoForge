export default function ProfilePage() {
  return (
    <main className="page">
      <section className="panel" style={{ padding: 16 }}>
        <h1>Profile</h1>
        <p className="muted">
          Auth wiring is intentionally isolated for the rewrite. The API already accepts `x-user-id` for local
          development; OAuth/session integration can be added without touching judge execution.
        </p>
      </section>
    </main>
  );
}
