import SwietaTabs from "@/components/SwietaTabs";

export default function SwietaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">
          Święta <span className="xmas-title-star">✦</span>
        </h1>
        <p className="text-sm text-muted">Świąteczny kącik ekipy · prezenty i nie tylko</p>
      </div>
      <SwietaTabs />
      {children}
    </div>
  );
}
