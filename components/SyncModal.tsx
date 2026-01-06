import React, { useState } from 'react';
import { Copy, Check, ExternalLink, Cloud, AlertTriangle } from 'lucide-react';
import Button from './Button';
import Modal from './Modal';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onSaveUrl: (url: string) => void;
}

const GAS_CODE = `
// --- COPY KODE INI KE GOOGLE APPS SCRIPT ---

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // -- GET DATA (READ) --
    if (!e.postData) {
      const configSheet = ss.getSheetByName('DB_METADATA');
      const dataSheet = ss.getSheetByName('DB_RECORDS');

      if (!configSheet || !dataSheet) {
        return responseJSON({ status: 'error', message: 'Sheet DB belum diinisialisasi. Lakukan Save dari web dulu.' });
      }

      // Load Metadata
      const title = configSheet.getRange('B1').getValue();
      const columnsJSON = configSheet.getRange('B2').getValue();
      
      // Load Data Rows
      const rawData = dataSheet.getDataRange().getValues();
      const headers = rawData[0]; // Row 1 is header IDs
      const rows = rawData.slice(1); // Rows 2+ are data

      const teachers = [];
      const attendanceData = {};

      rows.forEach(row => {
        const tId = row[0];
        const tName = row[1];
        if(!tId) return;

        teachers.push({ id: tId, name: tName });
        
        attendanceData[tId] = {};
        // Map dynamic columns (starting from index 2)
        for (let i = 2; i < headers.length; i++) {
          const colId = headers[i];
          attendanceData[tId][colId] = row[i];
        }
      });

      return responseJSON({
        status: 'success',
        data: {
          title: title,
          columns: JSON.parse(columnsJSON),
          teachers: teachers,
          data: attendanceData
        }
      });
    }

    // -- POST DATA (SAVE/CREATE/UPDATE/DELETE) --
    const body = JSON.parse(e.postData.contents);
    
    // 1. Setup Metadata Sheet
    let configSheet = ss.getSheetByName('DB_METADATA');
    if (!configSheet) configSheet = ss.insertSheet('DB_METADATA');
    configSheet.clear();
    configSheet.getRange('A1').setValue('Title');
    configSheet.getRange('B1').setValue(body.title);
    configSheet.getRange('A2').setValue('Columns Config');
    configSheet.getRange('B2').setValue(JSON.stringify(body.columns));

    // 2. Setup Records Sheet
    let dataSheet = ss.getSheetByName('DB_RECORDS');
    if (dataSheet) ss.deleteSheet(dataSheet);
    dataSheet = ss.insertSheet('DB_RECORDS');

    // Prepare Headers: TeacherID, Name, ...DynamicColumns
    const headerIds = ['teacher_id', 'teacher_name', ...body.columns.map(c => c.id)];
    const headerTitles = ['ID (System)', 'Nama Guru', ...body.columns.map(c => c.title)];
    
    // Helper to find index
    const colMap = {};
    body.columns.forEach((c, idx) => colMap[c.id] = idx);

    // Prepare Rows
    const rows = [];
    rows.push(headerIds); // Row 1: System IDs (for mapping back)
    // Optional: Add a human readable header row? No, let's keep it simple for parsing. 
    // But to make it readable for user, let's actually make Row 1 IDs, and we can freeze it.
    
    body.teachers.forEach(t => {
      const row = [t.id, t.name];
      body.columns.forEach(c => {
        const val = body.data[t.id] ? body.data[t.id][c.id] : '';
        row.push(val || '');
      });
      rows.push(row);
    });

    if (rows.length > 0) {
      dataSheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      // Formatting
      dataSheet.setFrozenRows(1);
      dataSheet.setFrozenColumns(2);
      dataSheet.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#f3f4f6');
    }

    return responseJSON({ status: 'success' });

  } catch (err) {
    return responseJSON({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, currentUrl, onSaveUrl }) => {
  const [url, setUrl] = useState(currentUrl);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(GAS_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSaveUrl(url);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Sinkronisasi Google Sheet">
      <div className="space-y-6">
        
        {/* Step 1: Input URL */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            URL Web App (API Endpoint)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/..../exec"
              className="flex-1 rounded-md border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
            />
            <Button onClick={handleSave} disabled={!url} icon={<Cloud size={16} />}>
              Simpan & Sync
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Masukkan URL 'Web App' yang didapat setelah melakukan deploy pada Google Apps Script.
          </p>
        </div>

        <hr className="border-slate-100" />

        {/* Step 2: Instructions */}
        <div>
          <h3 className="text-md font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-500" />
            Panduan Instalasi API (Backend)
          </h3>
          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2 ml-1">
            <li>Buka <b>Google Sheets</b> baru di Google Drive Anda.</li>
            <li>Klik menu <b>Extensions</b> &gt; <b>Apps Script</b>.</li>
            <li>Hapus semua kode yang ada di file <code>Code.gs</code>.</li>
            <li>Salin kode di bawah ini dan tempelkan ke editor:</li>
          </ol>

          <div className="relative mt-2 mb-4">
            <div className="absolute top-2 right-2">
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded transition-colors border border-white/20"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Tersalin' : 'Salin Kode'}
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg text-xs overflow-x-auto h-48 font-mono custom-scrollbar">
              {GAS_CODE}
            </pre>
          </div>

          <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2 ml-1" start={5}>
            <li>Klik tombol <b>Save</b> (ikon disket).</li>
            <li>Klik tombol <b>Deploy</b> (kanan atas) &gt; <b>New deployment</b>.</li>
            <li>Pilih type: <b>Web app</b>.</li>
            <li>Isi Description (bebas).</li>
            <li>
                <span className="font-semibold text-slate-800">PENTING:</span> Pada <b>Who has access</b>, pilih <b className="text-indigo-600">Anyone</b> (Siapa saja).
            </li>
            <li>Klik <b>Deploy</b>. Salin URL yang diberikan (berakhiran <code>/exec</code>).</li>
            <li>Tempel URL tersebut ke kolom input di atas.</li>
          </ol>
        </div>
        
        <div className="bg-blue-50 p-3 rounded text-xs text-blue-700">
           <strong>Catatan:</strong> Data akan tersimpan di Sheet bernama <code>DB_RECORDS</code>. Jangan ubah struktur kolom di sheet tersebut secara manual jika tidak yakin. Gunakan aplikasi ini untuk menambah/mengedit kolom agar tetap sinkron.
        </div>
      </div>
    </Modal>
  );
};

export default SyncModal;