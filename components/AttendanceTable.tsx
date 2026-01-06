import React from 'react';
import { Column, Teacher, AttendanceData, ATTENDANCE_OPTIONS, AttendanceStatus } from '../types';
import { User, Percent } from 'lucide-react';

interface AttendanceTableProps {
  columns: Column[];
  teachers: Teacher[];
  data: AttendanceData;
  onUpdateData: (teacherId: string, columnId: string, value: string) => void;
  readOnly?: boolean;
}

const AttendanceTable: React.FC<AttendanceTableProps> = ({ columns, teachers, data, onUpdateData, readOnly = false }) => {
  
  const getStatusColor = (status: string) => {
    const option = ATTENDANCE_OPTIONS.find(o => o.value === status);
    return option ? option.color : 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const calculatePercentage = (teacherId: string) => {
    const statusColumns = columns.filter(col => col.type === 'status');
    const totalStatusColumns = statusColumns.length;
    
    if (totalStatusColumns === 0) return 0;

    const presentCount = statusColumns.reduce((acc, col) => {
        const val = data[teacherId]?.[col.id];
        return val === AttendanceStatus.HADIR ? acc + 1 : acc;
    }, 0);

    return Math.round((presentCount / totalStatusColumns) * 100);
  };

  const getPercentageColor = (percent: number) => {
    if (percent >= 80) return 'text-green-600 bg-green-50';
    if (percent >= 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  // Helper to determine sticky styles based on index
  const getStickyStyle = (index: number, isHeader: boolean = false) => {
    if (index === 0) { // Name Column
        return `sticky left-0 z-20 ${isHeader ? 'bg-slate-50' : 'bg-white group-hover:bg-slate-50'} border-r border-slate-200`;
    }
    if (index === 1) { // Percent Column
        return `sticky left-[200px] z-20 ${isHeader ? 'bg-slate-50' : 'bg-white group-hover:bg-slate-50'} border-r border-slate-200 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]`;
    }
    return '';
  };

  const renderCellInput = (teacherId: string, column: Column) => {
    const value = data[teacherId]?.[column.id] || '';

    if (column.id === 'col_name') {
      return (
        <div className="flex items-center gap-3 font-medium text-slate-900">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <User size={16} />
          </div>
          <span className="truncate">{teachers.find(t => t.id === teacherId)?.name}</span>
        </div>
      );
    }

    if (column.id === 'col_percent') {
        const percent = calculatePercentage(teacherId);
        return (
            <div className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${getPercentageColor(percent)}`}>
                <Percent size={12} className="mr-1" />
                {percent}%
            </div>
        );
    }

    // --- Read Only View Logic ---
    if (readOnly) {
      if (column.type === 'status') {
         if (!value) return <span className="text-slate-300">-</span>;
         return (
             <span className={`inline-block text-xs font-semibold px-2 py-1 rounded border ${getStatusColor(value)}`}>
                 {value}
             </span>
         );
      }
      return <span className="text-sm text-slate-700 block truncate px-2 py-1">{value}</span>;
    }
    // ----------------------------

    if (column.type === 'status') {
      return (
        <select
          value={value}
          onChange={(e) => onUpdateData(teacherId, column.id, e.target.value)}
          className={`w-full text-xs font-semibold rounded border px-2 py-1 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors ${getStatusColor(value)}`}
        >
          <option value="">-</option>
          {ATTENDANCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.value}
            </option>
          ))}
        </select>
      );
    }

    if (column.type === 'note') {
        return (
            <input
              type="text"
              value={value}
              onChange={(e) => onUpdateData(teacherId, column.id, e.target.value)}
              placeholder="..."
              className="w-full text-sm bg-transparent border-0 border-b border-transparent focus:border-indigo-500 focus:ring-0 px-0 placeholder:text-slate-300"
            />
        );
    }

    if (column.type === 'time') {
      return (
        <input
          type="time"
          value={value}
          onChange={(e) => onUpdateData(teacherId, column.id, e.target.value)}
          className="w-full text-sm border-slate-200 rounded focus:ring-indigo-500 focus:border-indigo-500"
        />
      );
    }

    // Default text
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onUpdateData(teacherId, column.id, e.target.value)}
        className="w-full text-sm border-slate-200 rounded focus:ring-indigo-500 focus:border-indigo-500 px-2 py-1"
      />
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto custom-scrollbar pb-2">
        <table className="min-w-full divide-y divide-slate-200 border-separate border-spacing-0">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((col, index) => (
                <th
                  key={col.id}
                  scope="col"
                  className={`
                    px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap
                    ${getStickyStyle(index, true)}
                  `}
                  style={{ 
                      minWidth: col.id === 'col_name' ? '200px' : (col.id === 'col_percent' ? '100px' : '140px'),
                      left: index === 1 ? '200px' : (index === 0 ? '0px' : 'auto')
                  }}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {teachers.map((teacher) => (
              <tr key={teacher.id} className="hover:bg-slate-50 transition-colors group">
                {columns.map((col, index) => (
                  <td
                    key={`${teacher.id}-${col.id}`}
                    className={`
                      px-4 py-3 whitespace-nowrap
                      ${getStickyStyle(index, false)}
                    `}
                    style={{ 
                        left: index === 1 ? '200px' : (index === 0 ? '0px' : 'auto')
                    }}
                  >
                    {renderCellInput(teacher.id, col)}
                  </td>
                ))}
              </tr>
            ))}
            {teachers.length === 0 && (
                <tr>
                    <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400 italic">
                        Belum ada data guru. Silahkan tambah guru terlebih dahulu.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceTable;