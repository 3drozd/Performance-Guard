import type { AppSummary, Session, ExportFormat } from '../types';

export const exportToCSV = (data: AppSummary[] | Session[], filename: string): void => {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvRows: string[] = [];

  // Add headers
  csvRows.push(headers.join(','));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const value = (row as unknown as Record<string, unknown>)[header];
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = String(value ?? '');
      if (stringValue.includes(',') || stringValue.includes('"')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
    csvRows.push(values.join(','));
  }

  const csvContent = csvRows.join('\n');
  downloadFile(csvContent, `${filename}.csv`, 'text/csv');
};

export const exportToJSON = (data: AppSummary[] | Session[], filename: string): void => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${filename}.json`, 'application/json');
};

export const exportData = (
  data: AppSummary[] | Session[],
  format: ExportFormat,
  filename: string
): void => {
  if (format === 'csv') {
    exportToCSV(data, filename);
  } else {
    exportToJSON(data, filename);
  }
};

const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
