import { FileText } from '@phosphor-icons/react'
import PlaceholderPage from '../components/PlaceholderPage'

const TreatmentPlans = () => {
  return (
    <PlaceholderPage
      icon={<FileText size={30} weight="fill" />}
      title="Treatment Plans"
      description="Create and manage patient treatment plans, procedures, and follow-up schedules."
      accent="blue"
      rows={['Clear Aligners · 3 months', 'Implant Restoration · 2 visits', 'Whitening Program · 4 sessions', 'Orthodontic Review · ongoing']}
    />
  )
}

export default TreatmentPlans