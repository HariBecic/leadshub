export default function PaymentSuccessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Override parent layout - no sidebar or navigation
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {children}
    </div>
  )
}
