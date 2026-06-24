export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-screen">
      <div className="auth-card">{children}</div>
    </div>
  );
}
