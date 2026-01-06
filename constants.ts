import { Column, Teacher, AttendanceData } from './types';

// Helper to get today's date formatted
const today = new Date().toISOString().split('T')[0];

export const INITIAL_COLUMNS: Column[] = [
  { id: 'col_name', title: 'Nama Guru', type: 'text', isFixed: true },
  { id: 'col_percent', title: '% Hadir', type: 'text', isFixed: true },
  { id: 'col_mon', title: 'Senin (Contoh)', type: 'status', date: '2024-01-01' },
  { id: 'col_tue', title: 'Selasa (Contoh)', type: 'status', date: '2024-01-02' },
  { id: 'col_wed', title: 'Rabu (Contoh)', type: 'status', date: '2024-01-03' },
  { id: 'col_note', title: 'Keterangan', type: 'note' },
];

export const INITIAL_TEACHERS: Teacher[] = [
  { id: 't_1', name: 'Budi Santoso' },
  { id: 't_2', name: 'Siti Aminah' },
  { id: 't_3', name: 'Rudi Hartono' },
  { id: 't_4', name: 'Dewi Lestari' },
];

export const INITIAL_DATA: AttendanceData = {
  't_1': { 'col_mon': 'Hadir', 'col_tue': 'Hadir', 'col_wed': 'Sakit' },
  't_2': { 'col_mon': 'Hadir', 'col_tue': 'Izin', 'col_wed': 'Hadir' },
};

export const INITIAL_TITLE = "Absensi Guru - Periode 2024";