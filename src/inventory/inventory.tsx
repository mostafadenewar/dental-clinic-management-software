import { Tray } from '@phosphor-icons/react'
import PlaceholderPage from '../components/PlaceholderPage'

const Inventory = () => {
  return (
    <PlaceholderPage
      icon={<Tray size={30} weight="fill" />}
      title="Inventory"
      description="Manage dental supplies, stock levels, reorder points, and suppliers."
      accent="amber"
      rows={['Composite Resin · Low stock (12)', 'Dental Floss · In stock (80)', 'Impression Trays · Reorder at 20', 'Anesthetic Cartridges · In stock (150)']}
    />
  )
}

export default Inventory