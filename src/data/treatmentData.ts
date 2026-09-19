import type {
  CareProvider,
  InsuranceBenefit,
  PatientSummary,
  PlanFilterKey,
  PlanStatus,
  TreatmentPlan,
  TreatmentProcedure,
  TreatmentPhase,
} from '../types'

// ---------------------------------------------------------------------------
// Static demo data for the Treatment Plans workspace. Replace with SQLite
// repositories + Electron IPC services later without touching the UI.
// ---------------------------------------------------------------------------

export const AS_OF_DATE = '2026-05-26'

export const PATIENTS: PatientSummary[] = [
  { id: 'PT-2024-0891', name: 'Maria Lawson', initials: 'ML', age: 28, gender: 'Female', phone: '+1 (555) 012-3456', dob: '1998-04-12' },
  { id: 'PT-2024-0412', name: 'James Carter', initials: 'JC', age: 45, gender: 'Male', phone: '+1 (555) 789-0123', dob: '1981-09-03' },
  { id: 'PT-2024-1102', name: 'Priya Nair', initials: 'PN', age: 32, gender: 'Female', phone: '+1 (555) 234-5678', dob: '1994-01-27' },
  { id: 'PT-2023-0941', name: 'Robert Hayes', initials: 'RH', age: 58, gender: 'Male', phone: '+1 (555) 345-6789', dob: '1968-07-15' },
  { id: 'PT-2024-0219', name: 'Emily Brooks', initials: 'EB', age: 22, gender: 'Female', phone: '+1 (555) 678-9012', dob: '2004-11-30' },
  { id: 'PT-2023-0507', name: 'Kim Silva', initials: 'KS', age: 39, gender: 'Female', phone: '+1 (555) 987-6543', dob: '1987-05-21' },
]

export const PROVIDERS: CareProvider[] = [
  { id: 'DOC-01', name: 'Dr. Smith', role: 'Lead Dentist', title: 'DDS' },
  { id: 'DOC-02', name: 'Dr. Lee', role: 'Prosthodontist', title: 'DDS, MPH' },
  { id: 'DOC-03', name: 'Dr. Patel', role: 'Endodontist', title: 'DDS' },
  { id: 'DOC-04', name: 'Dr. Chen', role: 'Oral Surgeon', title: 'DMD' },
]

export const COORDINATORS: CareProvider[] = [
  { id: 'COR-01', name: 'Maya Gomez', role: 'Treatment Coordinator', title: '' },
  { id: 'COR-02', name: 'Luke Adams', role: 'Insurance Coordinator', title: '' },
]

export const INSURANCE: InsuranceBenefit[] = [
  {
    id: 'INS-01',
    provider: 'Delta Dental Premier',
    policyNumber: 'PPO 88123',
    groupNumber: 'DEL-4471',
    coveragePercent: 70,
    annualMaximum: 2000,
    usedThisYear: 1250,
    eligibilityStatus: 'verified',
    preAuthStatus: 'requested',
    lastVerified: '2026-05-22',
  },
  {
    id: 'INS-02',
    provider: 'Cigna Dental 1000',
    policyNumber: 'DHMO 22914',
    groupNumber: 'CIG-9012',
    coveragePercent: 50,
    annualMaximum: 1000,
    usedThisYear: 320,
    eligibilityStatus: 'verified',
    preAuthStatus: 'approved',
    lastVerified: '2026-05-18',
  },
  {
    id: 'INS-03',
    provider: 'MetLife PDP',
    policyNumber: 'MET-77310',
    groupNumber: 'MTL-2234',
    coveragePercent: 80,
    annualMaximum: 1500,
    usedThisYear: 900,
    eligibilityStatus: 'pending',
    preAuthStatus: 'not_required',
    lastVerified: '2026-05-06',
  },
]

const procedure = (data: Partial<TreatmentProcedure> & Pick<TreatmentProcedure, 'id' | 'procedureName' | 'code' | 'category'>): TreatmentProcedure => ({
  planId: '',
  phaseId: '',
  toothSelection: { numbering: 'universal', teeth: [] },
  providerId: 'DOC-01',
  status: 'planned',
  plannedDate: null,
  scheduledDate: null,
  completedDate: null,
  fee: 0,
  insuranceEstimate: 0,
  patientResponsibility: 0,
  notes: '',
  ...data,
})

