import { createContext, useContext } from 'react'
import type { CareProvider, InsurancePlan, StorageLocation } from '../types'
import type { PatientRecord, ProcedureCatalogEntry } from './client'

export interface Lookups {
  patients: PatientRecord[]
  providers: CareProvider[]
  coordinators: CareProvider[]
  insurance: InsurancePlan[]
  catalog: ProcedureCatalogEntry[]
  locations: StorageLocation[]
  refreshing: boolean
  refresh: () => Promise<void>
}

export const EMPTY_LOOKUPS: Lookups = {
  patients: [],
  providers: [],
  coordinators: [],
  insurance: [],
  catalog: [],
  locations: [],
  refreshing: false,
  refresh: async () => {},
}

export const LookupsContext = createContext<Lookups>(EMPTY_LOOKUPS)

export const useLookups = (): Lookups => useContext(LookupsContext)
