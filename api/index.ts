import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// In-Memory Store (Vercel-compatible replacement for SQLite)
// Data persists only during function warm time.
// ============================================================
interface Store {
  initiatives: any[];
  users: any[];
  grades: any[];
  settings: { apiKey: string; model: string } | null;
}

const store: Store = {
  initiatives: [],
  users: [
    { id: 'admin-1', username: 'admin', password: 'admin123', fullName: 'Quản trị viên', role: 'admin' },
    { id: 'judge-1', username: 'giamkhao1', password: '123', fullName: 'Nguyễn Văn A', role: 'judge' },
    { id: 'judge-2', username: 'giamkhao2', password: '123', fullName: 'Trần Thị B', role: 'judge' },
  ],
  grades: [],
  settings: null,
};

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth API
app.post("/api/login", (req, res) => {
  const { username: rawUsername, password: rawPassword } = req.body;
  const username = (rawUsername || '').trim();
  const password = (rawPassword || '').trim();

  const user = store.users.find(u => u.username === username && u.password === password);
  if (user) {
    const { password: _, ...safeUser } = user;
    res.json(safeUser);
  } else {
    res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
  }
});

// Users API
app.get("/api/users", (_req, res) => {
  const safeUsers = store.users.map(({ password: _, ...u }) => u);
  res.json(safeUsers);
});

app.post("/api/users", (req, res) => {
  try {
    const { id, username, password, fullName, role } = req.body;
    const idx = store.users.findIndex(u => u.id === id);
    if (idx !== -1) {
      const finalPassword = (password && password.trim() !== "") ? password : store.users[idx].password;
      store.users[idx] = { id, username, password: finalPassword, fullName, role };
    } else {
      store.users.push({ id, username, password, fullName, role });
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save user" });
  }
});

app.delete("/api/users/:id", (req, res) => {
  try {
    store.users = store.users.filter(u => u.id !== req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Initiatives API
app.get("/api/initiatives", (_req, res) => {
  try {
    const initiatives = store.initiatives.map(init => {
      const grades = store.grades.filter(g => g.initiativeId === init.id);
      return { ...init, grades };
    });
    res.json(initiatives);
  } catch (error) {
    console.error("Failed to fetch initiatives:", error);
    res.status(500).json({ error: "Failed to fetch initiatives" });
  }
});

app.post("/api/initiatives", (req, res) => {
  try {
    const initiative = req.body;
    const idx = store.initiatives.findIndex(i => i.id === initiative.id);
    if (idx !== -1) {
      store.initiatives[idx] = initiative;
    } else {
      store.initiatives.unshift(initiative);
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save initiative" });
  }
});

app.delete("/api/initiatives/:id", (req, res) => {
  try {
    store.initiatives = store.initiatives.filter(i => i.id !== req.params.id);
    store.grades = store.grades.filter(g => g.initiativeId !== req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete initiative" });
  }
});

// Grades API
app.post("/api/grades", (req, res) => {
  try {
    const grade = req.body;
    const idx = store.grades.findIndex(g => g.id === grade.id);
    if (idx !== -1) {
      store.grades[idx] = grade;
    } else {
      store.grades.push(grade);
    }

    // Recalculate initiative average score
    const allGrades = store.grades.filter(g => g.initiativeId === grade.initiativeId);
    if (allGrades.length > 0) {
      const avg = allGrades.reduce((acc, curr) => acc + curr.score, 0) / allGrades.length;
      const initIdx = store.initiatives.findIndex(i => i.id === grade.initiativeId);
      if (initIdx !== -1) {
        store.initiatives[initIdx].score = avg;
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save grade" });
  }
});

// Settings API
app.get("/api/settings", (_req, res) => {
  try {
    res.json(store.settings || { apiKey: "", model: "gemini-3.1-pro-preview" });
  } catch (error) {
    console.error("Failed to fetch settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/settings", (req, res) => {
  try {
    const { apiKey, model } = req.body;
    store.settings = { apiKey, model };
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// Local development server setup
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
  const setupDevServer = async () => {
    try {
      const viteModule = await import("vite");
      const createViteServer = viteModule.createServer;
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);

      const PORT = 3000;
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Development server running on http://localhost:${PORT}`);
      });
    } catch (e) {
      console.error("Vite not found, running without dev server middleware.");
    }
  };
  setupDevServer();
}

export default app;
