import { CurrencyDollar } from '@phosphor-icons/react'
import PlaceholderPage from '../components/PlaceholderPage'

const Billing = () => {
  return (
    <PlaceholderPage
      icon={<CurrencyDollar size={30} weight="fill" />}
      title="Billing & Invoices"
      description="Track invoices, payments, insurance claims, and outstanding balances."
      accent="violet"
      rows={['Invoice #2026-0148 · $850.00', 'Invoice #2026-0151 · $120.00', 'Claim #A-4412 · Pending', 'Payment received · $350.00']}
    />
  )
}

export default Billing