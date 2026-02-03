export default function PaymentSuccessLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Override parent layout - completely cover sidebar and mobile nav
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'linear-gradient(135deg, #1e1b4b 0%, #581c87 50%, #1e1b4b 100%)',
      overflow: 'auto'
    }}>
      {children}
    </div>
  )
}
