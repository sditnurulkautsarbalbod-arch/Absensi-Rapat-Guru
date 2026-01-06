import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings, Users, FileSpreadsheet, FileText, UserPlus, Table, Pencil, Loader2, LogIn, LogOut, Lock, Cloud, RefreshCw, CheckCircle2, AlertCircle, Trash2, Search, Calendar, Filter, XCircle, CalendarDays, Eye, EyeOff } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Column, Teacher, AttendanceData } from './types';
import { loadData, saveData } from './services/storageService';
import { fetchFromCloud, saveToCloud } from './services/googleSheetService';
import { INITIAL_COLUMNS } from './constants';
import AttendanceTable from './components/AttendanceTable';
import ColumnManager from './components/ColumnManager';
import Modal from './components/Modal';
import Button from './components/Button';
import SyncModal from './components/SyncModal';

function App() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [data, setData] = useState<AttendanceData>({});
  const [tableTitle, setTableTitle] = useState('');
  
  // Auth State
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('attendance_admin_auth') === 'true';
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // State for password visibility
  const [loginError, setLoginError] = useState('');

  // Sync State
  // Logic: Cek LocalStorage dulu (jika user pernah override), jika kosong ambil dari ENV Vercel
  const [scriptUrl, setScriptUrl] = useState(() => {
    const local = localStorage.getItem('attendance_script_url');
    // Fix: Optional chaining for env to prevent crash if env is undefined
    const env = (import.meta as any).env?.VITE_GOOGLE_SCRIPT_URL;
    return local || env || '';
  });

  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');

  // Loading state
  const [isLoaded, setIsLoaded] = useState(false);

  // Modals state
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [isTeacherModalOpen, setIsTeacherModalOpen] = useState(false);
  
  // Bulk Add State
  const [teacherInput, setTeacherInput] = useState('');

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Initial Load
  useEffect(() => {
    const init = async () => {
      // 1. Load Local Data (IndexedDB) first for speed
      const localData = await loadData();
      
      let finalColumns = localData.columns;
      const hasPercentCol = finalColumns.some(c => c.id === 'col_percent');
      
      if (!hasPercentCol) {
        const newCols = [...finalColumns];
        const percentCol = INITIAL_COLUMNS.find(c => c.id === 'col_percent');
        if (percentCol) {
            const nameIdx = newCols.findIndex(c => c.id === 'col_name');
            if (nameIdx !== -1) {
                newCols.splice(nameIdx + 1, 0, percentCol);
            } else {
                newCols.unshift(percentCol);
            }
        }
        finalColumns = newCols;
      }

      setColumns(finalColumns);
      setTeachers(localData.teachers);
      setData(localData.data);
      setTableTitle(localData.title);
      setIsLoaded(true);

      // 2. If Script URL exists, try to sync from Cloud (Background)
      // Note: We use the state variable `scriptUrl` which is already initialized from localStorage or Env
      if (scriptUrl) {
        performSync(scriptUrl, false); 
      }
    };
    init();
  }, []); // Run once on mount

  // Save to IndexedDB on change
  useEffect(() => {
    if (isLoaded) {
      saveData(columns, teachers, data, tableTitle);
    }
  }, [columns, teachers, data, tableTitle, isLoaded]);

  // Debounced Auto-Save to Cloud
  useEffect(() => {
    if (!isLoaded || !scriptUrl || !isAdmin) return;

    const timeoutId = setTimeout(() => {
        setSyncStatus('syncing');
        saveToCloud(scriptUrl, columns, teachers, data, tableTitle)
            .then(() => {
                setSyncStatus('success');
                setTimeout(() => setSyncStatus('idle'), 3000);
            })
            .catch((err) => {
                console.error(err);
                setSyncStatus('error');
            });
    }, 2000); // Wait 2 seconds of inactivity before pushing to cloud

    return () => clearTimeout(timeoutId);
  }, [columns, teachers, data, tableTitle, isLoaded, scriptUrl, isAdmin]);

  // --- Filtering Logic ---
  
  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectedMonth(val);
    if (val) {
        // val is YYYY-MM
        const [year, month] = val.split('-');
        // Construct Start Date: YYYY-MM-01
        setStartDate(`${val}-01`);
        
        // Construct End Date: Last day of the month
        // new Date(year, month, 0) gets the last day of the PREVIOUS month index (which matches our month number since JS months are 0-indexed)
        const lastDayObj = new Date(parseInt(year), parseInt(month), 0);
        const lastDay = lastDayObj.getDate();
        setEndDate(`${val}-${lastDay}`);
    } else {
        setStartDate('');
        setEndDate('');
    }
  };

  const handleManualDateChange = (type: 'start' | 'end', val: string) => {
      setSelectedMonth(''); // Clear month selector if user manually picks dates
      if (type === 'start') setStartDate(val);
      else setEndDate(val);
  };

  const filteredTeachers = useMemo(() => {
      let result = teachers;
      
      if (searchQuery) {
          result = teachers.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));
      }
      
      // Sort alphabetically by name
      return [...result].sort((a, b) => a.name.localeCompare(b.name));
  }, [teachers, searchQuery]);

  const filteredColumns = useMemo(() => {
      if (!startDate && !endDate) return columns;

      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      return columns.filter(col => {
          if (col.isFixed) return true;
          if (!col.date) return true;

          const colDate = new Date(col.date);
          if (start && colDate < start) return false;
          if (end && colDate > end) return false;
          
          return true;
      });
  }, [columns, startDate, endDate]);
  // -----------------------

  const performSync = async (url: string, isManual: boolean) => {
      if (!url) return;
      setSyncStatus('syncing');
      setSyncMessage('Mengunduh data terbaru dari Google Sheet...');
      try {
          const cloudData = await fetchFromCloud(url);
          
          // Update State
          if (cloudData.columns.length > 0) setColumns(cloudData.columns);
          if (cloudData.teachers.length > 0) setTeachers(cloudData.teachers);
          // Merge data or replace? For simplicity, we replace data with cloud data
          setData(cloudData.data); 
          if (cloudData.title) setTableTitle(cloudData.title);

          setSyncStatus('success');
          setSyncMessage('Data berhasil disinkronkan!');
      } catch (e) {
          console.error(e);
          setSyncStatus('error');
          setSyncMessage('Gagal mengambil data dari Google Sheet. Cek URL atau koneksi.');
          
          if (isManual) {
             setSyncMessage('Data di Sheet kosong atau error. Mencoba mengunggah data lokal...');
             try {
                await saveToCloud(url, columns, teachers, data, tableTitle);
                setSyncStatus('success');
                setSyncMessage('Data lokal berhasil diunggah ke Google Sheet!');
             } catch (uploadErr) {
                setSyncStatus('error');
                setSyncMessage('Gagal sinkronisasi.');
             }
          }
      } finally {
          setTimeout(() => {
              if (syncStatus !== 'error') setSyncStatus('idle');
              setSyncMessage('');
          }, 4000);
      }
  };

  const handleSaveUrl = (url: string) => {
      setScriptUrl(url);
      localStorage.setItem('attendance_script_url', url);
      performSync(url, true);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Use Environment Variable for Password, fallback to 'admin123' if not set
    // Cast import.meta to any to avoid TS error: Property 'env' does not exist on type 'ImportMeta'
    // Fix: Optional chaining for env to prevent crash
    const adminPass = (import.meta as any).env?.VITE_ADMIN_PASSWORD || 'admin123';
    
    if (loginPassword === adminPass) {
        localStorage.setItem('attendance_admin_auth', 'true');
        setIsAdmin(true);
        setIsLoginModalOpen(false);
        setLoginPassword('');
        setLoginError('');
    } else {
        setLoginError('Password salah!');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('attendance_admin_auth');
    setIsAdmin(false);
  };

  const handleUpdateAttendance = (teacherId: string, columnId: string, value: string) => {
    if (!isAdmin) return;
    setData(prev => ({
      ...prev,
      [teacherId]: {
        ...(prev[teacherId] || {}),
        [columnId]: value
      }
    }));
  };

  const handleUpdateColumns = (newColumns: Column[]) => {
    setColumns(newColumns);
  };

  const handleAddTeachers = () => {
    if (!teacherInput.trim()) return;

    const names = teacherInput.split('\n').filter(n => n.trim().length > 0);
    
    if (names.length === 0) return;

    const newTeachers: Teacher[] = names.map((name, index) => ({
      id: `t_${Date.now()}_${index}`,
      name: name.trim(),
    }));

    setTeachers([...teachers, ...newTeachers]);
    setTeacherInput('');
  };

  const handleDeleteTeacher = (id: string) => {
      if (window.confirm('Yakin ingin menghapus guru ini? Data absensi terkait akan hilang.')) {
          setTeachers(teachers.filter(t => t.id !== id));
      }
  };

  const getExportValue = (teacher: Teacher, column: Column) => {
    if (column.id === 'col_name') return teacher.name;
    if (column.id === 'col_percent') {
        const statusCols = filteredColumns.filter(col => col.type === 'status');
        const total = statusCols.length;
        if (total === 0) return '0%';
        const present = statusCols.filter(sc => data[teacher.id]?.[sc.id] === 'Hadir').length;
        return `${Math.round((present / total) * 100)}%`;
    }
    return data[teacher.id]?.[column.id] || '-';
  };

  const handleExportExcel = () => {
    const headers = filteredColumns.map(c => c.title);
    const rows = filteredTeachers.map(t => filteredColumns.map(c => getExportValue(t, c)));
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Absensi");
    const fileName = `${tableTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'absensi'}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(tableTitle || "Laporan Absensi Guru", 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 22);

    const headers = filteredColumns.map(c => c.title);
    const rows = filteredTeachers.map(t => filteredColumns.map(c => getExportValue(t, c)));

    autoTable(doc, {
      startY: 28,
      head: [headers],
      body: rows,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });
    const fileName = `${tableTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'absensi'}.pdf`;
    doc.save(fileName);
  };

  const newTeacherCount = teacherInput.split('\n').filter(n => n.trim().length > 0).length;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-500">
          <Loader2 className="animate-spin" size={32} />
          <p>Memuat Data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Table className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Absensi Guru Pro</h1>
                <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-500 font-medium">Sistem Manajemen Kehadiran</p>
                    {syncStatus === 'syncing' && <span className="flex items-center gap-1 text-[10px] text-blue-600"><RefreshCw size={10} className="animate-spin" /> Sync...</span>}
                    {syncStatus === 'success' && <span className="flex items-center gap-1 text-[10px] text-green-600"><CheckCircle2 size={10} /> Saved</span>}
                    {syncStatus === 'error' && <span className="flex items-center gap-1 text-[10px] text-red-600"><AlertCircle size={10} /> Error</span>}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary" 
                size="sm" 
                icon={<FileSpreadsheet size={16} className="text-green-600" />}
                onClick={handleExportExcel}
                className="hidden sm:inline-flex border-green-200 hover:bg-green-50 text-green-700"
              >
                Excel
              </Button>
              <Button 
                variant="secondary" 
                size="sm" 
                icon={<FileText size={16} className="text-red-600" />}
                onClick={handleExportPDF}
                className="hidden sm:inline-flex border-red-200 hover:bg-red-50 text-red-700"
              >
                PDF
              </Button>
              
              <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

              {isAdmin ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  icon={<LogOut size={16} />} 
                  onClick={handleLogout}
                  className="text-slate-600"
                >
                  Logout
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  size="sm" 
                  icon={<LogIn size={16} />} 
                  onClick={() => setIsLoginModalOpen(true)}
                >
                  Login Admin
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Editable Title Section */}
        <div className="group relative mb-6">
          <input
            type="text"
            value={tableTitle}
            onChange={(e) => isAdmin && setTableTitle(e.target.value)}
            disabled={!isAdmin}
            className={`w-full bg-transparent border-b-2 border-transparent px-0 py-1 text-2xl font-bold text-slate-800 transition-all outline-none 
                ${isAdmin ? 'hover:border-slate-300 focus:border-indigo-500 focus:ring-0 placeholder:text-slate-300' : 'cursor-default'}`}
            placeholder={isAdmin ? "Klik untuk memberi judul absensi..." : "Judul Absensi"}
          />
          {isAdmin && (
             <Pencil size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          )}
        </div>

        {/* Filter Bar (Search & Date Range) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-end">
            <div className="flex-1 w-full xl:w-auto flex flex-col md:flex-row gap-4 items-start md:items-end flex-wrap">
                {/* Search */}
                <div className="w-full md:w-56">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Cari Guru</label>
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Nama guru..." 
                            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                <XCircle size={14} />
                            </button>
                        )}
                    </div>
                </div>

                <div className="w-px h-10 bg-slate-200 hidden md:block mx-1"></div>

                {/* Monthly Filter Shortcut */}
                <div className="w-full md:w-auto">
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1 flex items-center gap-1">
                        <CalendarDays size={12} className="text-indigo-500" />
                        Filter Bulanan
                    </label>
                    <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={handleMonthChange}
                        className="w-full md:w-40 py-2 text-sm rounded-lg border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 bg-indigo-50/50"
                    />
                </div>

                <div className="text-xs text-slate-300 self-center hidden md:block">atau</div>

                {/* Date Filter Custom */}
                <div className="flex flex-col sm:flex-row gap-2 items-end w-full md:w-auto">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5 ml-1">Range Custom</label>
                        <div className="flex items-center gap-2">
                             <input 
                                type="date" 
                                value={startDate}
                                onChange={(e) => handleManualDateChange('start', e.target.value)}
                                className="w-full md:w-36 py-2 text-sm rounded-lg border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                            <span className="text-slate-400">-</span>
                            <input 
                                type="date" 
                                value={endDate}
                                onChange={(e) => handleManualDateChange('end', e.target.value)}
                                className="w-full md:w-36 py-2 text-sm rounded-lg border-slate-300 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                     {(startDate || endDate) && (
                        <button 
                            onClick={() => { setStartDate(''); setEndDate(''); setSelectedMonth(''); }}
                            className="p-2.5 bg-slate-100 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-slate-200"
                            title="Reset Semua Filter"
                        >
                            <XCircle size={16} />
                        </button>
                    )}
                </div>
            </div>

            {/* Stats */}
            <div className="text-right hidden xl:block min-w-max">
                <div className="text-xs text-slate-500">Menampilkan</div>
                <div className="font-bold text-slate-800">
                    {filteredTeachers.length} Guru <span className="text-slate-300 mx-1">|</span> {filteredColumns.filter(c => !c.isFixed).length} Kolom
                </div>
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {isAdmin ? (
                <>
                    <Button 
                      onClick={() => setIsColModalOpen(true)} 
                      variant="secondary"
                      icon={<Settings size={16} />}
                    >
                      Atur Kolom
                    </Button>
                     <Button 
                      onClick={() => setIsTeacherModalOpen(true)} 
                      variant="secondary"
                      icon={<Users size={16} />}
                    >
                      Guru
                    </Button>
                    <Button
                      onClick={() => setIsSyncModalOpen(true)}
                      variant={scriptUrl ? "secondary" : "primary"}
                      icon={<Cloud size={16} className={scriptUrl ? "text-blue-500" : ""} />}
                    >
                      {scriptUrl ? "Config Sync" : "Hubungkan Sheet"}
                    </Button>
                </>
            ) : (
                <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-3 py-2 rounded-lg text-sm">
                    <Lock size={16} />
                    <span>Mode Lihat (Read Only). Login untuk mengedit.</span>
                </div>
            )}
          </div>
        </div>

        {/* Messages */}
        {syncMessage && (
             <div className={`mb-4 text-sm px-4 py-2 rounded-lg flex items-center gap-2 ${syncStatus === 'error' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                {syncStatus === 'syncing' && <Loader2 className="animate-spin" size={14} />}
                {syncMessage}
             </div>
        )}

        {/* Main Table Area */}
        <AttendanceTable 
          columns={filteredColumns} 
          teachers={filteredTeachers} 
          data={data} 
          onUpdateData={handleUpdateAttendance}
          readOnly={!isAdmin}
        />
        
        <div className="mt-6 text-xs text-slate-400 text-center flex flex-col gap-1">
          <span>Data tersimpan otomatis di IndexedDB (Local).</span>
          {scriptUrl && <span>Sinkronisasi Google Sheet: <b>Aktif</b></span>}
        </div>
      </main>

      {/* Modals */}
      <Modal isOpen={isColModalOpen} onClose={() => setIsColModalOpen(false)} title="Kustomisasi Header Tabel">
        <ColumnManager columns={columns} onUpdateColumns={handleUpdateColumns} onClose={() => setIsColModalOpen(false)} />
      </Modal>

      <Modal isOpen={isTeacherModalOpen} onClose={() => setIsTeacherModalOpen(false)} title="Kelola Data Guru">
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                <span>Tambah Guru (Bulk Import)</span>
                <span className="text-xs text-slate-500 font-normal">Satu nama per baris</span>
            </label>
            <textarea 
              value={teacherInput} 
              onChange={(e) => setTeacherInput(e.target.value)}
              className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm h-32" 
              placeholder={"Contoh:\nBudi Santoso, S.Pd\nSiti Aminah, M.Pd\nRudi Hartono"} 
            />
            <div className="flex justify-end pt-2">
                 <Button 
                    onClick={handleAddTeachers} 
                    disabled={!teacherInput.trim()} 
                    icon={<UserPlus size={16} />}
                    size="sm"
                 >
                    {newTeacherCount > 1 ? `Tambah ${newTeacherCount} Guru` : 'Tambah Guru'}
                 </Button>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
             <h3 className="text-sm font-medium text-slate-900 mb-3 flex items-center gap-2">
                <Users size={16} className="text-slate-500" />
                Daftar Guru Terdaftar ({teachers.length})
             </h3>
             <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                {teachers.length === 0 && <p className="text-xs text-slate-400 italic">Belum ada data guru.</p>}
                {teachers.map((t, idx) => (
                  <div key={t.id} className="flex justify-between items-center bg-white border border-slate-100 p-2 rounded text-sm hover:border-slate-300 transition-colors group">
                     <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-400 w-5">{idx + 1}.</span>
                        <span className="text-slate-700 font-medium">{t.name}</span>
                     </div>
                     <button 
                        onClick={() => handleDeleteTeacher(t.id)} 
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="Hapus Guru"
                     >
                        <Trash2 size={14} />
                     </button>
                  </div>
                ))}
             </div>
          </div>
          
          <div className="pt-4 flex justify-end">
            <Button variant="ghost" onClick={() => setIsTeacherModalOpen(false)}>Tutup</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} title="Login Admin">
        <form onSubmit={handleLogin} className="space-y-4">
            {loginError && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{loginError}</div>}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    value={loginPassword} 
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 pr-10" 
                    autoFocus 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" type="button" onClick={() => setIsLoginModalOpen(false)}>Batal</Button>
                <Button type="submit">Login</Button>
            </div>
        </form>
      </Modal>

      <SyncModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
        currentUrl={scriptUrl} 
        onSaveUrl={handleSaveUrl} 
      />

    </div>
  );
}

export default App;