const phase = (data: TreatmentPhase): TreatmentPhase => ({
  ...data,
  procedures: data.procedures.map((p) => ({ ...p, planId: data.planId, phaseId: data.id })),
})

const plan = (data: TreatmentPlan): TreatmentPlan => ({
  ...data,
  phases: data.phases.map((p) => ({ ...p, procedures: p.procedures.map((pz) => ({ ...pz, planId: data.id, phaseId: p.id })) })),
})

export const INITIAL_PLANS: TreatmentPlan[] = [
  plan({
    id: 'PLAN-1042',
    title: 'Full-Mouth Restoration',
    description:
      'Restore posterior function with full-coverage crowns on #2, #3, #14 and #15, an endo retreat on #19, and final occlusal seal. Reviewed with patient on 05/14.',
    status: 'pending_approval',
    patient: PATIENTS[1],
    doctorId: 'DOC-02',
    coordinatorId: 'COR-02',
    insuranceId: 'INS-01',
    createdAt: '2026-05-14',
    updatedAt: '2026-05-25',
    phases: [
      phase({
        id: 'PH-1042-1',
        planId: 'PLAN-1042',
        name: 'Diagnostics & Records',
        order: 1,
        description: 'Initial evaluation, imaging and consent.',
        procedures: [
          procedure({
            id: 'PR-1042-11',
            procedureName: 'Comprehensive Oral Evaluation',
            code: 'D0150',
            category: 'Diagnostic',
            providerId: 'DOC-02',
            status: 'completed',
            completedDate: '2026-05-16',
            fee: 85,
            insuranceEstimate: 60,
            patientResponsibility: 25,
            notes: 'Full perio charting completed.',
          }),
          procedure({
            id: 'PR-1042-12',
            procedureName: 'Full-Mouth X-ray Series',
            code: 'D0210',
            category: 'Diagnostic',
            providerId: 'DOC-02',
            status: 'completed',
            completedDate: '2026-05-16',
            fee: 140,
            insuranceEstimate: 98,
            patientResponsibility: 42,
          }),
        ],
      }),
      phase({
        id: 'PH-1042-2',
        planId: 'PLAN-1042',
        name: 'Restorative Phase',
        order: 2,
        description: 'Full-coverage crowns and endodontic retreat.',
        procedures: [
          procedure({
            id: 'PR-1042-21',
            procedureName: 'Crown – Porcelain/Ceramic',
            code: 'D2740',
            category: 'Restorative',
            toothSelection: { numbering: 'universal', teeth: [3] },
            providerId: 'DOC-02',
            status: 'scheduled',
            plannedDate: '2026-05-21',
            scheduledDate: '2026-06-02',
            fee: 1080,
            insuranceEstimate: 700,
            patientResponsibility: 380,
            notes: 'Temporization at first prep visit.',
          }),
          procedure({
            id: 'PR-1042-22',
            procedureName: 'Crown – Porcelain/Ceramic',
            code: 'D2740',
            category: 'Restorative',
            toothSelection: { numbering: 'universal', teeth: [14] },
            providerId: 'DOC-02',
            status: 'scheduled',
            plannedDate: '2026-05-21',
            scheduledDate: '2026-06-09',
            fee: 1080,
            insuranceEstimate: 700,
            patientResponsibility: 380,
          }),
          procedure({
            id: 'PR-1042-23',
            procedureName: 'Endodontic Retreatment – Molar',
            code: 'D3346',
            category: 'Endodontics',
            toothSelection: { numbering: 'universal', teeth: [19] },
            providerId: 'DOC-03',
            status: 'planned',
            plannedDate: '2026-06-16',
            fee: 890,
            insuranceEstimate: 623,
            patientResponsibility: 267,
            notes: 'Chronically failing composite; retreat before crown.',
          }),
          procedure({
            id: 'PR-1042-24',
            procedureName: 'Crown – Porcelain/Ceramic',
            code: 'D2740',
            category: 'Restorative',
            toothSelection: { numbering: 'universal', teeth: [2] },
            providerId: 'DOC-02',
            status: 'planned',
            plannedDate: '2026-07-07',
            fee: 1045,
            insuranceEstimate: 700,
            patientResponsibility: 345,
          }),
        ],
      }),
      phase({
        id: 'PH-1042-3',
        planId: 'PLAN-1042',
        name: 'Maintenance',
        order: 3,
        description: 'Post-restoration recall.',
        procedures: [
          procedure({
            id: 'PR-1042-31',
            procedureName: 'Recall Examination',
            code: 'D0120',
            category: 'Preventive',
            status: 'planned',
            plannedDate: '2026-08-04',
            fee: 55,
            insuranceEstimate: 39,
            patientResponsibility: 16,
          }),
        ],
      }),
    ],
  }),
  plan({
    id: 'PLAN-1041',
    title: 'Clear Aligners Program',
    description:
      'Full-arch clear aligner therapy for alignment of #7-#10 overbite correction. 14 aligner steps with refinement visits.',
    status: 'approved',
    patient: PATIENTS[0],
    doctorId: 'DOC-01',
    coordinatorId: 'COR-01',
    insuranceId: 'INS-02',
    createdAt: '2026-04-28',
    updatedAt: '2026-05-24',
    phases: [
      phase({
        id: 'PH-1041-1',
        planId: 'PLAN-1041',
        name: 'Records & Scans',
        order: 1,
        description: 'Digital impressions and case planning.',
        procedures: [
          procedure({
            id: 'PR-1041-11',
            procedureName: 'Digital Impressions / Scans',
            code: 'D0370',
            category: 'Diagnostic',
            providerId: 'DOC-01',
            status: 'completed',
            completedDate: '2026-05-05',
            fee: 250,
            insuranceEstimate: 0,
            patientResponsibility: 250,
          }),
          procedure({
            id: 'PR-1041-12',
            procedureName: 'Orthodontic Records',
            code: 'D0350',
            category: 'Diagnostic',
            providerId: 'DOC-01',
            status: 'completed',
            completedDate: '2026-05-05',
            fee: 120,
            insuranceEstimate: 0,
            patientResponsibility: 120,
          }),
        ],
      }),
      phase({
        id: 'PH-1041-2',
        planId: 'PLAN-1041',
        name: 'Active Alignment',
        order: 2,
        description: 'Comprehensive orthodontic treatment.',
        procedures: [
          procedure({
            id: 'PR-1041-21',
            procedureName: 'Comprehensive Orthodontic Treatment – Adult',
            code: 'D8080',
            category: 'Orthodontics',
            providerId: 'DOC-01',
            status: 'scheduled',
            plannedDate: '2026-06-01',
            scheduledDate: '2026-06-08',
            fee: 3800,
            insuranceEstimate: 1500,
            patientResponsibility: 2300,
            notes: '14-step plan; 3 refinement rounds budgeted.',
          }),
          procedure({
            id: 'PR-1041-22',
            procedureName: 'Retainer',
            code: 'D8680',
            category: 'Orthodontics',
            status: 'planned',
            plannedDate: '2026-11-10',
            fee: 320,
            insuranceEstimate: 150,
            patientResponsibility: 170,
          }),
        ],
      }),
    ],
  }),
  plan({
    id: 'PLAN-1043',
    title: 'Whitening & Esthetics',
    description: 'In-office power whitening with take-home trays and facial composite bonding on #8/#9.',
    status: 'draft',
    patient: PATIENTS[2],
    doctorId: 'DOC-01',
    coordinatorId: 'COR-01',
    insuranceId: 'INS-03',
    createdAt: '2026-05-20',
    updatedAt: '2026-05-21',
    phases: [
      phase({
        id: 'PH-1043-1',
        planId: 'PLAN-1043',
        name: 'Esthetic Phase',
        order: 1,
        description: 'Whitening and anterior bonding.',
        procedures: [
          procedure({
            id: 'PR-1043-11',
            procedureName: 'In-Office Bleaching – Per Arch',
            code: 'D9972',
            category: 'Cosmetic',
            providerId: 'DOC-01',
            status: 'planned',
            plannedDate: '2026-06-15',
            fee: 550,
            insuranceEstimate: 0,
            patientResponsibility: 550,
          }),
          procedure({
            id: 'PR-1043-12',
            procedureName: 'Whitening Trays – Maxillary & Mandibular',
            code: 'D9972',
            category: 'Cosmetic',
            providerId: 'DOC-01',
            status: 'planned',
            plannedDate: '2026-06-15',
            fee: 220,
            insuranceEstimate: 0,
            patientResponsibility: 220,
          }),
          procedure({
            id: 'PR-1043-13',
            procedureName: 'Resin-Based Composite – Facial',
            code: 'D2394',
            category: 'Restorative',
            toothSelection: { numbering: 'universal', teeth: [8, 9] },
            providerId: 'DOC-01',
            status: 'planned',
            plannedDate: '2026-07-01',
            fee: 590,
            insuranceEstimate: 0,
            patientResponsibility: 590,
          }),
        ],
      }),
    ],
  }),
  plan({
    id: 'PLAN-1039',
    title: 'Implant Restoration #19 & #30',
    description:
      'Surgical implant placement for missing first molars with implant-supported crowns and final occlusion adjustments.',
    status: 'scheduled',
    patient: PATIENTS[3],
    doctorId: 'DOC-04',
    coordinatorId: 'COR-02',
    insuranceId: 'INS-01',
    createdAt: '2026-05-02',
    updatedAt: '2026-05-23',
    phases: [
      phase({
        id: 'PH-1039-1',
        planId: 'PLAN-1039',
        name: 'Surgical Phase',
        order: 1,
        description: 'Implant placement and healing.',
        procedures: [
          procedure({
            id: 'PR-1039-11',
            procedureName: 'Surgical Implant Placement – Endosteal',
            code: 'D6010',
            category: 'Oral Surgery',
            toothSelection: { numbering: 'universal', teeth: [19] },
            providerId: 'DOC-04',
            status: 'scheduled',
            plannedDate: '2026-05-28',
            scheduledDate: '2026-06-03',
            fee: 1650,
            insuranceEstimate: 1000,
            patientResponsibility: 650,
            notes: 'CBCT-guided; bone density D2.',
          }),
          procedure({
            id: 'PR-1039-12',
            procedureName: 'Surgical Implant Placement – Endosteal',
            code: 'D6010',
            category: 'Oral Surgery',
            toothSelection: { numbering: 'universal', teeth: [30] },
            providerId: 'DOC-04',
            status: 'scheduled',
            plannedDate: '2026-06-17',
            scheduledDate: '2026-06-24',
            fee: 1650,
            insuranceEstimate: 1000,
            patientResponsibility: 650,
          }),
        ],
      }),
      phase({
        id: 'PH-1039-2',
        planId: 'PLAN-1039',
        name: 'Restorative Phase',
        order: 2,
        description: 'Implant-supported crowns after osseointegration.',
        procedures: [
          procedure({
            id: 'PR-1039-21',
            procedureName: 'Implant-Supported Crown',
            code: 'D6065',
            category: 'Prosthodontics',
            toothSelection: { numbering: 'universal', teeth: [19] },
            providerId: 'DOC-02',
            status: 'planned',
            plannedDate: '2026-08-05',
            fee: 1280,
            insuranceEstimate: 850,
            patientResponsibility: 430,
          }),
          procedure({
            id: 'PR-1039-22',
            procedureName: 'Implant-Supported Crown',
            code: 'D6065',
            category: 'Prosthodontics',
            toothSelection: { numbering: 'universal', teeth: [30] },
            providerId: 'DOC-02',
            status: 'planned',
            plannedDate: '2026-08-05',
            fee: 1280,
            insuranceEstimate: 850,
            patientResponsibility: 430,
          }),
          procedure({
            id: 'PR-1039-23',
            procedureName: 'Occlusal Adjustment',
            code: 'D9971',
            category: 'Prosthodontics',
            status: 'planned',
            plannedDate: '2026-08-19',
            fee: 120,
            insuranceEstimate: 84,
            patientResponsibility: 36,
          }),
        ],
      }),
    ],
  }),
  plan({
    id: 'PLAN-1040',
    title: 'Preventive Care Plan',
    description: 'Routine prophylaxis, fluoride, and sealants with a 6-month recall cadence.',
    status: 'in_progress',
    patient: PATIENTS[4],
    doctorId: 'DOC-01',
    coordinatorId: 'COR-01',
    insuranceId: 'INS-03',
    createdAt: '2026-05-11',
    updatedAt: '2026-05-25',
    phases: [
      phase({
        id: 'PH-1040-1',
        planId: 'PLAN-1040',
        name: 'Preventive Phase',
        order: 1,
        description: 'Cleanings, fluoride and sealants.',
        procedures: [
          procedure({
            id: 'PR-1040-11',
            procedureName: 'Periodic Oral Evaluation',
            code: 'D0120',
            category: 'Diagnostic',
            providerId: 'DOC-01',
            status: 'completed',
            completedDate: '2026-05-12',
            fee: 55,
            insuranceEstimate: 55,
            patientResponsibility: 0,
          }),
          procedure({
            id: 'PR-1040-12',
            procedureName: 'Adult Prophylaxis',
            code: 'D1110',
            category: 'Preventive',
            providerId: 'DOC-01',
            status: 'in_progress',
            plannedDate: '2026-05-12',
            fee: 110,
            insuranceEstimate: 110,
            patientResponsibility: 0,
          }),
          procedure({
            id: 'PR-1040-13',
            procedureName: 'Topical Fluoride Varnish',
            code: 'D1208',
            category: 'Preventive',
            providerId: 'DOC-01',
            status: 'planned',
            plannedDate: '2026-11-12',
            fee: 45,
            insuranceEstimate: 45,
            patientResponsibility: 0,
          }),
          procedure({
            id: 'PR-1040-14',
            procedureName: 'Sealant – Per Tooth',
            code: 'D1351',
            category: 'Preventive',
            toothSelection: { numbering: 'universal', teeth: [4, 13] },
            providerId: 'DOC-01',
            status: 'planned',
            plannedDate: '2026-11-12',
            fee: 130,
            insuranceEstimate: 104,
            patientResponsibility: 26,
          }),
        ],
      }),
    ],
  }),
  plan({
    id: 'PLAN-1032',
    title: 'Molar Endo & Crown',
    description: 'Root canal therapy on #30 with porcelain crown. Completed May 2026.',
    status: 'completed',
    patient: PATIENTS[5],
    doctorId: 'DOC-03',
    coordinatorId: 'COR-02',
    insuranceId: 'INS-01',
    createdAt: '2026-04-02',
    updatedAt: '2026-05-10',
    phases: [
      phase({
        id: 'PH-1032-1',
        planId: 'PLAN-1032',
        name: 'Endodontics',
        order: 1,
        description: 'Root canal therapy.',
        procedures: [
          procedure({
            id: 'PR-1032-11',
            procedureName: 'Molar Root Canal Therapy',
            code: 'D3330',
            category: 'Endodontics',
            toothSelection: { numbering: 'universal', teeth: [30] },
            providerId: 'DOC-03',
            status: 'completed',
            completedDate: '2026-04-10',
            fee: 980,
            insuranceEstimate: 686,
            patientResponsibility: 294,
            notes: 'Single visit; obtured with warm vertical condensation.',
          }),
        ],
      }),
      phase({
        id: 'PH-1032-2',
        planId: 'PLAN-1032',
        name: 'Restorative',
        order: 2,
        description: 'Final crown.',
        procedures: [
          procedure({
            id: 'PR-1032-21',
            procedureName: 'Crown – Porcelain/Ceramic',
            code: 'D2740',
            category: 'Restorative',
            toothSelection: { numbering: 'universal', teeth: [30] },
            providerId: 'DOC-02',
            status: 'completed',
            completedDate: '2026-05-09',
            fee: 1085,
            insuranceEstimate: 700,
            patientResponsibility: 385,
          }),
        ],
      }),
    ],
  }),
]

