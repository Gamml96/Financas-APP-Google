import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { startOfDay, addMonths, subDays } from "date-fns";
import dotenv from "dotenv";

// Load environment variables immediately
dotenv.config();

// Initialize Firebase Admin
try {
  if (!getApps().length) {
    initializeApp();
    console.log("Firebase Admin Initialized successfully.");
  }
} catch (error) {
  console.error("Error initializing Firebase Admin:", error);
}

const app = express();
app.use(express.json());

const PORT = 3000;
const auth = getAuth();
const db = getFirestore();

// === INÍCIO DA ALTERAÇÃO PARA CHAVE DE API ===
// Authentication middleware that supports both Firebase ID tokens and direct API keys
const checkAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const apiKey = req.headers["x-api-key"];
  const authHeader = req.headers.authorization;

  // 1. Check API Key first
  const apiKeySecret = process.env.API_KEY_SECRET;
  if (apiKeySecret && apiKey === apiKeySecret) {
    // API key is valid. Allow the request to proceed.
    // Try to retrieve target UID from request body or header.
    const uid = req.body.uid || req.headers["x-uid"];
    (req as any).uid = uid;
    (req as any).authMethod = "apikey";
    return next();
  }

  // 2. Check Firebase ID Token
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await auth.verifyIdToken(token);
      (req as any).uid = decodedToken.uid;
      (req as any).authMethod = "firebase";
      return next();
    } catch (error) {
      console.error("Firebase Auth Token verification failed");
    }
  }

  // 3. Unauthorized response
  return res.status(401).json({
    error: "Não autorizado. Forneça um token Firebase válido ou uma chave de API no header x-api-key."
  });
};
// === FIM DA ALTERAÇÃO DA CHAVE DE API ===

function calculateDueDate(purchaseDate: Date, closingDay: number, dueDay: number): Date {
  const purchase = startOfDay(purchaseDate);                
  let candidateDueDate = new Date(purchase.getFullYear(), purchase.getMonth(), dueDay);
  
  const getClosingDate = (dDate: Date) => {
    let cDate = new Date(dDate.getFullYear(), dDate.getMonth(), closingDay);
    if (closingDay > dDate.getDate()) {
      cDate = addMonths(cDate, -1);
    }
    const dayOfWeek = cDate.getDay();
    if (dayOfWeek === 6) return subDays(cDate, 1);
    if (dayOfWeek === 0) return subDays(cDate, 2);
    return cDate;
  };

  // Simplified logic from frontend, needs to be robust
  // If purchase is after closing day, it belongs to the next month's invoice
  if (purchase.getDate() > closingDay) {
    candidateDueDate = addMonths(candidateDueDate, 1);
  }
  
  return candidateDueDate;
}

// API Route: /api/addExpense
app.post("/api/addExpense", checkAuth, async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) {
      return res.status(400).json({ error: "O campo uid é obrigatório para autenticação via chave de API." });
    }

    const { amount, description, category, accountId, date, paymentType, installment, totalInstallments } = req.body;

    if (!amount || amount <= 0 || !description || !category || !accountId || !date || !paymentType) {
      return res.status(400).json({ error: "Missing or invalid fields" });
    }

    // Verify account ownership
    const accountDoc = await db.doc(`users/${uid}/accounts/${accountId}`).get();
    if (!accountDoc.exists) {
        return res.status(400).json({ error: "Account not found or unauthorized" });
    }

    const accountData = accountDoc.data()!;
    let dueDate = null;

    if (paymentType === 'credit') {
        dueDate = calculateDueDate(new Date(date), accountData.closingDay, accountData.dueDay);
    }

    const transaction = {
        uid,
        amount,
        type: 'expense',
        description,
        category,
        accountId,
        date: Timestamp.fromDate(new Date(date)),
        paymentType,
        installment: installment || null,
        totalInstallments: totalInstallments || null,
        dueDate: dueDate ? Timestamp.fromDate(dueDate) : null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("transactions").add(transaction);

    res.status(201).json({ success: true, transactionId: docRef.id });

  } catch (error) {
    console.error("Error processing /api/addExpense:", error);
    res.status(500).json({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) });
  }
});

// API Route: /api/addIncome
app.post("/api/addIncome", checkAuth, async (req, res) => {
  try {
    const uid = (req as any).uid;
    if (!uid) {
      return res.status(400).json({ error: "O campo uid é obrigatório para autenticação via chave de API." });
    }

    const { amount, description, category, accountId, date } = req.body;

    if (!amount || amount <= 0 || !description || !category || !accountId || !date) {
      return res.status(400).json({ error: "Missing or invalid fields" });
    }

    // Verify account ownership
    const accountDoc = await db.doc(`users/${uid}/accounts/${accountId}`).get();
    if (!accountDoc.exists) {
        return res.status(400).json({ error: "Account not found or unauthorized" });
    }

    const transaction = {
        uid,
        amount,
        type: 'income',
        description,
        category,
        accountId,
        date: Timestamp.fromDate(new Date(date)),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("transactions").add(transaction);

    res.status(201).json({ success: true, transactionId: docRef.id });

  } catch (error) {
    console.error("Error processing /api/addIncome:", error);
    res.status(500).json({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) });
  }
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
