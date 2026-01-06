import React, { useState } from 'react';
import { Column, ColumnType } from '../types';
import { Trash2, Plus, GripVertical, AlertCircle, Calendar } from 'lucide-react';
import Button from './Button';

interface ColumnManagerProps {
  columns: Column[];
  onUpdateColumns: (cols: Column[]) => void;
  onClose: () => void;
}

const ColumnManager: React.FC<ColumnManagerProps> = ({ columns, onUpdateColumns, onClose }) => {
  const [localColumns, setLocalColumns] = useState<Column[]>([...columns]);
  const [newColTitle, setNewColTitle] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('status');
  const [newColDate, setNewColDate] = useState('');

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateVal = e.target.value;
    setNewColDate(dateVal);
    
    // Auto-generate title if empty or looks like a previous auto-generated date
    if (dateVal) {
        const dateObj = new Date(dateVal);
        const day = dateObj.getDate().toString().padStart(2, '0');
        const month = (dateObj.getMonth() + 1).toString().padStart(2, '0'); // Jan is 0
        // Simple format DD/MM
        setNewColTitle(`${day}/${month}`);
    }
  };

  const handleAddColumn = () => {
    if (!newColTitle.trim()) return;
    
    const newId = `col_${Date.now()}`;
    const newCol: Column = {
      id: newId,
      title: newColTitle,
      type: newColType,
      isFixed: false,
      date: newColDate || undefined
    };

    setLocalColumns([...localColumns, newCol]);
    setNewColTitle('');
    setNewColDate('');
  };

  const handleDeleteColumn = (id: string) => {
    setLocalColumns(localColumns.filter(c => c.id !== id));
  };

  const handleTitleChange = (id: string, newTitle: string) => {
    setLocalColumns(localColumns.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleSave = () => {
    onUpdateColumns(localColumns);
    onClose();
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 p-3 rounded-md flex items-start gap-2 text-sm text-blue-700">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <p>Kolom 'Nama Guru' adalah kolom tetap. Tambahkan tanggal pada kolom baru agar fitur Filter Periode berfungsi.</p>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {localColumns.map((col) => (
          <div key={col.id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 group">
            <GripVertical size={16} className="text-slate-400 cursor-move" />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={col.title}
                    disabled={col.isFixed}
                    onChange={(e) => handleTitleChange(col.id, e.target.value)}
                    className={`w-full bg-transparent border-none focus:ring-0 p-0 text-sm font-medium ${col.isFixed ? 'text-slate-500' : 'text-slate-900'}`}
                  />
                  {col.date && (
                    <span className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 whitespace-nowrap hidden sm:inline-block">
                        {col.date}
                    </span>
                  )}
              </div>
              <span className="text-xs text-slate-400 uppercase tracking-wider">{col.type}</span>
            </div>

            {!col.isFixed && (
              <button 
                onClick={() => handleDeleteColumn(col.id)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                title="Hapus Kolom"
              >
                <Trash2 size={16} />
              </button>
            )}
            {col.isFixed && <span className="text-xs bg-slate-200 text-slate-500 px-2 py-0.5 rounded">Fixed</span>}
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Tambah Kolom Baru</label>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
          {/* Date Picker (Optional) */}
          <div className="sm:col-span-3 relative">
             <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                <Calendar size={14} />
             </div>
             <input 
                type="date" 
                value={newColDate}
                onChange={handleDateChange}
                className="w-full pl-8 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                title="Pilih tanggal (opsional)"
             />
          </div>

          <div className="sm:col-span-4">
            <input
                type="text"
                value={newColTitle}
                onChange={(e) => setNewColTitle(e.target.value)}
                placeholder="Judul (mis: 12 Jan)"
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            />
          </div>
          
          <div className="sm:col-span-3">
            <select
                value={newColType}
                onChange={(e) => setNewColType(e.target.value as ColumnType)}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            >
                <option value="status">Status</option>
                <option value="text">Teks</option>
                <option value="note">Catatan</option>
                <option value="time">Jam</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <Button onClick={handleAddColumn} disabled={!newColTitle} variant="secondary" icon={<Plus size={16} />} className="w-full">
                Add
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 mt-1">*Pilih tanggal agar judul terisi otomatis & filter periode berfungsi.</p>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="ghost" onClick={onClose}>Batal</Button>
        <Button onClick={handleSave}>Simpan Perubahan</Button>
      </div>
    </div>
  );
};

export default ColumnManager;