import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createPool } from "@vercel/postgres";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connect using custom prefix "KHO" env vars
const pool = createPool({
  connectionString: process.env.KHO_URL || process.env.POSTGRES_URL,
});
const sql = pool.sql;

const app = express();
app.use(express.json({ limit: "10mb" }));

// ============================================================
// Database Initialization
// ============================================================
async function initDb() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS initiatives (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT,
        unit TEXT,
        score DOUBLE PRECISION,
        detailed_scores JSONB,
        date TEXT,
        analysis_result TEXT,
        ai_risk TEXT,
        similarity DOUBLE PRECISION
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS grades (
        id TEXT PRIMARY KEY,
        initiative_id TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        score DOUBLE PRECISION,
        criteria_scores JSONB,
        comment TEXT,
        date TEXT
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        id INT PRIMARY KEY,
        api_key TEXT,
        model TEXT
      )
    `;

    // Default users
    const { rows } = await sql`SELECT * FROM users LIMIT 1`;
    if (rows.length === 0) {
      await sql`INSERT INTO users (id, username, password, full_name, role) VALUES ('admin-1', 'admin', 'admin123', 'Quản trị viên', 'admin')`;
      await sql`INSERT INTO users (id, username, password, full_name, role) VALUES ('judge-1', 'giamkhao1', '123', 'Nguyễn Văn A', 'judge')`;
      await sql`INSERT INTO users (id, username, password, full_name, role) VALUES ('judge-2', 'giamkhao2', '123', 'Trần Thị B', 'judge')`;
    }

    // Default settings
    const { rows: settingsRows } = await sql`SELECT * FROM settings WHERE id = 1`;
    if (settingsRows.length === 0) {
      await sql`INSERT INTO settings (id, api_key, model) VALUES (1, '', 'gemini-2.5-flash')`;
    }
  } catch (error) {
    console.warn("DB not ready or env vars missing. Skipping init.");
  }
}
initDb();

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Auth API
app.post("/api/login", async (req, res) => {
  const { username: rawUsername, password: rawPassword } = req.body;
  const username = (rawUsername || "").trim();
  const password = (rawPassword || "").trim();

  try {
    const { rows } = await sql`SELECT * FROM users WHERE username = ${username} AND password = ${password}`;
    const user = rows[0];
    if (user) {
      const { password: _, ...safeUser } = user;
      res.json({
        id: safeUser.id,
        username: safeUser.username,
        fullName: safeUser.full_name,
        role: safeUser.role,
      });
    } else {
      res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    }
  } catch (error) {
    res.status(500).json({ error: "DB Error" });
  }
});

// Users API
app.get("/api/users", async (_req, res) => {
  try {
    const { rows } = await sql`SELECT id, username, full_name as "fullName", role FROM users`;
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "DB Error" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const { id, username, password, fullName, role } = req.body;
    const { rows } = await sql`SELECT * FROM users WHERE id = ${id}`;
    if (rows.length > 0) {
      if (password && password.trim() !== "") {
        await sql`UPDATE users SET username = ${username}, password = ${password}, full_name = ${fullName}, role = ${role} WHERE id = ${id}`;
      } else {
        await sql`UPDATE users SET username = ${username}, full_name = ${fullName}, role = ${role} WHERE id = ${id}`;
      }
    } else {
      await sql`INSERT INTO users (id, username, password, full_name, role) VALUES (${id}, ${username}, ${password}, ${fullName}, ${role})`;
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to save user" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    await sql`DELETE FROM users WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// Initiatives API
app.get("/api/initiatives", async (_req, res) => {
  try {
    const { rows: initiatives } = await sql`SELECT * FROM initiatives ORDER BY date DESC`;
    const { rows: allGrades } = await sql`SELECT * FROM grades`;

    const result = initiatives.map((init) => {
      const grades = allGrades
        .filter((g) => g.initiative_id === init.id)
        .map((g) => ({
          id: g.id,
          initiativeId: g.initiative_id,
          userId: g.user_id,
          userName: g.user_name,
          score: g.score,
          criteriaScores: g.criteria_scores,
          comment: g.comment,
          date: g.date,
        }));
      return {
        id: init.id,
        title: init.title,
        author: init.author,
        unit: init.unit,
        score: init.score,
        detailedScores: init.detailed_scores,
        date: init.date,
        analysisResult: init.analysis_result,
        aiRisk: init.ai_risk,
        similarity: init.similarity,
        grades,
      };
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "DB Error" });
  }
});

app.post("/api/initiatives", async (req, res) => {
  try {
    const init = req.body;
    const { rows } = await sql`SELECT id FROM initiatives WHERE id = ${init.id}`;
    if (rows.length > 0) {
      await sql`
        UPDATE initiatives SET 
          title = ${init.title}, 
          author = ${init.author}, 
          unit = ${init.unit}, 
          score = ${init.score}, 
          detailed_scores = ${JSON.stringify(init.detailedScores)}, 
          date = ${init.date}, 
          analysis_result = ${init.analysisResult}, 
          ai_risk = ${init.aiRisk}, 
          similarity = ${init.similarity}
        WHERE id = ${init.id}
      `;
    } else {
      await sql`
        INSERT INTO initiatives (id, title, author, unit, score, detailed_scores, date, analysis_result, ai_risk, similarity)
        VALUES (${init.id}, ${init.title}, ${init.author}, ${init.unit}, ${init.score}, ${JSON.stringify(init.detailedScores)}, ${init.date}, ${init.analysisResult}, ${init.aiRisk}, ${init.similarity})
      `;
    }
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save initiative" });
  }
});

app.delete("/api/initiatives/:id", async (req, res) => {
  try {
    await sql`DELETE FROM initiatives WHERE id = ${req.params.id}`;
    await sql`DELETE FROM grades WHERE initiative_id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete initiative" });
  }
});

// Grades API
app.post("/api/grades", async (req, res) => {
  try {
    const grade = req.body;
    const { rows } = await sql`SELECT id FROM grades WHERE id = ${grade.id}`;
    if (rows.length > 0) {
      await sql`
        UPDATE grades SET 
          initiative_id = ${grade.initiativeId}, 
          user_id = ${grade.userId}, 
          user_name = ${grade.userName}, 
          score = ${grade.score}, 
          criteria_scores = ${JSON.stringify(grade.criteriaScores)}, 
          comment = ${grade.comment}, 
          date = ${grade.date}
        WHERE id = ${grade.id}
      `;
    } else {
      await sql`
        INSERT INTO grades (id, initiative_id, user_id, user_name, score, criteria_scores, comment, date)
        VALUES (${grade.id}, ${grade.initiativeId}, ${grade.userId}, ${grade.userName}, ${grade.score}, ${JSON.stringify(grade.criteriaScores)}, ${grade.comment}, ${grade.date})
      `;
    }

    // Recalculate initiative average score
    const { rows: initiativeGrades } = await sql`SELECT score FROM grades WHERE initiative_id = ${grade.initiativeId}`;
    if (initiativeGrades.length > 0) {
      const avg = initiativeGrades.reduce((acc, curr) => acc + curr.score, 0) / initiativeGrades.length;
      await sql`UPDATE initiatives SET score = ${avg} WHERE id = ${grade.initiativeId}`;
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to save grade" });
  }
});

// Settings API
app.get("/api/settings", async (_req, res) => {
  try {
    const { rows } = await sql`SELECT api_key as "apiKey", model FROM settings WHERE id = 1`;
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.json({ apiKey: "", model: "gemini-2.5-flash" });
    }
  } catch (error) {
    res.status(500).json({ error: "DB Error" });
  }
});

app.post("/api/settings", async (req, res) => {
  try {
    const { apiKey, model } = req.body;
    await sql`UPDATE settings SET api_key = ${apiKey}, model = ${model} WHERE id = 1`;
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
