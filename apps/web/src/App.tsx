import { zodResolver } from '@hookform/resolvers/zod'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { BrowserRouter, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { apiClient } from '@nexora/api-client'
import type { AuthSession, BootstrapCompanyInput, Incident, IncidentListQuery, IncidentPriority, IncidentStatus, RegisterUserInput, Team, User } from '@nexora/types'
import './App.css'

const queryClient = new QueryClient()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const authTokenKey = 'nexora-auth-token'
const statuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'] as const
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const
const incidentSortOptions: Array<{ value: NonNullable<IncidentListQuery['sortBy']>; label: string }> = [
  { value: 'created_at', label: 'Created' },
  { value: 'number', label: 'Number' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
]

const incidentFormSchema = z.object({
  title: z.string().min(3, 'Use at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(priorities),
  status: z.enum(statuses),
  assignment_group: z.string().optional(),
  assigned_to: z.string().optional(),
})

type IncidentFormValues = z.infer<typeof incidentFormSchema>

const userFormSchema = z.object({
  email: z.email('Enter a valid email address'),
  display_name: z.string().min(1, 'Display name is required'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  external_id: z.string().optional(),
  is_active: z.boolean(),
})

type UserFormValues = z.infer<typeof userFormSchema>

const teamFormSchema = z.object({
  name: z.string().min(2, 'Use at least 2 characters'),
  description: z.string().optional(),
  is_active: z.boolean(),
})

type TeamFormValues = z.infer<typeof teamFormSchema>

const companyBootstrapSchema = z.object({
  companyFunctionalId: z.string().min(2),
  companyLegalName: z.string().min(2),
  companyDisplayName: z.string().min(2),
  primaryDomain: z.string().optional(),
  workspaceFunctionalId: z.string().min(2),
  workspaceSlug: z.string().min(2),
  workspaceName: z.string().min(2),
  admin: z.object({
    email: z.email(),
    password: z.string().min(8),
    display_name: z.string().min(1),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
  }),
})

const userRegistrationSchema = z.object({
  companyFunctionalId: z.string().min(2),
  workspaceFunctionalId: z.string().optional(),
  roleCode: z.string().min(2),
  email: z.email(),
  password: z.string().min(8),
  display_name: z.string().min(1),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
})

const loginSchema = z.object({
  companyFunctionalId: z.string().min(2),
  workspaceFunctionalId: z.string().optional(),
  email: z.email(),
  password: z.string().min(8),
})

type CompanyBootstrapValues = z.infer<typeof companyBootstrapSchema>
type UserRegistrationValues = z.infer<typeof userRegistrationSchema>
type LoginValues = z.infer<typeof loginSchema>

interface ProbeResult {
  status: string
  service?: string
  services?: Record<string, string>
}

async function fetchProbe(path: string): Promise<ProbeResult> {
  const response = await fetch(`${apiBaseUrl}${path}`)
  const payload = (await response.json()) as ProbeResult
  if (!response.ok) throw new Error(payload.status)
  return payload
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}

function AppContent() {
  const [accessToken, setAccessToken] = useState(() => window.localStorage.getItem(authTokenKey) ?? '')
  const [session, setSession] = useState<AuthSession | null>(null)

  useEffect(() => {
    if (accessToken) {
      window.localStorage.setItem(authTokenKey, accessToken)
    } else {
      window.localStorage.removeItem(authTokenKey)
    }
  }, [accessToken])

  const sessionQuery = useQuery({
    queryKey: ['auth', 'me', accessToken],
    queryFn: () => apiClient.me(),
    enabled: Boolean(accessToken),
    retry: false,
  })

  useEffect(() => {
    if (sessionQuery.data) {
      setSession(sessionQuery.data)
      if (sessionQuery.data.accessToken && sessionQuery.data.accessToken !== accessToken) {
        setAccessToken(sessionQuery.data.accessToken)
      }
      return
    }

    if (sessionQuery.error) {
      setAccessToken('')
      setSession(null)
      queryClient.clear()
    }
  }, [accessToken, sessionQuery.data, sessionQuery.error])

  const handleAuthenticated = (nextSession: AuthSession) => {
    setSession(nextSession)
    setAccessToken(nextSession.accessToken)
    queryClient.clear()
  }

  const handleLogout = () => {
    setSession(null)
    setAccessToken('')
    queryClient.clear()
  }

  return (
    <BrowserRouter>
      {accessToken ? <Shell session={session} onLogout={handleLogout} /> : <AuthScreen onAuthenticated={handleAuthenticated} />}
    </BrowserRouter>
  )
}

function Shell({ session, onLogout }: { session: AuthSession | null; onLogout: () => void }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace">
        <TopBar session={session} onLogout={onLogout} />
        <main>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/incidents/:id" element={<IncidentDetails />} />
            <Route path="/users" element={<Users />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function Sidebar() {
  const links = [
    ['/', 'Dashboard'],
    ['/incidents', 'Incidents'],
    ['/users', 'Users'],
    ['/teams', 'Teams'],
    ['/settings', 'System'],
  ]

  return (
    <aside className="sidebar">
      <div className="brand">Nexora</div>
      <nav>
        {links.map(([to, label]) => (
          <NavLink key={`${to}-${label}`} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function TopBar({ session, onLogout }: { session: AuthSession | null; onLogout: () => void }) {
  return (
    <header className="topbar">
      <div>
        <strong>Test Console</strong>
        <span>{session?.company?.display_name ?? apiBaseUrl}</span>
      </div>
      <div className="topbar-actions">
        {session ? <span className="topbar-session">{session.user.display_name}</span> : null}
        {session ? <button type="button" className="secondary" onClick={onLogout}>Logout</button> : null}
        <NavLink to="/settings" className="user-chip">API Status</NavLink>
      </div>
    </header>
  )
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<'bootstrap' | 'register' | 'login'>('bootstrap')

  return (
    <div className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">Company onboarding</p>
        <h1>Register a company workspace, add users, and sign in with tenant-scoped access.</h1>
        <p>
          Create the company first, then onboard the first admin, then let the rest of the company register or log in against the same workspace.
        </p>
        <div className="auth-steps">
          <div><strong>1</strong><span>Create company workspace</span></div>
          <div><strong>2</strong><span>Register users</span></div>
          <div><strong>3</strong><span>Log in to the console</span></div>
        </div>
      </section>
      <section className="auth-card">
        <div className="auth-tabs">
          <button type="button" className={mode === 'bootstrap' ? 'active' : 'secondary'} onClick={() => setMode('bootstrap')}>Create company</button>
          <button type="button" className={mode === 'register' ? 'active' : 'secondary'} onClick={() => setMode('register')}>Register user</button>
          <button type="button" className={mode === 'login' ? 'active' : 'secondary'} onClick={() => setMode('login')}>Login</button>
        </div>
        {mode === 'bootstrap' ? <BootstrapCompanyForm onAuthenticated={onAuthenticated} /> : null}
        {mode === 'register' ? <RegisterUserForm onAuthenticated={onAuthenticated} /> : null}
        {mode === 'login' ? <LoginForm onAuthenticated={onAuthenticated} /> : null}
      </section>
    </div>
  )
}

function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

function LoadingState() {
  return <div className="state">Loading...</div>
}

function ErrorState({ message }: { message: string }) {
  return <div className="state error-state">{message}</div>
}

function EmptyState({ message }: { message: string }) {
  return <div className="state">{message}</div>
}

function StatusBadge({ status }: { status: IncidentStatus }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{status.replaceAll('_', ' ')}</span>
}

function PriorityBadge({ priority }: { priority: IncidentPriority }) {
  return <span className={`badge priority-${priority.toLowerCase()}`}>{priority}</span>
}

function Dashboard() {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({ queryKey: ['incidents', 'dashboard'], queryFn: () => apiClient.getIncidents({ pageSize: 50 }) })
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetchProbe('/health'), retry: 1 })
  const readiness = useQuery({ queryKey: ['ready'], queryFn: () => fetchProbe('/ready'), retry: 1 })
  const incidents: Incident[] = data?.data ?? []
  const activeIncidents = incidents.filter((incident) => !['RESOLVED', 'CLOSED'].includes(incident.status))
  const criticalIncidents = incidents.filter((incident) => incident.priority === 'CRITICAL')
  const unassignedIncidents = incidents.filter((incident) => !incident.assigned_to)
  const recentIncidents = incidents.slice(0, 5)
  const serviceReady = health.data?.status === 'ok' && readiness.data?.status === 'ok'
  const metrics = useMemo(() => {
    return {
      open: activeIncidents.length,
      critical: criticalIncidents.length,
      unassigned: unassignedIncidents.length,
      resolved: incidents.length - activeIncidents.length,
    }
  }, [activeIncidents.length, criticalIncidents.length, incidents.length, unassignedIncidents.length])

  const refreshDashboard = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['incidents', 'dashboard'] }),
      queryClient.invalidateQueries({ queryKey: ['health'] }),
      queryClient.invalidateQueries({ queryKey: ['ready'] }),
    ])
  }

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message="Dashboard data is unavailable. Start the API and database, then refresh." />

  const statusCounts = statuses.map((status) => ({ status, count: incidents.filter((incident) => incident.status === status).length }))

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Monitor service health, incident backlog, and the most urgent work from a single command center."
        action={<NavLink to="/incidents" className="user-chip">Open Incidents</NavLink>}
      />
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Service desk command center</p>
          <h2>See the pressure points before they become incidents.</h2>
          <p>
            Nexora surfaces live backlog, unresolved work, and platform status with a more executive-style layout.
          </p>
          <div className="hero-actions">
            <NavLink to="/incidents" className="user-chip">View backlog</NavLink>
            <NavLink to="/settings" className="secondary hero-link">System view</NavLink>
            <button className="secondary" onClick={refreshDashboard}>Refresh data</button>
          </div>
        </div>
        <div className="hero-panel">
          <div className="hero-panel-head">
            <span>Environment</span>
            <strong className={serviceReady ? 'probe-up' : 'probe-down'}>{serviceReady ? 'Healthy' : 'Attention needed'}</strong>
          </div>
          <div className="hero-mini-grid">
            <div>
              <span>Open</span>
              <strong>{metrics.open}</strong>
            </div>
            <div>
              <span>Critical</span>
              <strong>{metrics.critical}</strong>
            </div>
            <div>
              <span>Unassigned</span>
              <strong>{metrics.unassigned}</strong>
            </div>
          </div>
          <div className="hero-feed">
            {recentIncidents.length ? recentIncidents.map((incident) => (
              <div key={incident.id} className="hero-feed-item">
                <div>
                  <strong>{incident.number}</strong>
                  <span>{incident.title}</span>
                </div>
                <StatusBadge status={incident.status} />
              </div>
            )) : <span className="hero-empty">No recent incidents yet.</span>}
          </div>
        </div>
      </section>
      <section className="metrics-grid">
        <Metric label="Open Incidents" value={metrics.open} />
        <Metric label="Critical Incidents" value={metrics.critical} />
        <Metric label="Unassigned Incidents" value={metrics.unassigned} />
        <Metric label="Resolved or Closed" value={metrics.resolved} />
      </section>
      <section className="probe-grid">
        <ProbeCard title="API Health" result={health.data} loading={health.isLoading} error={Boolean(health.error)} />
        <ProbeCard title="Service Readiness" result={readiness.data} loading={readiness.isLoading} error={Boolean(readiness.error)} />
      </section>
      <section className="content-grid">
        <div className="panel">
          <h2>Recent Incidents</h2>
          <IncidentTable incidents={incidents.slice(0, 8)} />
        </div>
        <div className="panel">
          <h2>Status Distribution</h2>
          <div className="distribution">
            {statusCounts.map((item) => (
              <div key={item.status}>
                <span>{item.status.replaceAll('_', ' ')}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

function ProbeCard({ title, result, loading, error }: { title: string; result?: ProbeResult; loading: boolean; error: boolean }) {
  const services = result?.services ? Object.entries(result.services) : []

  return (
    <div className="probe-card">
      <span>{title}</span>
      <strong className={error ? 'probe-down' : 'probe-up'}>{loading ? 'Checking' : error ? 'Unavailable' : result?.status}</strong>
      {result?.service ? <small>{result.service}</small> : null}
      {services.length ? (
        <div className="service-list">
          {services.map(([name, status]) => (
            <div key={name}>
              <span>{name}</span>
              <b className={status === 'up' ? 'probe-up' : 'probe-down'}>{status}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Incidents() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<IncidentStatus | ''>('')
  const [priority, setPriority] = useState<IncidentPriority | ''>('')
  const [sortBy, setSortBy] = useState<NonNullable<IncidentListQuery['sortBy']>>('created_at')
  const [sortDirection, setSortDirection] = useState<NonNullable<IncidentListQuery['sortDirection']>>('desc')
  const [showCreate, setShowCreate] = useState(false)
  const query = { page, pageSize: 10, search, status: status || undefined, priority: priority || undefined, sortBy, sortDirection }
  const { data, isLoading, error } = useQuery({ queryKey: ['incidents', query], queryFn: () => apiClient.getIncidents(query) })
  const totalIncidents = data?.pagination.total ?? 0

  return (
    <>
      <PageHeader
        title="Incidents"
        description="Create, triage, and resolve service interruptions with better sorting and filtering."
        action={<button onClick={() => setShowCreate(true)}>Create Incident</button>}
      />
      <div className="toolbar">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search incidents" />
        <select value={status} onChange={(event) => setStatus(event.target.value as IncidentStatus | '')}>
          <option value="">All statuses</option>
          {statuses.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={priority} onChange={(event) => setPriority(event.target.value as IncidentPriority | '')}>
          <option value="">All priorities</option>
          {priorities.map((item) => <option key={item}>{item}</option>)}
        </select>
        <select value={sortBy} onChange={(event) => setSortBy(event.target.value as NonNullable<IncidentListQuery['sortBy']>)}>
          {incidentSortOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button className="secondary" onClick={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}>
          {sortDirection === 'desc' ? 'Newest first' : 'Oldest first'}
        </button>
        <button
          className="secondary"
          onClick={() => {
            setPage(1)
            setSearch('')
            setStatus('')
            setPriority('')
            setSortBy('created_at')
            setSortDirection('desc')
          }}
        >
          Reset filters
        </button>
      </div>
      <div className="toolbar-meta">
        <span>{totalIncidents} total incidents</span>
        <span>{status || 'All statuses'}</span>
        <span>{priority || 'All priorities'}</span>
      </div>
      {isLoading ? <LoadingState /> : error ? <ErrorState message="Incidents could not be loaded." /> : <IncidentTable incidents={data?.data ?? []} />}
      <Pagination page={page} totalPages={data?.pagination.totalPages ?? 1} onPage={setPage} />
      {showCreate ? <IncidentDialog onClose={() => setShowCreate(false)} /> : null}
    </>
  )
}

function IncidentTable({ incidents }: { incidents: Incident[] }) {
  const navigate = useNavigate()
  if (!incidents.length) return <EmptyState message="No incidents found." />

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Number</th>
            <th>Title</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Assigned To</th>
            <th>Assignment Group</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((incident) => (
            <tr key={incident.id} onClick={() => navigate(`/incidents/${incident.id}`)}>
              <td>{incident.number}</td>
              <td>{incident.title}</td>
              <td><PriorityBadge priority={incident.priority} /></td>
              <td><StatusBadge status={incident.status} /></td>
              <td>{incident.assigned_to ?? 'Unassigned'}</td>
              <td>{incident.assignment_group ?? 'None'}</td>
              <td>{new Date(incident.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function IncidentDetails() {
  const { id = '' } = useParams()
  const [editing, setEditing] = useState(false)
  const { data, isLoading, error } = useQuery({ queryKey: ['incident', id], queryFn: () => apiClient.getIncident(id), enabled: Boolean(id) })

  if (isLoading) return <LoadingState />
  if (error || !data) return <ErrorState message="Incident was not found." />

  return (
    <>
      <PageHeader title={data.number} description={data.title} action={<button onClick={() => setEditing(true)}>Edit Incident</button>} />
      <section className="details">
        <div><span>Status</span><StatusBadge status={data.status} /></div>
        <div><span>Priority</span><PriorityBadge priority={data.priority} /></div>
        <div><span>Assignment Group</span><strong>{data.assignment_group ?? 'None'}</strong></div>
        <div><span>Assigned User</span><strong>{data.assigned_to ?? 'Unassigned'}</strong></div>
      </section>
      <section className="panel">
        <h2>Description</h2>
        <p>{data.description || 'No description has been provided.'}</p>
      </section>
      {editing ? <IncidentDialog incident={data} onClose={() => setEditing(false)} /> : null}
    </>
  )
}

function IncidentDialog({ incident, onClose }: { incident?: Incident; onClose: () => void }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values: IncidentFormValues) => {
      const payload = {
        ...values,
        assigned_to: values.assigned_to || undefined,
        assignment_group: values.assignment_group || undefined,
      }
      return incident ? apiClient.updateIncident(incident.id, payload) : apiClient.createIncident(payload)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['incidents'] })
      if (incident) await queryClient.invalidateQueries({ queryKey: ['incident', incident.id] })
      onClose()
    },
  })
  const { register, handleSubmit, formState: { errors } } = useForm<IncidentFormValues>({
    resolver: zodResolver(incidentFormSchema),
    defaultValues: {
      title: incident?.title ?? '',
      description: incident?.description ?? '',
      priority: incident?.priority ?? 'MEDIUM',
      status: incident?.status ?? 'NEW',
      assignment_group: incident?.assignment_group ?? '',
      assigned_to: incident?.assigned_to ?? '',
    },
  })

  return (
    <div className="dialog-backdrop">
      <form className="dialog" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <PageHeader title={incident ? 'Edit Incident' : 'Create Incident'} />
        <FormField label="Title" error={errors.title?.message}><input {...register('title')} /></FormField>
        <FormField label="Description" error={errors.description?.message}><textarea {...register('description')} /></FormField>
        <div className="form-row">
          <FormField label="Priority"><select {...register('priority')}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></FormField>
          <FormField label="Status"><select {...register('status')}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></FormField>
        </div>
        <div className="form-row">
          <FormField label="Assignment Group"><input {...register('assignment_group')} placeholder="Team UUID" /></FormField>
          <FormField label="Assigned User"><input {...register('assigned_to')} placeholder="User UUID" /></FormField>
        </div>
        {mutation.error ? <ErrorState message="Incident could not be saved. Check validation and API readiness." /> : null}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {error ? <em>{error}</em> : null}
    </label>
  )
}

function Users() {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, error } = useQuery({ queryKey: ['users'], queryFn: () => apiClient.getUsers({ pageSize: 50 }) })

  return (
    <>
      <PageHeader
        title="Users"
        description="Create test users, then use their UUIDs while assigning incidents."
        action={<button onClick={() => setShowCreate(true)}>Create User</button>}
      />
      <Directory kind="Users" items={data?.data ?? []} loading={isLoading} error={Boolean(error)} emptyMessage="No users found." />
      {showCreate ? <UserDialog onClose={() => setShowCreate(false)} /> : null}
    </>
  )
}

function Teams() {
  const [showCreate, setShowCreate] = useState(false)
  const { data, isLoading, error } = useQuery({ queryKey: ['teams'], queryFn: () => apiClient.getTeams({ pageSize: 50 }) })

  return (
    <>
      <PageHeader
        title="Teams"
        description="Create assignment groups and use their UUIDs on incidents."
        action={<button onClick={() => setShowCreate(true)}>Create Team</button>}
      />
      <Directory kind="Teams" items={data?.data ?? []} loading={isLoading} error={Boolean(error)} emptyMessage="No teams found." />
      {showCreate ? <TeamDialog onClose={() => setShowCreate(false)} /> : null}
    </>
  )
}

function Directory({ kind, items, loading, error, emptyMessage }: { kind: string; items: Array<User | Team>; loading: boolean; error: boolean; emptyMessage: string }) {
  return (
    <section>
      {loading ? <LoadingState /> : error ? <ErrorState message={`${kind} could not be loaded.`} /> : (
        <div className="directory">
          {items.length ? items.map((item) => (
            <div className="directory-row" key={item.id}>
              <div>
                <strong>{'display_name' in item ? item.display_name : item.name}</strong>
                <span>{'email' in item ? item.email : item.description ?? 'No description'}</span>
              </div>
              <code>{item.id}</code>
            </div>
          )) : <EmptyState message={emptyMessage} />}
        </div>
      )}
    </section>
  )
}

function UserDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => apiClient.createUser({
      ...values,
      external_id: values.external_id || undefined,
      first_name: values.first_name || undefined,
      last_name: values.last_name || undefined,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })
  const { register, handleSubmit, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: '',
      display_name: '',
      first_name: '',
      last_name: '',
      external_id: '',
      is_active: true,
    },
  })

  return (
    <div className="dialog-backdrop">
      <form className="dialog" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <PageHeader title="Create User" />
        <div className="form-row">
          <FormField label="Display Name" error={errors.display_name?.message}><input {...register('display_name')} /></FormField>
          <FormField label="Email" error={errors.email?.message}><input type="email" {...register('email')} /></FormField>
        </div>
        <div className="form-row">
          <FormField label="First Name"><input {...register('first_name')} /></FormField>
          <FormField label="Last Name"><input {...register('last_name')} /></FormField>
        </div>
        <FormField label="External ID"><input {...register('external_id')} placeholder="Optional identity provider id" /></FormField>
        <label className="checkbox-field"><input type="checkbox" {...register('is_active')} /> Active user</label>
        {mutation.error ? <ErrorState message="User could not be created. Check validation and API readiness." /> : null}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}

function TeamDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values: TeamFormValues) => apiClient.createTeam({
      ...values,
      description: values.description || undefined,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['teams'] })
      onClose()
    },
  })
  const { register, handleSubmit, formState: { errors } } = useForm<TeamFormValues>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
    },
  })

  return (
    <div className="dialog-backdrop">
      <form className="dialog" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <PageHeader title="Create Team" />
        <FormField label="Name" error={errors.name?.message}><input {...register('name')} /></FormField>
        <FormField label="Description" error={errors.description?.message}><textarea {...register('description')} /></FormField>
        <label className="checkbox-field"><input type="checkbox" {...register('is_active')} /> Active team</label>
        {mutation.error ? <ErrorState message="Team could not be created. Check validation and API readiness." /> : null}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </div>
  )
}

function BootstrapCompanyForm({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const mutation = useMutation({ mutationFn: (values: CompanyBootstrapValues) => apiClient.bootstrapCompany(values as BootstrapCompanyInput), onSuccess: onAuthenticated })
  const { register, handleSubmit, formState: { errors } } = useForm<CompanyBootstrapValues>({
    resolver: zodResolver(companyBootstrapSchema),
    defaultValues: {
      companyFunctionalId: '',
      companyLegalName: '',
      companyDisplayName: '',
      primaryDomain: '',
      workspaceFunctionalId: '',
      workspaceSlug: '',
      workspaceName: '',
      admin: {
        email: '',
        password: '',
        display_name: '',
        first_name: '',
        last_name: '',
      },
    },
  })

  return (
    <form className="auth-form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <h2>Create company workspace</h2>
      <div className="form-row">
        <FormField label="Company functional ID" error={errors.companyFunctionalId?.message}><input {...register('companyFunctionalId')} placeholder="ACME" /></FormField>
        <FormField label="Workspace functional ID" error={errors.workspaceFunctionalId?.message}><input {...register('workspaceFunctionalId')} placeholder="ACME-OPS" /></FormField>
      </div>
      <div className="form-row">
        <FormField label="Company legal name" error={errors.companyLegalName?.message}><input {...register('companyLegalName')} placeholder="Acme Operations Private Limited" /></FormField>
        <FormField label="Company display name" error={errors.companyDisplayName?.message}><input {...register('companyDisplayName')} placeholder="Acme Operations" /></FormField>
      </div>
      <div className="form-row">
        <FormField label="Workspace slug" error={errors.workspaceSlug?.message}><input {...register('workspaceSlug')} placeholder="acme-ops" /></FormField>
        <FormField label="Workspace name" error={errors.workspaceName?.message}><input {...register('workspaceName')} placeholder="Acme Service Desk" /></FormField>
      </div>
      <FormField label="Primary domain"><input {...register('primaryDomain')} placeholder="acme.com" /></FormField>
      <h3>First company admin</h3>
      <div className="form-row">
        <FormField label="Admin name" error={errors.admin?.display_name?.message}><input {...register('admin.display_name')} placeholder="System Admin" /></FormField>
        <FormField label="Admin email" error={errors.admin?.email?.message}><input type="email" {...register('admin.email')} placeholder="admin@acme.com" /></FormField>
      </div>
      <div className="form-row">
        <FormField label="Password" error={errors.admin?.password?.message}><input type="password" {...register('admin.password')} /></FormField>
        <FormField label="First name"><input {...register('admin.first_name')} /></FormField>
      </div>
      <FormField label="Last name"><input {...register('admin.last_name')} /></FormField>
      {mutation.error ? <ErrorState message="Company workspace could not be created." /> : null}
      <div className="dialog-actions">
        <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creating...' : 'Create company'}</button>
      </div>
    </form>
  )
}

function RegisterUserForm({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const mutation = useMutation({ mutationFn: (values: UserRegistrationValues) => apiClient.registerUser(values as RegisterUserInput), onSuccess: onAuthenticated })
  const { register, handleSubmit, formState: { errors } } = useForm<UserRegistrationValues>({
    resolver: zodResolver(userRegistrationSchema),
    defaultValues: {
      companyFunctionalId: '',
      workspaceFunctionalId: '',
      roleCode: 'REQUESTER',
      email: '',
      password: '',
      display_name: '',
      first_name: '',
      last_name: '',
    },
  })

  return (
    <form className="auth-form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <h2>Register user</h2>
      <div className="form-row">
        <FormField label="Company functional ID" error={errors.companyFunctionalId?.message}><input {...register('companyFunctionalId')} /></FormField>
        <FormField label="Workspace functional ID"><input {...register('workspaceFunctionalId')} /></FormField>
      </div>
      <div className="form-row">
        <FormField label="Role code" error={errors.roleCode?.message}><input {...register('roleCode')} placeholder="REQUESTER" /></FormField>
        <FormField label="Display name" error={errors.display_name?.message}><input {...register('display_name')} /></FormField>
      </div>
      <div className="form-row">
        <FormField label="Email" error={errors.email?.message}><input type="email" {...register('email')} /></FormField>
        <FormField label="Password" error={errors.password?.message}><input type="password" {...register('password')} /></FormField>
      </div>
      <div className="form-row">
        <FormField label="First name"><input {...register('first_name')} /></FormField>
        <FormField label="Last name"><input {...register('last_name')} /></FormField>
      </div>
      {mutation.error ? <ErrorState message="User registration could not be completed." /> : null}
      <div className="dialog-actions">
        <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Registering...' : 'Register user'}</button>
      </div>
    </form>
  )
}

function LoginForm({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const mutation = useMutation({ mutationFn: (values: LoginValues) => apiClient.login(values), onSuccess: onAuthenticated })
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      companyFunctionalId: '',
      workspaceFunctionalId: '',
      email: '',
      password: '',
    },
  })

  return (
    <form className="auth-form" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
      <h2>Login</h2>
      <div className="form-row">
        <FormField label="Company functional ID" error={errors.companyFunctionalId?.message}><input {...register('companyFunctionalId')} /></FormField>
        <FormField label="Workspace functional ID"><input {...register('workspaceFunctionalId')} /></FormField>
      </div>
      <div className="form-row">
        <FormField label="Email" error={errors.email?.message}><input type="email" {...register('email')} /></FormField>
        <FormField label="Password" error={errors.password?.message}><input type="password" {...register('password')} /></FormField>
      </div>
      {mutation.error ? <ErrorState message="Invalid credentials or workspace context." /> : null}
      <div className="dialog-actions">
        <button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in...' : 'Login'}</button>
      </div>
    </form>
  )
}

function Login() {
  return (
    <>
      <PageHeader title="Login" description="Keycloak is the identity provider for Nexora." />
      <section className="panel">
        <h2>Development Authentication</h2>
        <p>Use the nexora-web client in the nexora realm. The current UI is ready for token wiring once the Keycloak adapter is added.</p>
      </section>
    </>
  )
}

function Settings() {
  const health = useQuery({ queryKey: ['health'], queryFn: () => fetchProbe('/health'), retry: 1 })
  const readiness = useQuery({ queryKey: ['ready'], queryFn: () => fetchProbe('/ready'), retry: 1 })

  return (
    <>
      <PageHeader title="System" description="Connectivity checks for the local API and backing services." />
      <section className="probe-grid">
        <ProbeCard title="API Health" result={health.data} loading={health.isLoading} error={Boolean(health.error)} />
        <ProbeCard title="Service Readiness" result={readiness.data} loading={readiness.isLoading} error={Boolean(readiness.error)} />
      </section>
      <section className="settings-grid">
        <div className="setting">
          <strong>Web Client</strong>
          <span>Vite React app</span>
        </div>
        <div className="setting">
          <strong>API Base URL</strong>
          <span>{apiBaseUrl}</span>
        </div>
      </section>
    </>
  )
}

function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  return (
    <div className="pagination">
      <button className="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
      <span>Page {page} of {Math.max(totalPages, 1)}</span>
      <button className="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  )
}

export default App
