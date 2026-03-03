export interface DetailedScores {
  format: number;        // Hình thức (Max 1)
  scientific: number;    // Tính khoa học & thực tiễn (Max 1)
  novelty: number;       // Tính mới & sáng tạo (Max 3)
  applicability: number; // Khả năng áp dụng (Max 3)
  efficiency: number;    // Hiệu quả (Max 2)
  aiRisk?: string;       // Thấp/Trung bình/Cao
  similarity?: number;   // 0-100%
}

export interface Grade {
  id: string;
  initiativeId: string;
  judgeId: string;
  judgeName: string;
  score: number;
  detailedScores: DetailedScores;
  comment: string;
  date: string;
}

export interface Initiative {
  id: string;
  title: string;
  author: string;
  unit: string;
  score: number; // Final/Average score
  detailedScores?: DetailedScores; // AI score or final aggregated scores
  date: string;
  analysisResult: string;
  aiRisk?: string;
  similarity?: number;
  grades?: Grade[]; // Individual judge grades
}

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'judge' | 'oa';
  fullName: string;
}

export interface AppSettings {
  apiKey: string;
  model: string;
}

export type TabType = 'dashboard' | 'analysis' | 'repository' | 'settings' | 'users';
