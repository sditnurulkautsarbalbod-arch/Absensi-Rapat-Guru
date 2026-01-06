import { Column, Teacher, AttendanceData } from '../types';

interface CloudData {
  columns: Column[];
  teachers: Teacher[];
  data: AttendanceData;
  title: string;
}

export const fetchFromCloud = async (scriptUrl: string): Promise<CloudData> => {
  try {
    const response = await fetch(scriptUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const json = await response.json();
    
    if (json.status === 'error') throw new Error(json.message);

    return {
      columns: json.data.columns,
      teachers: json.data.teachers,
      data: json.data.data,
      title: json.data.title
    };
  } catch (error) {
    console.error("Error fetching from Google Sheet:", error);
    throw error;
  }
};

export const saveToCloud = async (
  scriptUrl: string, 
  columns: Column[], 
  teachers: Teacher[], 
  data: AttendanceData, 
  title: string
): Promise<void> => {
  try {
    // We use no-cors mode in some cases, but for GAS Web App, 
    // we typically need to send data as stringified body.
    // Note: Fetching POST to GAS often has CORS issues depending on browser/setup.
    // The standard way is using text/plain to avoid preflight checks or ensuring GAS handles OPTIONS.
    
    const payload = {
      action: 'save',
      columns,
      teachers,
      data,
      title
    };

    const response = await fetch(scriptUrl, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (result.status !== 'success') {
      throw new Error(result.message || 'Unknown error saving to cloud');
    }

  } catch (error) {
    console.error("Error saving to Google Sheet:", error);
    throw error;
  }
};