export const RECENTLY_UPDATED = ['PLAN-1042', 'PLAN-1040', 'PLAN-1041']

// ---------------------------------------------------------------------------
// Domain helpers (pure functions over the typed model)
// ---------------------------------------------------------------------------

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const planProcedures = (p: TreatmentPlan): TreatmentProcedure[] =>
  p.phases.flatMap((ph) => ph.procedures)

export const planFinancials = (p: TreatmentPlan) => {
  const procedures = planProcedures(p)
  const estimatedValue = procedures.reduce((sum, pr) => sum + pr.fee, 0)
  const insuranceContribution = procedures.reduce((sum, pr) => sum + pr.insuranceEstimate, 0)
  const patientShare = procedures.reduce((sum, pr) => sum + pr.patientResponsibility, 0)
  const completedCount = procedures.filter((pr) => pr.status === 'completed').length
  const totalCount = procedures.length
  const coveragePercent =
    estimatedValue > 0 ? Math.round((insuranceContribution / estimatedValue) * 100) : 0
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  return {
    estimatedValue,
    insuranceContribution,
    patientShare,
    completedCount,
    totalCount,
    coveragePercent,
    progressPercent,
  }
}

export const planPatients = (): PatientSummary[] => PATIENTS

export const PATIENT_BY_ID = new Map(PATIENTS.map((p) => [p.id, p]))
export const PROVIDER_BY_ID = new Map(PROVIDERS.map((p) => [p.id, p]))
export const COORDINATOR_BY_ID = new Map(COORDINATORS.map((p) => [p.id, p]))
export const INSURANCE_BY_ID = new Map(INSURANCE.map((p) => [p.id, p]))

