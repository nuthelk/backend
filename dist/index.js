"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const unzipper_1 = __importDefault(require("unzipper"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const cors_1 = __importDefault(require("cors"));
const app = (0, express_1.default)();
const port = 3000;
app.use((0, cors_1.default)());
app.use((0, cors_1.default)({
    origin: "https://pruebatecnica-8a9f9.web.app/",
}));
// Inicializar Firebase Admin SDK
const serviceAccount = require("../config/serviceAccountKey.json");
firebase_admin_1.default.initializeApp({
    credential: firebase_admin_1.default.credential.cert(serviceAccount),
    storageBucket: "pruebatecnica-8a9f9.appspot.com",
});
const db = firebase_admin_1.default.firestore();
const bucket = firebase_admin_1.default.storage().bucket();
// Configuración de multer para subir archivos
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({ storage });
// Endpoint para subir archivo ZIP
app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).send("No file uploaded.");
    }
    const file = req.file;
    // Guardar el archivo ZIP en Firebase Storage
    const zipFileRef = bucket.file(file.originalname);
    await zipFileRef.save(file.buffer);
    // Descomprimir el archivo y subir los archivos descomprimidos a Firebase Storage
    const zipFile = await unzipper_1.default.Open.buffer(file.buffer);
    const files = zipFile.files.map((file) => file.path);
    const batch = db.batch();
    for (const filePath of files) {
        const fileName = path_1.default.basename(filePath);
        const fileContent = await zipFile.files
            .find((f) => f.path === filePath)
            ?.buffer();
        if (fileContent) {
            const fileRef = bucket.file(fileName);
            await fileRef.save(fileContent);
            const firestoreRef = db.collection("files").doc();
            batch.set(firestoreRef, { fileName });
        }
    }
    await batch.commit();
    res.send({ message: "File uploaded and processed successfully." });
});
// Endpoint para listar archivos
app.get("/files", async (req, res) => {
    const snapshot = await db.collection("files").get();
    const files = snapshot.docs.map((doc) => doc.data());
    res.send(files);
});
// Endpoint para descargar un archivo
app.get("/download", async (req, res) => {
    const fileName = req.query.file;
    const key = req.query.key;
    if (key !== "123") {
        return res.status(403).send("Acceso denegado");
    }
    const file = bucket.file(fileName);
    try {
        const [exists] = await file.exists();
        if (!exists) {
            return res.status(404).send("Archivo no encontrado");
        }
        const tempFilePath = path_1.default.join(__dirname, "temp", fileName);
        await file.download({ destination: tempFilePath });
        res.download(tempFilePath);
    }
    catch (error) {
        console.error("Error al descargar el archivo:", error);
        res.status(500).send("Error interno del servidor");
    }
});
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
