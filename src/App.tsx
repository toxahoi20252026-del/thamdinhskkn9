/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// EduReview AI - Chuyên gia thẩm định sáng kiến kinh nghiệm
import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  Database,
  Settings,
  GraduationCap,
  CheckCircle,
  Clock,
  Star,
  FileText,
  Wand2,
  Loader2,
  Search,
  User as UserIcon,
  Building2,
  Calendar,
  Upload,
  FileDown,
  File as FileIcon,
  Copy,
  Check,
  Mic,
  MicOff,
  LogOut,
  Send,
  MessageSquare,
  X,
  Plus,
  Filter,
  ChevronRight,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType
} from 'docx';
import { saveAs } from 'file-saver';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.624/build/pdf.worker.min.mjs`;
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Initiative, AppSettings, TabType, DetailedScores, Grade, User as AppUser } from './types';
import { GeminiService, analyzeInitiative, chatWithExpert } from './services/geminiService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Safe environment variable access for Vite
const getEnvKey = () => {
  try {
    // @ts-ignore
    return (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined') ? (process.env.GEMINI_API_KEY as string) : '';
  } catch (e) {
    return '';
  }
};
// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("UI Crash caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-2xl flex items-center justify-center mb-6">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Đã xảy ra lỗi giao diện</h1>
          <p className="text-slate-500 max-w-md mb-8">Hệ thống gặp sự cố khi hiển thị nội dung này. Vui lòng thử tải lại trang hoặc bấm nút bên dưới.</p>
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8 max-w-lg overflow-auto">
            <p className="text-xs text-red-600 font-mono text-left">{this.state.error?.toString()}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 transition"
          >
            Tải lại trang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    const savedUser = localStorage.getItem('edu_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [settings, setSettings] = useState<AppSettings>({
    apiKey: getEnvKey(),
    model: 'gemini-3.1-pro-preview'
  });

  // Analysis state
  const [skTitle, setSkTitle] = useState('');
  const [skAuthor, setSkAuthor] = useState('');
  const [skUnit, setSkUnit] = useState('');
  const [skContent, setSkContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [currentDetailedScores, setCurrentDetailedScores] = useState<DetailedScores | null>(null);

  // Repository state
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingInitiative, setViewingInitiative] = useState<Initiative | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Judge state
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
  const [judgeScores, setJudgeScores] = useState<DetailedScores>({
    format: 0.8, scientific: 0.8, novelty: 2, applicability: 2, efficiency: 1.4
  });
  const [judgeComment, setJudgeComment] = useState('');

  // User management state
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'judge' as 'admin' | 'judge'
  });

  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCheckingServer, setIsCheckingServer] = useState(true);
  const [serverStatus, setServerStatus] = useState<'ok' | 'error' | 'checking'>('checking');

  // Load data from SQLite
  useEffect(() => {
    const fetchData = async (retries = 3) => {
      try {
        setIsCheckingServer(true);
        setServerStatus('checking');

        const fetchWithRetry = async (url: string, options?: RequestInit, count = 0): Promise<Response> => {
          try {
            const res = await fetch(url, options);
            if (!res.ok && count < retries) {
              await new Promise(r => setTimeout(r, 1000));
              return fetchWithRetry(url, options, count + 1);
            }
            return res;
          } catch (e) {
            if (count < retries) {
              await new Promise(r => setTimeout(r, 1000));
              return fetchWithRetry(url, options, count + 1);
            }
            throw e;
          }
        };

        const [initiativesRes, settingsRes, healthRes] = await Promise.all([
          fetchWithRetry('/api/initiatives').catch(() => null),
          fetchWithRetry('/api/settings').catch(() => null),
          fetchWithRetry('/api/health', {}, 1).catch(() => null)
        ]);

        if (healthRes && healthRes.ok) {
          setServerStatus('ok');
        } else {
          setServerStatus('error');
        }

        if (initiativesRes && initiativesRes.ok) {
          const data = await initiativesRes.json();
          setInitiatives(Array.isArray(data) ? data : []);
        }

        if (settingsRes && settingsRes.ok) {
          try {
            const savedSettings = await settingsRes.json();
            const envKey = getEnvKey();
            setSettings({
              apiKey: (savedSettings && savedSettings.apiKey) || envKey,
              model: (savedSettings && savedSettings.model) || 'gemini-3.1-pro-preview'
            });
          } catch (e) {
            console.error("Error parsing settings:", e);
          }
        }

        // Session check removed - using default admin user
      } catch (error) {
        console.error("Failed to fetch data from server:", error);
        setServerStatus('error');
      } finally {
        setIsCheckingServer(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (activeTab === 'users' && currentUser?.role === 'admin') {
      fetchUsers();
    }
  }, [activeTab, currentUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const newUser = {
      id: editingUser?.id || `user-${Date.now()}`,
      ...userForm
    };

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });

      if (res.ok) {
        fetchUsers();
        setIsUserModalOpen(false);
        setEditingUser(null);
        setUserForm({ username: '', password: '', fullName: '', role: 'judge' });
      }
    } catch (error) {
      alert("Lỗi khi lưu người dùng");
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa người dùng này?")) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchUsers();
      }
    } catch (error) {
      alert("Lỗi khi xóa người dùng");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        localStorage.setItem('edu_user', JSON.stringify(user));
      } else {
        const err = await res.json();
        setLoginError(err.error || 'Đăng nhập thất bại');
      }
    } catch (error) {
      setLoginError('Lỗi kết nối máy chủ');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('edu_user');
    setCurrentUser(null);
    setActiveTab('dashboard');
  };

  const handleJudgeSubmit = async () => {
    if (!selectedInitiative || !currentUser) return;

    const total = judgeScores.format + judgeScores.scientific + judgeScores.novelty + judgeScores.applicability + judgeScores.efficiency;

    const grade: Grade = {
      id: Date.now().toString(),
      initiativeId: selectedInitiative.id,
      judgeId: currentUser.id,
      judgeName: currentUser.fullName,
      score: total,
      detailedScores: judgeScores,
      comment: judgeComment,
      date: new Date().toLocaleDateString('vi-VN')
    };

    try {
      const res = await fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grade)
      });
      if (res.ok) {
        alert("Đã gửi điểm thành công!");
        setSelectedInitiative(null);
        // Refresh initiatives
        const initiativesRes = await fetch('/api/initiatives');
        const data = await initiativesRes.json();
        setInitiatives(data);
      }
    } catch (error) {
      alert("Lỗi khi gửi điểm");
    }
  };

  const filteredInitiatives = useMemo(() => {
    return initiatives.filter(i =>
      i.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      i.unit.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [initiatives, searchTerm]);

  const stats = useMemo(() => {
    const total = initiatives.length;
    const passed = initiatives.filter(i => i.score >= 5).length; // 5/10 is passing
    const pending = 0;
    const avg = total > 0 ? (initiatives.reduce((acc, curr) => acc + curr.score, 0) / total).toFixed(1) : '0.0';

    return { total, passed, pending, avg };
  }, [initiatives]);

  const radarData = useMemo(() => {
    if (!currentDetailedScores) return [];
    return [
      { subject: 'Hình thức', A: currentDetailedScores.format, fullMark: 1 },
      { subject: 'Khoa học', A: currentDetailedScores.scientific, fullMark: 1 },
      { subject: 'Tính mới', A: currentDetailedScores.novelty, fullMark: 3 },
      { subject: 'Áp dụng', A: currentDetailedScores.applicability, fullMark: 3 },
      { subject: 'Hiệu quả', A: currentDetailedScores.efficiency, fullMark: 2 },
    ];
  }, [currentDetailedScores]);

  const chartData = useMemo(() => {
    const categories = [
      { name: 'Giỏi (8+)', value: initiatives.filter(i => i.score >= 8).length, color: '#10B981' },
      { name: 'Khá (6.5-7.9)', value: initiatives.filter(i => i.score >= 6.5 && i.score < 8).length, color: '#6366F1' },
      { name: 'Đạt (5-6.4)', value: initiatives.filter(i => i.score >= 5 && i.score < 6.5).length, color: '#F59E0B' },
      { name: 'Không đạt (<5)', value: initiatives.filter(i => i.score < 5).length, color: '#F43F5E' },
    ].filter(c => c.value > 0);

    // If no data, show some dummy for visual
    if (categories.length === 0) {
      return [{ name: 'Chưa có dữ liệu', value: 1, color: '#cbd5e1' }];
    }

    return categories;
  }, [initiatives]);

  const barData = useMemo(() => {
    // Group by date (last 7 entries)
    return initiatives.slice(0, 7).reverse().map(i => ({
      name: i.title.length > 15 ? i.title.substring(0, 12) + '...' : i.title,
      id: i.id, // Stable unique key
      score: i.score
    }));
  }, [initiatives]);

  const parseScores = (text: string): { total: number, detailed: DetailedScores } => {
    const scoreBlock = text.match(/\[SCORES\]([\s\S]*?)\[\/SCORES\]/);
    if (!scoreBlock) return { total: 7, detailed: { format: 0.8, scientific: 0.8, novelty: 2, applicability: 2, efficiency: 1.4, aiRisk: 'Thấp', similarity: 10 } };

    const content = scoreBlock[1];
    const getVal = (regex: RegExp) => {
      const m = content.match(regex);
      return m ? parseFloat(m[1]) : 0;
    };

    const getStr = (regex: RegExp) => {
      const m = content.match(regex);
      return m ? m[1].trim() : '';
    };

    const detailed: DetailedScores = {
      format: getVal(/Hình thức:\s*([\d.]+)/),
      scientific: getVal(/Khoa học:\s*([\d.]+)/),
      novelty: getVal(/Tính mới:\s*([\d.]+)/),
      applicability: getVal(/Áp dụng:\s*([\d.]+)/),
      efficiency: getVal(/Hiệu quả:\s*([\d.]+)/),
      aiRisk: getStr(/AI_Risk:\s*(.*)/),
      similarity: getVal(/Similarity:\s*([\d.]+)/),
    };

    const total = getVal(/TỔNG ĐIỂM:\s*([\d.]+)/);
    return { total, detailed };
  };

  const handleRunAnalysis = async () => {
    // Force refresh env key
    const envKey = getEnvKey();
    const apiKey = settings.apiKey || envKey;

    if (!apiKey) {
      alert('Vui lòng cấu hình API Key trong mục Cài đặt.');
      setActiveTab('settings');
      return;
    }

    if (!skContent || !skContent.trim()) {
      alert('Vui lòng nhập nội dung hoặc tải tài liệu sáng kiến.');
      return;
    }

    const effectiveTitle = skTitle.trim() || "Sáng kiến tự động trích xuất";

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAnalysisError(null);
    setCurrentDetailedScores(null);

    try {
      const apiKey = settings.apiKey || envKey;

      // Get existing initiative titles for internal reference
      const existingTitles = initiatives.map(i => i.title).join(', ');
      const referenceContext = initiatives.length > 0
        ? `\nTHƯ VIỆN ĐỐI CHIẾU NỘI BỘ: Các sáng kiến đã có trong hệ thống: ${existingTitles}. Hãy kiểm tra xem sáng kiến hiện tại có trùng lặp hoặc kế thừa tốt từ các sáng kiến này không.`
        : "";

      const result = await analyzeInitiative(apiKey, effectiveTitle, skContent + referenceContext, skAuthor || 'Chưa rõ', skUnit || 'Trường TH&THCS Bãi Thơm', settings.model);

      if (result) {
        setAnalysisResult(result);
        const { total, detailed } = parseScores(result);
        setCurrentDetailedScores(detailed);

        const newInitiative: Initiative = {
          id: Date.now().toString(),
          title: effectiveTitle,
          author: skAuthor || 'Chưa rõ',
          unit: skUnit || 'Chưa rõ',
          score: total,
          detailedScores: detailed,
          date: new Date().toLocaleDateString('vi-VN'),
          analysisResult: result,
          aiRisk: detailed.aiRisk,
          similarity: detailed.similarity
        };

        // Save to SQLite
        await fetch('/api/initiatives', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newInitiative)
        });

        setInitiatives(prev => [newInitiative, ...prev]);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Lỗi không xác định';
      setAnalysisError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Set title from filename if empty
    if (!skTitle) {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      setSkTitle(fileNameWithoutExt);
    }

    setIsReadingFile(true);
    try {
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setSkContent(result.value);
      } else if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();

        // Ensure pdfjs is available
        if (!pdfjs || !pdfjs.getDocument) {
          throw new Error("Thư viện xử lý PDF chưa sẵn sàng. Vui lòng thử lại sau vài giây.");
        }

        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(arrayBuffer),
          useWorkerFetch: false,
          isEvalSupported: false
        });

        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str || '')
            .join(' ');
          fullText += pageText + '\n';
        }

        const trimmedText = fullText.trim();
        if (!trimmedText) {
          throw new Error("Không thể trích xuất văn bản từ file PDF này. File có thể là dạng ảnh quét (scan) hoặc file PDF được bảo mật.");
        }

        setSkContent(trimmedText);
      } else {
        alert('Chỉ hỗ trợ file .docx và .pdf');
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Lỗi khi đọc file. Vui lòng thử lại.');
    } finally {
      setIsReadingFile(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !analysisResult || !settings.apiKey) return;

    const userMsg = chatInput.trim();
    const newMessages = [...chatMessages, { role: 'user' as const, text: userMsg }];
    setChatMessages(newMessages);
    setChatInput('');
    setIsChatting(true);

    try {
      const envKey = getEnvKey();
      const apiKey = settings.apiKey || envKey;

      // Prepare history for Gemini API
      const history: { role: 'user' | 'model', parts: { text: string }[] }[] = [
        {
          role: 'user',
          parts: [{ text: `Đây là kết quả thẩm định sáng kiến mà bạn đã thực hiện: \n${analysisResult}\n\nBây giờ, hãy đóng vai chuyên gia thẩm định để trả lời các câu hỏi tiếp theo của tôi dựa trên kết quả này.` }]
        },
        {
          role: 'model',
          parts: [{ text: "Tôi đã hiểu. Tôi sẵn sàng giải đáp mọi thắc mắc của bạn về kết quả thẩm định này một cách chuyên nghiệp và tận tâm." }]
        }
      ];

      // Cap history to last 10 messages to keep request size small and fast
      const maxHistory = 10;
      const historyMessages = chatMessages.slice(-maxHistory);

      historyMessages.forEach(msg => {
        history.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });

      const response = await chatWithExpert(apiKey, history, userMsg, settings.model);
      if (response) {
        setChatMessages(prev => [...prev, { role: 'ai', text: response }]);
      }
    } catch (error: any) {
      console.error("Chat error:", error);
      const errorMsg = error.message && error.message.includes("thời gian")
        ? "Xin lỗi, yêu cầu của bạn bị quá thời gian. Vui lòng thử lại với nội dung ngắn hơn."
        : "Xin lỗi, tôi gặp lỗi khi kết nối. Vui lòng thử lại sau giây lát.";
      setChatMessages(prev => [...prev, { role: 'ai', text: errorMsg }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleCopyChat = () => {
    if (chatMessages.length === 0) return;

    const chatText = chatMessages.map(msg =>
      `${msg.role === 'user' ? 'Giáo viên' : 'Chuyên gia'}: ${msg.text}`
    ).join('\n\n');

    navigator.clipboard.writeText(chatText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  const toggleSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'vi-VN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setChatInput(prev => prev + (prev ? ' ' : '') + transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        alert("Vui lòng cấp quyền truy cập micrô để sử dụng tính năng này.");
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };

  const handleExportExcel = () => {
    try {
      const dataToExport = filteredInitiatives.map((i, idx) => ({
        'STT': idx + 1,
        'Tên sáng kiến': i.title,
        'Tác giả': i.author,
        'Đơn vị': i.unit,
        'Điểm TB': i.score.toFixed(1),
        'Ngày': i.date,
        'Đánh giá AI': i.analysisResult ? 'Đã thẩm định' : 'Chưa thẩm định'
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sáng kiến");

      // Generate buffer and save
      XLSX.writeFile(workbook, `Danh_sach_Sang_kien_${new Date().getTime()}.xlsx`);
    } catch (error) {
      console.error('Excel Export Error:', error);
      alert('Lỗi khi xuất file Excel. Vui lòng thử lại.');
    }
  };

  const handleDownloadReport = async (initiative?: Initiative) => {
    const target = initiative || {
      title: skTitle,
      author: skAuthor,
      unit: skUnit,
      analysisResult: analysisResult,
      score: currentDetailedScores ? (currentDetailedScores.format + currentDetailedScores.scientific + currentDetailedScores.novelty + currentDetailedScores.applicability + currentDetailedScores.efficiency) : 0,
      similarity: currentDetailedScores?.similarity || 0,
      grades: []
    };

    if (!target.analysisResult) return;

    const lines = target.analysisResult.split('\n');
    const docElements: any[] = [
      // Main Title
      new Paragraph({
        children: [
          new TextRun({
            text: "BÁO CÁO THẨM ĐỊNH SÁNG KIẾN KINH NGHIỆM",
            bold: true,
            size: 32,
            color: "2E75B5",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),

      // Info section
      new Paragraph({
        children: [
          new TextRun({ text: "Tên sáng kiến: ", bold: true, size: 30 }),
          new TextRun({ text: `“${target.title}”`, size: 30, bold: true }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Tác giả: ", bold: true, size: 30 }),
          new TextRun({ text: target.author || "Chưa rõ", size: 30 }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Đơn vị: ", bold: true, size: 30 }),
          new TextRun({ text: target.unit || "Chưa rõ", size: 30 }),
        ],
        spacing: { after: 120 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: "Ngày thẩm định: ", bold: true, size: 30 }),
          new TextRun({ text: new Date().toLocaleDateString('vi-VN'), size: 30 }),
        ],
        spacing: { after: 400 },
      }),

      // Section Header: NỘI DUNG THẨM ĐỊNH
      new Paragraph({
        children: [
          new TextRun({
            text: "NỘI DUNG THẨM ĐỊNH",
            bold: true,
            size: 28,
            color: "2E75B5",
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 300 },
      }),
    ];

    let currentTableRows: string[][] = [];

    const flushTable = () => {
      if (currentTableRows.length > 0) {
        docElements.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: currentTableRows.map((row, rowIndex) => {
            return new TableRow({
              children: row.map(cellText => {
                return new TableCell({
                  children: [new Paragraph({
                    children: [new TextRun({ text: cellText.replace(/[*_]/g, ''), size: 28, bold: rowIndex === 0 })],
                    alignment: AlignmentType.LEFT
                  })],
                  shading: rowIndex === 0 ? {
                    fill: "F1F5F9", // Slate 100
                    type: ShadingType.CLEAR,
                    color: "auto"
                  } : undefined,
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                    left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                    right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                  },
                  margins: { top: 100, bottom: 100, left: 100, right: 100 }
                });
              })
            });
          })
        }));
        docElements.push(new Paragraph({ text: "", spacing: { after: 200 } }));
        currentTableRows = [];
      }
    };

    const BLUE_COLOR = "2E75B5";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Improved table detection: check if line contains multiple | characters
      const pipeCount = (line.match(/\|/g) || []).length;
      if (pipeCount >= 2) {
        const cells = line.split('|')
          .map(c => c.trim())
          .filter((cell, index, array) => {
            // If it starts/ends with |, filter out the empty strings at ends
            if (index === 0 && cell === "" && line.startsWith('|')) return false;
            if (index === array.length - 1 && cell === "" && line.endsWith('|')) return false;
            return true;
          });

        const isSeparator = cells.every(cell => cell.match(/^-+$/) || cell.match(/^:?-+:?$/));

        if (!isSeparator && cells.length > 0) {
          currentTableRows.push(cells);
        }
        continue;
      } else {
        flushTable();
      }

      if (!line) {
        docElements.push(new Paragraph({ spacing: { after: 100 } }));
        continue;
      }

      // Remove unwanted symbols: *, #, and leading - or *
      const cleanLine = line.replace(/[*#]/g, '').replace(/^[-*]\s*/, '').trim();

      // Skip redundant header if it matches exactly (case insensitive)
      if (cleanLine.toUpperCase() === "NỘI DUNG THẨM ĐỊNH") continue;

      // Handle Section Headings (I., III., IV., V., VI.)
      const sectionMatch = cleanLine.match(/^([IVX]+\.\s+.*)/);
      if (sectionMatch) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({
              text: sectionMatch[1].toUpperCase(),
              bold: true,
              size: 28,
              color: BLUE_COLOR,
            }),
          ],
          spacing: { before: 300, after: 200 },
        }));
        continue;
      }

      // Handle Sub-headings (1., 2., 3.)
      const subHeadingMatch = cleanLine.match(/^(\d+\.\s+.*)/);
      if (subHeadingMatch) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({
              text: subHeadingMatch[1],
              bold: true,
              size: 30,
              color: BLUE_COLOR,
            }),
          ],
          spacing: { before: 200, after: 150 },
        }));
        continue;
      }

      // Handle Bold Labels (Ưu điểm:, Hạn chế:, Nghi vấn:, Trích dẫn bằng chứng:, Thay vì:, Nâng cấp:)
      const labelMatch = cleanLine.match(/^(Ưu điểm|Hạn chế|Nghi vấn|Trích dẫn bằng chứng|Thay vì|Nâng cấp|Logic và lập luận|Bằng chứng thực tế|Cấu trúc và Thể thức|Chính tả và Ngữ pháp|Sự khác biệt và giải pháp đột phá|Phạm vi lan tỏa|Tính khả thi|Hiệu quả định lượng|Hiệu quả định tính|Khóa học\/Kỹ năng|Hướng nghiên cứu|Chỉ số tin cậy|Phân tích):(.*)/i);
      if (labelMatch) {
        docElements.push(new Paragraph({
          children: [
            new TextRun({ text: labelMatch[1] + ":", bold: true, size: 28 }),
            new TextRun({ text: labelMatch[2], size: 28 }),
          ],
          spacing: { after: 120 },
          alignment: AlignmentType.JUSTIFIED,
          indent: { firstLine: 450 },
        }));
        continue;
      }

      // Handle Score lines (Điểm ...: X/Y)
      if (cleanLine.includes('Điểm') && cleanLine.includes('/')) {
        docElements.push(new Paragraph({
          children: [new TextRun({ text: cleanLine, bold: true, size: 28 })],
          spacing: { before: 100, after: 100 },
        }));
        continue;
      }

      // Normal text
      docElements.push(new Paragraph({
        children: [new TextRun({ text: cleanLine, size: 28 })],
        spacing: { after: 120 },
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 450 }
      }));
    }

    flushTable();

    // Add Score Summary Table at the end
    docElements.push(new Paragraph({
      children: [
        new TextRun({
          text: "[SCORES]",
          bold: true,
          size: 28,
          color: "FFFFFF", // Hidden text
        }),
      ],
      spacing: { before: 400 },
    }));

    // Council's Note
    if (target.score < 6.0 || (target.similarity && target.similarity > 20)) {
      docElements.push(new Paragraph({
        children: [
          new TextRun({ text: "LƯU Ý CỦA HỘI ĐỒNG: ", bold: true, size: 28 }),
          new TextRun({
            text: `Do Chỉ số đạo văn (Similarity) đạt mức ${target.similarity || 0}% ${target.similarity > 20 ? '(vượt ngưỡng 20%)' : ''} và mắc sai sót nghiêm trọng về thông tin địa phương cũng như mật độ lỗi chính tả quá cao (trên 10 lỗi), căn cứ theo quy tắc chấm điểm nghiêm ngặt, tổng điểm cuối cùng của sáng kiến bị khống chế và không đạt mức công nhận (Dưới 6.0 điểm). Tác giả cần nghiêm túc chỉnh sửa, cập nhật kiến thức địa phương và rà soát văn phong hành chính nếu có ý định nộp lại vào kỳ thẩm định sau.`,
            size: 28
          }),
        ],
        spacing: { before: 400, after: 400 },
        alignment: AlignmentType.JUSTIFIED,
      }));
    }

    // Final Scores Summary
    docElements.push(new Paragraph({
      children: [new TextRun({ text: "TỔNG ĐIỂM ĐÁNH GIÁ: ", bold: true, size: 28 })],
      spacing: { before: 400, after: 200 },
      alignment: AlignmentType.CENTER
    }));

    docElements.push(new Paragraph({
      children: [
        new TextRun({
          text: `${target.score.toFixed(1)}/10.0`,
          bold: true,
          size: 48,
          color: target.score >= 8 ? "228B22" : target.score >= 5 ? "FF8C00" : "FF0000"
        })
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }));

    // Signature Section
    docElements.push(new Paragraph({
      children: [
        new TextRun({ text: "An Giang, ngày ..... tháng ..... năm 2026", italics: true, size: 28 }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { before: 600, after: 100 },
    }));
    docElements.push(new Paragraph({
      children: [
        new TextRun({ text: "XÁC NHẬN CỦA HỘI ĐỒNG", bold: true, size: 28 }),
      ],
      alignment: AlignmentType.RIGHT,
      spacing: { after: 800 },
    }));

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: 1134,    // 2cm
              right: 1134,  // 2cm
              bottom: 1134, // 2cm
              left: 1701,   // 3cm
            },
          },
        },
        children: docElements,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Bao_cao_Tham_dinh_${target.title.replace(/\s+/g, '_')}.docx`);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const apiKey = formData.get('apiKey') as string;
    const model = formData.get('model') as string;

    const newSettings = { apiKey, model };

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });

      setSettings(newSettings);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      alert("Lỗi khi lưu cấu hình");
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4 relative overflow-hidden" translate="no">
        {/* Animated background elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              rotate: [0, 90, 0],
              opacity: [0.1, 0.2, 0.1]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-indigo-500 rounded-full blur-[120px]"
          />
          <motion.div
            animate={{
              scale: [1, 1.5, 1],
              rotate: [0, -90, 0],
              opacity: [0.05, 0.15, 0.05]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-pink-500 rounded-full blur-[120px]"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md relative z-10"
        >
          <div className="glass-card p-8 md:p-10 backdrop-blur-2xl border-white/20 shadow-2xl">
            <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 gradient-accent rounded-3xl flex items-center justify-center text-white text-3xl shadow-2xl shadow-indigo-500/40 mb-6 rotate-3">
                <GraduationCap size={40} />
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">EduReview AI</h1>
              <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px]">Hệ thống thẩm định sáng kiến</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-4">
                <div className="relative group">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                  <input
                    name="username"
                    type="text"
                    required
                    placeholder="Tài khoản"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                  />
                </div>
                <div className="relative group">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Mật khẩu"
                    className="w-full pl-12 pr-12 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {loginError && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center space-x-3"
                >
                  <AlertCircle size={18} className="text-red-500 shrink-0" />
                  <p className="text-red-600 text-xs font-bold leading-tight">{loginError}</p>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-4 gradient-accent text-white rounded-2xl font-black shadow-xl shadow-indigo-500/20 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-3 disabled:opacity-70 disabled:cursor-not-allowed group"
              >
                {isLoggingIn ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <>
                    <span className="uppercase tracking-widest text-sm">Đăng nhập</span>
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-10 pt-8 border-t border-slate-100 text-center">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Phân hiệu trường TH&THCS Bãi Thơm
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans" translate="no">
      {/* Sidebar */}
      <aside className="hidden md:flex w-72 gradient-bg flex-col sticky top-0 h-screen shadow-xl z-40 border-r border-yellow-200/50">
        <div className="p-8">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 gradient-accent rounded-2xl flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-500/20">
              <GraduationCap size={28} />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tighter text-slate-900 leading-none">EduReview</span>
              <span className="text-[9px] font-black text-indigo-600 uppercase tracking-[0.1em] mt-1.5 whitespace-nowrap">Trường TH&THCS Bãi Thơm</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-6 space-y-2 py-4">
          <SidebarItem
            icon={<LayoutDashboard size={20} />}
            label="Tổng quan"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <SidebarItem
            icon={<ShieldCheck size={20} />}
            label="Thẩm định AI"
            active={activeTab === 'analysis'}
            onClick={() => setActiveTab('analysis')}
          />
          <SidebarItem
            icon={<Database size={20} />}
            label="Kho sáng kiến"
            active={activeTab === 'repository'}
            onClick={() => setActiveTab('repository')}
          />
          {currentUser.role === 'admin' && (
            <SidebarItem
              icon={<UserIcon size={20} />}
              label="Người dùng"
              active={activeTab === 'users'}
              onClick={() => setActiveTab('users')}
            />
          )}
          <SidebarItem
            icon={<Settings size={20} />}
            label="Cấu hình hệ thống"
            subLabel={settings.model === 'gemini-3.1-pro-preview' ? 'Pro (Thông minh)' : 'Flash (Nhanh)'}
            active={activeTab === 'settings'}
            onClick={() => setActiveTab('settings')}
          />
        </nav>

        <div className="mt-auto p-6 border-t border-yellow-200/50">
          <div className="flex items-center space-x-3 mb-6 bg-white/40 p-3 rounded-2xl border border-white/40 shadow-sm backdrop-blur-sm">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
              <UserIcon size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-black text-slate-900 truncate">{currentUser.fullName}</span>
              <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                {currentUser.role === 'admin' ? 'Quản trị viên' : 'Giám khảo'}
              </span>
            </div>
          </div>
          <button
            onClick={() => confirm('Bạn có chắc chắn muốn đăng xuất?') && handleLogout()}
            className="w-full h-12 flex items-center justify-center space-x-2 bg-slate-900 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-slate-800 active:scale-[0.98] transition-all group"
          >
            <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 md:h-20 bg-[#FDF2F8]/90 backdrop-blur-md border-b border-pink-100/60 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto w-full h-full flex items-center justify-between px-4 md:px-10">
            <div className="flex flex-col">
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                {activeTab === 'dashboard' && 'Tổng quan'}
                {activeTab === 'analysis' && 'Thẩm định'}
                {activeTab === 'repository' && 'Kho sáng kiến'}
                {activeTab === 'settings' && 'Cấu hình'}
                {activeTab === 'users' && 'Người dùng'}
              </h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Hệ thống đang hoạt động • {settings.model === 'gemini-3.1-pro-preview' ? 'Gemini 3.1 Pro' : 'Gemini 3 Flash'}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-3 md:space-x-6">
              <button
                onClick={() => confirm('Bạn có chắc chắn muốn đăng xuất?') && handleLogout()}
                className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition"
                title="Đăng xuất"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 md:p-10 pb-24 md:pb-10 overflow-y-auto max-w-7xl mx-auto w-full">
          <AnimatePresence mode="popLayout">
            {/* ... rest of the tabs ... */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Welcome Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Xin chào!</h1>
                    <p className="text-slate-500 font-medium">Hệ thống EduReview AI đã sẵn sàng hỗ trợ bạn thẩm định sáng kiến.</p>
                  </div>
                  <div className="flex items-center space-x-2 text-sm font-bold text-slate-400 bg-slate-100 px-4 py-2 rounded-full">
                    <Calendar size={16} />
                    <span>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard icon={<FileText className="text-indigo-600" />} label="Tổng số sáng kiến" value={stats.total} bgColor="bg-indigo-50" />
                  <StatCard icon={<CheckCircle className="text-emerald-600" />} label="Đạt yêu cầu" value={stats.passed} bgColor="bg-emerald-50" />
                  <StatCard icon={<Clock className="text-amber-600" />} label="Đang chờ duyệt" value={stats.pending} bgColor="bg-amber-50" />
                  <StatCard icon={<Star className="text-violet-600" />} label="Điểm TB AI" value={stats.avg} bgColor="bg-violet-50" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Main Chart Area */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="glass-card p-6">
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Biểu đồ điểm số gần đây</h4>
                        <div className="flex items-center space-x-2">
                          <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Điểm tổng</span>
                        </div>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                              dataKey="name"
                              fontSize={10}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#94a3b8', fontWeight: 600 }}
                            />
                            <YAxis
                              domain={[0, 10]}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#94a3b8', fontWeight: 600 }}
                            />
                            <Tooltip
                              cursor={{ fill: '#f8fafc' }}
                              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                            />
                            <Bar dataKey="score" fill="#6366F1" radius={[8, 8, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Recent Initiatives Table */}
                    <div className="glass-card overflow-hidden">
                      <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                        <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Sáng kiến mới nhất</h4>
                        <button
                          onClick={() => setActiveTab('repository')}
                          className="text-xs font-bold text-primary hover:underline"
                        >
                          Xem tất cả
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50/50">
                            <tr>
                              <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên sáng kiến</th>
                              <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tác giả</th>
                              <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Điểm AI</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {initiatives.slice(0, 5).map((i) => (
                              <tr key={i.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <p className="text-sm font-bold text-slate-800 line-clamp-1">{i.title}</p>
                                  <p className="text-[10px] text-slate-400 font-medium">{i.date}</p>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 font-medium">{i.author}</td>
                                <td className="px-6 py-4 text-right">
                                  <span className={cn(
                                    "inline-block px-2 py-1 rounded-md text-[11px] font-black",
                                    i.score >= 8 ? "bg-green-100 text-green-700" :
                                      i.score >= 6.5 ? "bg-blue-100 text-blue-700" :
                                        i.score >= 5 ? "bg-orange-100 text-orange-700" :
                                          "bg-red-100 text-red-700"
                                  )}>
                                    {i.score.toFixed(1)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                            {initiatives.length === 0 && (
                              <tr>
                                <td colSpan={3} className="px-6 py-10 text-center text-slate-400 text-sm italic">
                                  Chưa có dữ liệu sáng kiến
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Stats Area */}
                  <div className="space-y-6">
                    <div className="glass-card p-6">
                      <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm mb-6">Phân loại chất lượng</h4>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={chartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={8}
                              dataKey="value"
                              stroke="none"
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-4 space-y-2">
                        {chartData.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs font-bold">
                            <div className="flex items-center space-x-2">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                              <span className="text-slate-500">{item.name}</span>
                            </div>
                            <span className="text-slate-900">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-indigo-500/20 rounded-full blur-2xl transition-transform duration-700 group-hover:scale-150"></div>
                      <h4 className="font-black uppercase tracking-tight text-sm mb-4 relative z-10">Thao tác nhanh</h4>
                      <div className="space-y-3 relative z-10">
                        <button
                          onClick={() => setActiveTab('analysis')}
                          className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 group/btn border border-white/5 hover:border-white/10"
                        >
                          <div className="flex items-center space-x-3">
                            <Wand2 size={18} className="text-indigo-400" />
                            <span className="text-sm font-bold">Thẩm định mới</span>
                          </div>
                          <ChevronRight size={14} className="opacity-0 group-hover/btn:opacity-100 transition-all -translate-x-2 group-hover/btn:translate-x-0" />
                        </button>
                        <button
                          onClick={() => setActiveTab('settings')}
                          className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300 group/btn border border-white/5 hover:border-white/10"
                        >
                          <div className="flex items-center space-x-3">
                            <Settings size={18} className="text-slate-400" />
                            <span className="text-sm font-bold">Cấu hình AI</span>
                          </div>
                          <ChevronRight size={14} className="opacity-0 group-hover/btn:opacity-100 transition-all -translate-x-2 group-hover/btn:translate-x-0" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'analysis' && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="glass-card p-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 space-y-4 md:space-y-0">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Thẩm định sáng kiến mới</h3>
                      <p className="text-sm text-slate-500">Dán nội dung để AI phân tích cấu trúc và tính mới</p>
                    </div>
                    <button
                      onClick={handleRunAnalysis}
                      disabled={isAnalyzing}
                      className="px-8 py-3 gradient-accent text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-100 hover:opacity-90 transition-all flex items-center justify-center disabled:opacity-50 tracking-widest uppercase"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="mr-2 animate-spin" size={18} />
                      ) : (
                        <Wand2 className="mr-2" size={18} />
                      )}
                      Chạy AI Phân Tích
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 space-y-4">
                      <div className="relative">
                        <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                          type="text"
                          value={skTitle}
                          onChange={(e) => setSkTitle(e.target.value)}
                          placeholder="Tên sáng kiến..."
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none transition"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input
                            type="text"
                            value={skAuthor}
                            onChange={(e) => setSkAuthor(e.target.value)}
                            placeholder="Tác giả"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary transition"
                          />
                        </div>
                        <div className="relative">
                          <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input
                            type="text"
                            value={skUnit}
                            onChange={(e) => setSkUnit(e.target.value)}
                            placeholder="Đơn vị"
                            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary transition"
                          />
                        </div>
                      </div>
                      <textarea
                        value={skContent}
                        onChange={(e) => setSkContent(e.target.value)}
                        placeholder="Nội dung sáng kiến..."
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none resize-none transition h-48 md:h-60"
                      ></textarea>

                      <div className="flex items-center space-x-3">
                        <label className="flex items-center space-x-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition text-sm font-medium border border-slate-200">
                          {isReadingFile ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          <span>Tải tài liệu (.docx, .pdf)</span>
                          <input
                            type="file"
                            accept=".docx,.pdf"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={isReadingFile}
                          />
                        </label>
                        <span className="text-[10px] text-slate-400 italic">Hệ thống sẽ tự động trích xuất văn bản từ file</span>
                      </div>
                    </div>

                    <div className="lg:col-span-7">
                      <div className={cn(
                        "rounded-xl p-6 h-full transition-all duration-500 relative min-h-[400px]",
                        analysisResult
                          ? "bg-white border border-slate-200 shadow-xl shadow-indigo-50/50"
                          : "bg-slate-50 border border-dashed border-slate-300"
                      )}>
                        {!isAnalyzing && !analysisResult && (
                          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60 absolute inset-0">
                            <Wand2 size={48} className="text-slate-300" />
                            <p>Kết quả thẩm định từ AI<br />sẽ hiển thị tại đây</p>
                          </div>
                        )}

                        {isAnalyzing && (
                          <div className="flex flex-col items-center justify-center h-full space-y-4 absolute inset-0">
                            <Loader2 className="text-primary animate-spin" size={48} />
                            <p className="text-primary font-medium">AI đang xử lý dữ liệu...</p>
                          </div>
                        )}

                        {!isAnalyzing && analysisError && (
                          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 absolute inset-0 p-8">
                            <AlertCircle size={48} className="text-red-400" />
                            <p className="text-red-600 font-bold text-base">Phân tích thất bại</p>
                            <p className="text-sm text-slate-500 bg-red-50 border border-red-100 rounded-lg p-3">{analysisError}</p>
                            <p className="text-xs text-slate-400">Vui lòng kiểm tra lại API Key trong mục Cấu hình hệ thống.</p>
                          </div>
                        )}

                        {analysisResult && (
                          <div className="h-full overflow-y-auto space-y-6">
                            {currentDetailedScores && (
                              <div className="space-y-4">
                                <div className="h-80 w-full bg-white rounded-xl border border-slate-100 p-2">
                                  <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                      <PolarGrid />
                                      <PolarAngleAxis dataKey="subject" fontSize={10} />
                                      <PolarRadiusAxis angle={30} domain={[0, 3]} fontSize={8} />
                                      <Radar
                                        name="Điểm số"
                                        dataKey="A"
                                        stroke="#6366F1"
                                        fill="#6366F1"
                                        fillOpacity={0.6}
                                      />
                                    </RadarChart>
                                  </ResponsiveContainer>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Rủi ro AI</p>
                                    <div className="flex items-center space-x-2">
                                      <div className={cn(
                                        "w-3 h-3 rounded-full",
                                        currentDetailedScores.aiRisk === 'Thấp' ? "bg-green-500" :
                                          currentDetailedScores.aiRisk === 'Trung bình' ? "bg-yellow-500" : "bg-red-500"
                                      )}></div>
                                      <span className="font-bold text-slate-700">{currentDetailedScores.aiRisk || 'Chưa rõ'}</span>
                                    </div>
                                  </div>
                                  <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Chỉ số đạo văn (Similarity)</p>
                                    <div className="flex items-center space-x-2">
                                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className={cn(
                                            "h-full transition-all duration-1000",
                                            (currentDetailedScores.similarity || 0) > 50 ? "bg-red-500" :
                                              (currentDetailedScores.similarity || 0) > 20 ? "bg-yellow-500" : "bg-green-500"
                                          )}
                                          style={{ width: `${currentDetailedScores.similarity || 0}%` }}
                                        ></div>
                                      </div>
                                      <span className="font-bold text-slate-700 text-sm">{currentDetailedScores.similarity || 0}%</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            <div className="prose prose-slate max-w-none text-base p-2">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysisResult}</ReactMarkdown>
                            </div>

                            <div className="flex justify-center pt-4 border-t border-slate-100">
                              <button
                                onClick={() => handleDownloadReport()}
                                className="flex items-center space-x-2 px-6 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-lg transition border border-slate-200 shadow-sm font-bold"
                              >
                                <FileDown size={18} className="text-primary" />
                                <span>Tải báo cáo .docx</span>
                              </button>
                            </div>

                            {/* Chat with Expert Section */}
                            <div className="mt-8 pt-6 border-t border-slate-200">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 gradient-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                                    <UserIcon size={16} />
                                  </div>
                                  <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Trợ lý đối thoại chuyên sâu</h4>
                                </div>

                                {chatMessages.length > 0 && (
                                  <button
                                    onClick={handleCopyChat}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition text-xs font-bold border border-slate-200"
                                    title="Sao chép nội dung hội thoại"
                                  >
                                    {isCopied ? (
                                      <>
                                        <Check size={14} className="text-green-500" />
                                        <span>Đã chép</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={14} />
                                        <span>Sao chép</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>

                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[300px] md:h-[400px]">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                                  {chatMessages.length === 0 && (
                                    <div className="text-center py-10 text-slate-400">
                                      <p className="text-sm italic">Bạn có thắc mắc về kết quả thẩm định?<br />Hãy đặt câu hỏi cho chuyên gia tại đây.</p>
                                    </div>
                                  )}
                                  {chatMessages.map((msg, idx) => (
                                    <div key={idx} className={cn(
                                      "flex",
                                      msg.role === 'user' ? "justify-end" : "justify-start"
                                    )}>
                                      <div className={cn(
                                        "max-w-[85%] p-3 rounded-2xl text-sm",
                                        msg.role === 'user'
                                          ? "bg-primary text-white rounded-tr-none"
                                          : "bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm"
                                      )}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                                      </div>
                                    </div>
                                  ))}
                                  {isChatting && (
                                    <div className="flex justify-start">
                                      <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-none shadow-sm">
                                        <Loader2 size={16} className="animate-spin text-primary" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
                                  <button
                                    onClick={toggleSpeechRecognition}
                                    className={cn(
                                      "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                      isRecording
                                        ? "bg-red-500 text-white animate-pulse"
                                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                                    )}
                                    title={isRecording ? "Đang nghe..." : "Nói để nhập văn bản"}
                                  >
                                    {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                                  </button>
                                  <input
                                    type="text"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                    placeholder={isRecording ? "Đang nghe..." : "Đặt câu hỏi cho chuyên gia..."}
                                    className="flex-1 px-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-primary outline-none transition"
                                  />
                                  <button
                                    onClick={handleSendMessage}
                                    disabled={isChatting || !chatInput.trim()}
                                    className="w-10 h-10 gradient-accent text-white rounded-full flex items-center justify-center hover:opacity-90 transition disabled:opacity-50 shadow-lg shadow-indigo-100"
                                  >
                                    <Wand2 size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'repository' && (
              <motion.div
                key="repository"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Kho sáng kiến kinh nghiệm</h3>
                    <p className="text-sm text-slate-500">Danh sách các sáng kiến đã được thẩm định trên hệ thống</p>
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center gap-4 w-full md:w-auto">
                    <button
                      onClick={handleExportExcel}
                      className="flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl hover:bg-emerald-100 transition font-bold"
                    >
                      <FileDown size={18} />
                      <span>Xuất Excel</span>
                    </button>
                    <div className="relative w-full md:w-72">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm kiếm sáng kiến..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-primary transition bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">STT</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tên sáng kiến</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tác giả</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm TB</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ngày</th>
                          <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInitiatives.length > 0 ? (
                          filteredInitiatives.map((i, idx) => (
                            <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                              <td className="p-4 text-sm text-slate-500">{idx + 1}</td>
                              <td className="p-4 text-sm font-medium text-slate-800">{i.title}</td>
                              <td className="p-4 text-sm text-slate-600">{i.author}</td>
                              <td className="p-4 text-sm">
                                <div className="flex flex-col">
                                  <span className={cn(
                                    "font-bold px-2 py-1 rounded text-xs w-fit",
                                    i.score >= 8 ? "bg-green-100 text-green-700" :
                                      i.score >= 6.5 ? "bg-blue-100 text-blue-700" :
                                        i.score >= 5 ? "bg-orange-100 text-orange-700" :
                                          "bg-red-100 text-red-700"
                                  )}>
                                    {i.score.toFixed(1)}/10
                                  </span>
                                  {i.grades && i.grades.length > 0 && (
                                    <span className="text-[10px] text-slate-400 mt-1">{i.grades.length} giám khảo đã chấm</span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-sm text-slate-500">
                                <div className="flex items-center">
                                  <Calendar size={14} className="mr-1" />
                                  {i.date}
                                </div>
                              </td>
                              <td className="p-4 text-sm">
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => setViewingInitiative(i)}
                                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                                    title="Xem chi tiết"
                                  >
                                    <Eye size={18} />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadReport(i)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                    title="Tải báo cáo"
                                  >
                                    <FileDown size={18} />
                                  </button>
                                  {currentUser.role === 'judge' && (
                                    <button
                                      onClick={() => {
                                        setSelectedInitiative(i);
                                        const myGrade = i.grades?.find(g => g.judgeId === currentUser.id);
                                        if (myGrade) {
                                          setJudgeScores(myGrade.detailedScores);
                                          setJudgeComment(myGrade.comment);
                                        } else {
                                          setJudgeScores({ format: 0.8, scientific: 0.8, novelty: 2, applicability: 2, efficiency: 1.4 });
                                          setJudgeComment('');
                                        }
                                      }}
                                      className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition"
                                      title="Chấm điểm"
                                    >
                                      <Star size={18} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-slate-400 italic">
                              {searchTerm ? 'Không tìm thấy sáng kiến phù hợp' : 'Chưa có dữ liệu sáng kiến nào'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'users' && currentUser?.role === 'admin' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Quản lý người dùng</h3>
                    <p className="text-sm text-slate-500">Thêm, sửa hoặc xóa tài khoản giám khảo và quản trị viên</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setUserForm({ username: '', password: '', fullName: '', role: 'judge' });
                      setIsUserModalOpen(true);
                    }}
                    className="flex items-center space-x-2 px-4 py-2 gradient-bg text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition"
                  >
                    <Plus size={18} />
                    <span>Thêm người dùng</span>
                  </button>
                </div>

                <div className="glass-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="p-4 text-sm font-bold text-slate-600">Họ và tên</th>
                          <th className="p-4 text-sm font-bold text-slate-600">Tài khoản</th>
                          <th className="p-4 text-sm font-bold text-slate-600">Vai trò</th>
                          <th className="p-4 text-sm font-bold text-slate-600 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50 transition">
                            <td className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                  <UserIcon size={16} />
                                </div>
                                <span className="text-sm font-bold text-slate-800">{u.fullName}</span>
                              </div>
                            </td>
                            <td className="p-4 text-sm text-slate-600">{u.username}</td>
                            <td className="p-4">
                              <span className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                                u.role === 'admin' ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                              )}>
                                {u.role === 'admin' ? 'Quản trị viên' : 'Giám khảo'}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  onClick={() => {
                                    setEditingUser(u);
                                    setUserForm({
                                      username: u.username,
                                      password: '', // Don't show password
                                      fullName: u.fullName,
                                      role: u.role as 'admin' | 'judge'
                                    });
                                    setIsUserModalOpen(true);
                                  }}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                >
                                  <Settings size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-xl mx-auto"
              >
                <div className="glass-card p-8 space-y-6">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-10 h-10 gradient-accent rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                      <Settings size={20} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Cấu hình hệ thống</h3>
                  </div>
                  <form onSubmit={handleSaveSettings} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Google Gemini API Key:</label>
                      <input
                        type="password"
                        name="apiKey"
                        defaultValue={settings.apiKey}
                        placeholder="Dán API Key của bạn..."
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary transition"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Lấy key tại <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-primary underline">AI Studio</a></p>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Model AI:</label>
                      <select
                        name="model"
                        defaultValue={settings.model}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-primary transition bg-white"
                      >
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Thông minh nhất)</option>
                        <option value="gemini-3-flash-preview">Gemini 3 Flash (Nhanh, ổn định)</option>
                        <option value="gemini-flash-latest">Gemini Flash Latest</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={isSaved}
                      className={cn(
                        "w-full py-4 text-white rounded-xl font-black shadow-xl transition transform active:scale-[0.98] flex items-center justify-center space-x-2 tracking-widest uppercase",
                        isSaved ? "bg-emerald-500 shadow-emerald-100" : "gradient-accent shadow-indigo-100 hover:opacity-90"
                      )}
                    >
                      {isSaved ? (
                        <>
                          <CheckCircle size={20} />
                          <span>Đã lưu thành công!</span>
                        </>
                      ) : (
                        <span>Lưu cấu hình</span>
                      )}
                    </button>
                  </form>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-200 flex justify-around py-2 px-2 z-50 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
        <MobileNavItem icon={<LayoutDashboard size={20} />} label="Tổng quan" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <MobileNavItem icon={<ShieldCheck size={20} />} label="Thẩm định" active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} />
        <MobileNavItem icon={<Database size={20} />} label="Kho SK" active={activeTab === 'repository'} onClick={() => setActiveTab('repository')} />
        {currentUser.role === 'admin' && (
          <MobileNavItem icon={<UserIcon size={20} />} label="User" active={activeTab === 'users'} onClick={() => setActiveTab('users')} />
        )}
        <MobileNavItem icon={<Settings size={20} />} label="Cấu hình" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
      </nav>

      {/* User Management Modal */}
      <AnimatePresence mode="wait">
        {isUserModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {editingUser ? 'Sửa người dùng' : 'Thêm người dùng mới'}
                </h3>
                <button onClick={() => setIsUserModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Họ và tên</label>
                  <input
                    type="text"
                    required
                    value={userForm.fullName}
                    onChange={(e) => setUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary transition"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tên đăng nhập</label>
                  <input
                    type="text"
                    required
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary transition"
                    placeholder="giamkhao1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Mật khẩu</label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={userForm.password}
                    onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary transition"
                    placeholder={editingUser ? "Để trống nếu không đổi" : "••••••••"}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Vai trò</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value as 'admin' | 'judge' }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary transition"
                  >
                    <option value="judge">Giám khảo</option>
                    <option value="admin">Quản trị viên</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full py-4 gradient-bg text-white rounded-xl font-black shadow-lg hover:opacity-90 transition"
                  >
                    {editingUser ? 'CẬP NHẬT' : 'TẠO TÀI KHOẢN'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Toast */}
      <AnimatePresence mode="wait">
        {isSaved && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-20 md:bottom-10 right-1/2 translate-x-1/2 md:right-10 md:translate-x-0 z-[100]"
          >
            <div className="bg-slate-800 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 border border-slate-700">
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <CheckCircle size={14} />
              </div>
              <span className="font-medium">Đã lưu cấu hình hệ thống!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Details Modal */}
      <AnimatePresence mode="wait">
        {viewingInitiative && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[120] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Chi tiết sáng kiến</h3>
                  <p className="text-sm text-slate-500 font-medium truncate max-w-[600px]">{viewingInitiative.title}</p>
                </div>
                <button onClick={() => setViewingInitiative(null)} className="p-2 hover:bg-slate-100 rounded-full transition">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Báo cáo thẩm định AI</h4>
                      <div className="prose prose-slate max-w-none text-sm">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewingInitiative.analysisResult}</ReactMarkdown>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Thông tin chung</h4>
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Tác giả</p>
                          <p className="text-sm font-bold text-slate-800">{viewingInitiative.author}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Đơn vị</p>
                          <p className="text-sm font-bold text-slate-800">{viewingInitiative.unit}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Ngày thẩm định</p>
                          <p className="text-sm font-bold text-slate-800">{viewingInitiative.date}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Điểm trung bình</p>
                          <p className="text-2xl font-black text-primary">{viewingInitiative.score.toFixed(1)}/10</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Đánh giá của giám khảo</h4>
                      <div className="space-y-4">
                        {viewingInitiative.grades && viewingInitiative.grades.length > 0 ? (
                          viewingInitiative.grades.map((g) => (
                            <div key={g.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-bold text-slate-800">{g.judgeName}</span>
                                <span className="text-xs font-black text-indigo-600">{g.score.toFixed(1)}</span>
                              </div>
                              <p className="text-[11px] text-slate-500 italic">"{g.comment || 'Không có nhận xét'}"</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400 italic">Chưa có giám khảo nào chấm điểm</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  onClick={() => handleDownloadReport(viewingInitiative)}
                  className="flex items-center space-x-2 px-6 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl hover:bg-blue-100 transition"
                >
                  <FileDown size={18} />
                  <span>Tải báo cáo</span>
                </button>
                <button
                  onClick={() => setViewingInitiative(null)}
                  className="px-8 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Grading Modal */}
      <AnimatePresence mode="wait">
        {selectedInitiative && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Thẩm định sáng kiến</h3>
                  <p className="text-sm text-slate-500 font-medium truncate max-w-[400px]">{selectedInitiative.title}</p>
                </div>
                <button onClick={() => setSelectedInitiative(null)} className="p-2 hover:bg-slate-100 rounded-full transition">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Tiêu chí chấm điểm</h4>

                    <ScoreInput
                      label="1. Hình thức (Max 1.0)"
                      value={judgeScores.format}
                      max={1}
                      step={0.1}
                      onChange={(v) => setJudgeScores(prev => ({ ...prev, format: v }))}
                    />
                    <ScoreInput
                      label="2. Khoa học & Thực tiễn (Max 1.0)"
                      value={judgeScores.scientific}
                      max={1}
                      step={0.1}
                      onChange={(v) => setJudgeScores(prev => ({ ...prev, scientific: v }))}
                    />
                    <ScoreInput
                      label="3. Tính mới & Sáng tạo (Max 3.0)"
                      value={judgeScores.novelty}
                      max={3}
                      step={0.25}
                      onChange={(v) => setJudgeScores(prev => ({ ...prev, novelty: v }))}
                    />
                    <ScoreInput
                      label="4. Khả năng áp dụng (Max 3.0)"
                      value={judgeScores.applicability}
                      max={3}
                      step={0.25}
                      onChange={(v) => setJudgeScores(prev => ({ ...prev, applicability: v }))}
                    />
                    <ScoreInput
                      label="5. Hiệu quả (Max 2.0)"
                      value={judgeScores.efficiency}
                      max={2}
                      step={0.2}
                      onChange={(v) => setJudgeScores(prev => ({ ...prev, efficiency: v }))}
                    />
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng kết</h4>
                    <div className="bg-slate-50 rounded-2xl p-6 flex flex-col items-center justify-center border border-slate-100">
                      <p className="text-sm font-bold text-slate-500 mb-2">Tổng điểm</p>
                      <div className="text-5xl font-black text-primary tracking-tighter">
                        {(judgeScores.format + judgeScores.scientific + judgeScores.novelty + judgeScores.applicability + judgeScores.efficiency).toFixed(1)}
                      </div>
                      <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Thang điểm 10</p>
                    </div>

                    <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Nhận xét của giám khảo</label>
                      <textarea
                        value={judgeComment}
                        onChange={(e) => setJudgeComment(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-primary transition text-sm"
                        placeholder="Nhập nhận xét chuyên môn..."
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex items-center justify-end space-x-3">
                <button
                  onClick={() => setSelectedInitiative(null)}
                  className="px-6 py-2.5 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleJudgeSubmit}
                  className="px-8 py-2.5 gradient-bg text-white font-bold rounded-xl shadow-lg hover:opacity-90 transition transform active:scale-[0.98]"
                >
                  Lưu kết quả
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreInput({ label, value, max, step, onChange }: { label: string, value: number, max: number, step: number, onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center">
        <label className="text-xs font-bold text-slate-600">{label}</label>
        <span className="text-xs font-black text-primary">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-primary"
      />
    </div>
  );
}

function SidebarItem({ icon, label, subLabel, active, onClick }: { icon: React.ReactNode, label: string, subLabel?: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center space-x-3 p-3.5 rounded-2xl transition-all duration-300 group relative",
        active
          ? "bg-white/60 text-indigo-900 font-bold shadow-sm border border-white/40"
          : "text-slate-600 hover:bg-white/30 hover:text-slate-900"
      )}
    >
      <div className={cn(
        "transition-transform duration-300 group-hover:scale-110",
        active ? "text-indigo-600" : "text-slate-500 group-hover:text-slate-700"
      )}>
        {icon}
      </div>
      <div className="flex flex-col items-start">
        <span className="text-sm tracking-tight">{label}</span>
        {subLabel && <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{subLabel}</span>}
      </div>
      {active && (
        <motion.div
          layoutId="sidebar-active"
          className="absolute left-0 w-1.5 h-6 bg-indigo-500 rounded-r-full"
        />
      )}
    </button>
  );
}

function MobileNavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center space-y-1 px-2 py-1 rounded-xl transition-all duration-300 min-w-[64px]",
        active ? "text-indigo-600" : "text-slate-400"
      )}
    >
      <div className={cn(
        "p-1.5 rounded-lg transition-all duration-300",
        active ? "bg-indigo-50" : ""
      )}>
        {icon}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-tight">{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value, bgColor }: { icon: React.ReactNode, label: string, value: string | number, bgColor: string }) {
  return (
    <div className="glass-card p-4 md:p-6 flex flex-col justify-between h-full group">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className={cn("p-2 md:p-3 rounded-xl md:rounded-2xl transition-all duration-500 group-hover:rotate-12 group-hover:scale-110 shadow-sm", bgColor)}>
          {icon}
        </div>
        <div className="flex items-center space-x-1.5 px-2 py-1 bg-slate-50 rounded-full border border-slate-100">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Live</span>
        </div>
      </div>
      <div>
        <p className="label-mono mb-2">{label}</p>
        <div className="flex items-baseline space-x-2">
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter value-technical">{value}</h3>
          {typeof value === 'number' && value > 0 && (
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">+12%</span>
          )}
        </div>
      </div>
    </div>
  );
}