export const FILTER_MATCHES: Record<PlanFilterKey, (status: PlanStatus) => boolean> = {
  all: () => true,
  active: (s) => s === 'in_progress' || s === 'scheduled' || s === 'approved',
  pending: (s) => s === 'pending_approval',
  draft: (s) => s === 'draft',
  approved: (s) => s === 'approved',
  scheduled: (s) => s === 'scheduled',
}

export interface ProcedureCatalogEntry {
  code: string
  name: string
  category: TreatmentProcedure['category']
  defaultFee: number
}

export const PROCEDURE_CATALOG: ProcedureCatalogEntry[] = [
  { code: 'D0150', name: 'Comprehensive Oral Evaluation', category: 'Diagnostic', defaultFee: 85 },
  { code: 'D0120', name: 'Periodic Oral Evaluation', category: 'Diagnostic', defaultFee: 55 },
  { code: 'D0210', name: 'Full-Mouth X-ray Series', category: 'Diagnostic', defaultFee: 140 },
  { code: 'D0330', name: 'Panoramic Image', category: 'Diagnostic', defaultFee: 110 },
  { code: 'D1110', name: 'Adult Prophylaxis', category: 'Preventive', defaultFee: 110 },
  { code: 'D1208', name: 'Topical Fluoride Varnish', category: 'Preventive', defaultFee: 45 },
  { code: 'D1351', name: 'Sealant – Per Tooth', category: 'Preventive', defaultFee: 65 },
  { code: 'D2140', name: 'Amalgam – One Surface', category: 'Restorative', defaultFee: 165 },
  { code: 'D2391', name: 'Resin Composite – One Surface', category: 'Restorative', defaultFee: 195 },
  { code: 'D2740', name: 'Crown – Porcelain/Ceramic', category: 'Restorative', defaultFee: 1080 },
  { code: 'D3330', name: 'Molar Root Canal Therapy', category: 'Endodontics', defaultFee: 980 },
  { code: 'D3346', name: 'Endodontic Retreatment – Molar', category: 'Endodontics', defaultFee: 890 },
  { code: 'D4341', name: 'Scaling & Root Planing – Per Quad', category: 'Periodontics', defaultFee: 290 },
  { code: 'D6010', name: 'Surgical Implant Placement', category: 'Oral Surgery', defaultFee: 1650 },
  { code: 'D6065', name: 'Implant-Supported Crown', category: 'Prosthodontics', defaultFee: 1280 },
  { code: 'D8080', name: 'Comprehensive Orthodontics – Adult', category: 'Orthodontics', defaultFee: 3800 },
]