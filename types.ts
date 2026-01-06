export type ColumnType = 'text' | 'status' | 'time' | 'note';

export interface Column {
  id: string;
  title: string;
  type: ColumnType;
  isFixed?: boolean; // If true, cannot be deleted (e.g., Name)
  date?: string; // ISO Date string YYYY-MM-DD for period filtering
}

export interface Teacher {
  id: string;
  name: string;
  nip?: string;
}

// Map teacherId -> { [columnId]: value }
export interface AttendanceData {
  [teacherId: string]: {
    [columnId: string]: string;
  };
}

export enum AttendanceStatus {
  HADIR = 'Hadir',
  SAKIT = 'Sakit',
  IZIN = 'Izin',
  ALPHA = 'Alpha',
}

export const ATTENDANCE_OPTIONS = [
  { value: AttendanceStatus.HADIR, color: 'bg-green-100 text-green-700 border-green-200' },
  { value: AttendanceStatus.SAKIT, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: AttendanceStatus.IZIN, color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: AttendanceStatus.ALPHA, color: 'bg-red-100 text-red-700 border-red-200' },
];