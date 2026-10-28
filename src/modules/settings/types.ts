export interface ExcludedNumber {
  id: string;
  phone: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface ImportResult {
  added: number;
  updated: number;
  invalid: { row: number; value: string }[];
  invalidCount: number;
}

/** A picked file, as expo-document-picker hands it back on each platform. */
export interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  file?: File;
}
