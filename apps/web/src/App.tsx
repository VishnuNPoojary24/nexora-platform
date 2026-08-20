import { zodResolver } from '@hookform/resolvers/zod'
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { BrowserRouter, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { apiClient } from '@nexora/api-client'
import type { Incident, IncidentPriority, IncidentStatus, Team, User } from '@nexora/types'
import './App.css'

const queryClient = new QueryClient()
const statuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED'] as const
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

const incidentFormSchema = z.object({
  title: z.string().min(3, 'Use at least 3 characters'),
  description: z.string().optional(),
  priority: z.enum(priorities),
  status: z.enum(statuses),
  assignment_group: z.string().optional(),
  assigned_to: z.string().optional(),
})

type IncidentFormValues = z.infer<typeof incidentFormSchema>

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

function Shell() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="workspace">
        <TopBar />
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
    ['/incidents?type=requests', 'Requests'],
    ['/incidents?type=problems', 'Problems'],
    ['/incidents?type=changes', 'Changes'],
    ['/teams', 'CMDB'],
    ['/settings', 'Knowledge'],
    ['/settings', 'Reports'],
    ['/users', 'Administration'],
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

function TopBar() {
  return (
    <header className="topbar">
      <div>
        <strong>IT Service Management</strong>
        <span>Local foundation</span>
      </div>
      <div className="topbar-actions">
        <button type="button" aria-label="Notifications" className="icon-button">!</button>
        <NavLink to="/login" className="user-chip">Dev User</NavLink>
      </div>
    </header>
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
  const { data, isLoading, error } = useQuery({ queryKey: ['incidents', 'dashboard'], queryFn: () => apiClient.getIncidents({ pageSize: 50 }) })
  const incidents = data?.data ?? []
  const metrics = useMemo(() => {
    const open = incidents.filter((incident) => !['RESOLVED', 'CLOSED'].includes(incident.status)).length
    return {
      open,
      critical: incidents.filter((incident) => incident.priority === 'CRITICAL').length,
      unassigned: incidents.filter((incident) => !incident.assigned_to).length,
      sla: open > 0 ? 94 : 100,
    }
  }, [incidents])

  if (isLoading) return <LoadingState />
  if (error) return <ErrorState message="Dashboard data is unavailable. Start the API and database, then refresh." />

  const statusCounts = statuses.map((status) => ({ status, count: incidents.filter((incident) => incident.status === status).length }))

  return (
    <>
      <PageHeader title="Dashboard" description="Operational snapshot across service desk work." />
      <section className="metrics-grid">
        <Metric label="Open Incidents" value={metrics.open} />
        <Metric label="Critical Incidents" value={metrics.critical} />
        <Metric label="Unassigned Incidents" value={metrics.unassigned} />
        <Metric label="SLA Compliance" value={`${metrics.sla}%`} />
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
  const [showCreate, setShowCreate] = useState(false)
  const query = { page, pageSize: 10, search, status: status || undefined, priority: priority || undefined }
  const { data, isLoading, error } = useQuery({ queryKey: ['incidents', query], queryFn: () => apiClient.getIncidents(query) })

  return (
    <>
      <PageHeader title="Incidents" description="Create, triage, and resolve service interruptions." action={<button onClick={() => setShowCreate(true)}>Create Incident</button>} />
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
  const { data, isLoading, error } = useQuery({ queryKey: ['users'], queryFn: () => apiClient.getUsers({ pageSize: 50 }) })
  return <Directory title="Users" description="People synchronized from the identity provider." items={data?.data ?? []} loading={isLoading} error={Boolean(error)} />
}

function Teams() {
  const { data, isLoading, error } = useQuery({ queryKey: ['teams'], queryFn: () => apiClient.getTeams({ pageSize: 50 }) })
  return <Directory title="Teams" description="Assignment groups and support teams." items={data?.data ?? []} loading={isLoading} error={Boolean(error)} />
}

function Directory({ title, description, items, loading, error }: { title: string; description: string; items: Array<User | Team>; loading: boolean; error: boolean }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      {loading ? <LoadingState /> : error ? <ErrorState message={`${title} could not be loaded.`} /> : (
        <div className="directory">
          {items.length ? items.map((item) => (
            <div className="directory-row" key={item.id}>
              <strong>{'display_name' in item ? item.display_name : item.name}</strong>
              <span>{'email' in item ? item.email : item.description ?? 'No description'}</span>
            </div>
          )) : <EmptyState message={`No ${title.toLowerCase()} found.`} />}
        </div>
      )}
    </>
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
  return (
    <>
      <PageHeader title="Settings" description="Service integrations and platform configuration." />
      <section className="settings-grid">
        {['Keycloak', 'PostgreSQL', 'Redis', 'RabbitMQ', 'MinIO', 'AI Service'].map((item) => (
          <div className="setting" key={item}>
            <strong>{item}</strong>
            <span>Configured through environment variables</span>
          </div>
        ))}
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
