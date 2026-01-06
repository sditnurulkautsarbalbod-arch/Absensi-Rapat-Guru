import { Column, Teacher, AttendanceData } from '../types';
import { INITIAL_COLUMNS, INITIAL_TEACHERS, INITIAL_DATA, INITIAL_TITLE } from '../constants';

const DB_NAME = 'AbsensiGuruDB';
const DB_VERSION = 1;
const STORE_NAME = 'appData';

const KEYS = {
  COLUMNS: 'columns',
  TEACHERS: 'teachers',
  DATA: 'data',
  TITLE: 'title',
};

// Helper to open Database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// Helper to get data
const getFromStore = (db: IDBDatabase, key: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Helper to put data
const putToStore = (db: IDBDatabase, key: string, value: any): Promise<void> => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const loadData = async () => {
  try {
    const db = await openDB();
    
    const [cols, teachers, data, title] = await Promise.all([
      getFromStore(db, KEYS.COLUMNS),
      getFromStore(db, KEYS.TEACHERS),
      getFromStore(db, KEYS.DATA),
      getFromStore(db, KEYS.TITLE),
    ]);

    return {
      columns: cols || INITIAL_COLUMNS,
      teachers: teachers || INITIAL_TEACHERS,
      data: data || INITIAL_DATA,
      title: title || INITIAL_TITLE,
    };
  } catch (e) {
    console.error("Failed to load data from IndexedDB", e);
    // Fallback to initial data if DB fails
    return {
      columns: INITIAL_COLUMNS,
      teachers: INITIAL_TEACHERS,
      data: INITIAL_DATA,
      title: INITIAL_TITLE,
    };
  }
};

export const saveData = async (columns: Column[], teachers: Teacher[], data: AttendanceData, title: string) => {
  try {
    const db = await openDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Perform all puts in one transaction for consistency
    store.put(columns, KEYS.COLUMNS);
    store.put(teachers, KEYS.TEACHERS);
    store.put(data, KEYS.DATA);
    store.put(title, KEYS.TITLE);

    return new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (e) {
    console.error("Failed to save data to IndexedDB", e);
  }
};