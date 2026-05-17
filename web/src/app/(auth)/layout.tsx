export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full items-center justify-center overflow-y-auto p-6">
      {children}
    </div>
  );
}
