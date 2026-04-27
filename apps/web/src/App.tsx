import { UserList } from "./features/user/UserList.js";

const ARCH_BADGES = [
  "Clean Architecture",
  "DDD",
  "CQRS",
  "Event Sourcing",
  "Repository Pattern",
  "Dependency Inversion",
];

export default function App() {
  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-logo">⚡</div>
          <span className="header-title">Monorepo</span>
          <span className="header-badge">ElysiaJS + Vite</span>
        </div>
      </header>

      {/* Main */}
      <main className="main">
        {/* Hero */}
        <section className="hero">
          <p className="hero-eyebrow">Turborepo + Bun</p>
          <h1>Production-Ready<br />Monorepo Boilerplate</h1>
          <p className="hero-sub">
            ElysiaJS backend · Vite + React frontend · PostgreSQL + Prisma · Full DDD architecture
          </p>
          <div className="arch-badges">
            {ARCH_BADGES.map((b) => (
              <span key={b} className="arch-badge">{b}</span>
            ))}
          </div>
        </section>

        {/* Feature area */}
        <UserList />
      </main>
    </div>
  );
}
