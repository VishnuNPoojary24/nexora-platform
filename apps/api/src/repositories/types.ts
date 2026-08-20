export interface ListResult<T> {
  items: T[];
  total: number;
}

export interface UserRecord {
  id: string;
  external_id: string | null;
  email: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TeamRecord {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface IncidentRecord {
  id: string;
  number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  reported_by: string | null;
  assigned_to: string | null;
  assignment_group: string | null;
  created_at: Date;
  updated_at: Date;
}
