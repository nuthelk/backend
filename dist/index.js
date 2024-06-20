"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const unzipper_1 = __importDefault(require("unzipper"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const app = (0, express_1.default)();
const port = 3000;
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
app.post("/upload", upload.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.file) {
        return res.status(400).send("No file uploaded.");
    }
    const file = req.file;
    const zipFilePath = path_1.default.join(__dirname, "/backend/src/uploads", file.originalname);
    console.log(zipFilePath);
    // Guardar el archivo en Firebase Storage
    const fileRef = bucket.file(file.originalname);
    yield fileRef.save(file.buffer);
    // Descomprimir el archivo y almacenar los nombres de los archivos en Firestore
    const tempDir = path_1.default.join(__dirname, "temp");
    if (!fs_1.default.existsSync(tempDir)) {
        fs_1.default.mkdirSync(tempDir, { recursive: true });
    }
    fs_1.default.createReadStream(zipFilePath)
        .pipe(unzipper_1.default.Extract({ path: tempDir }))
        .on("close", () => __awaiter(void 0, void 0, void 0, function* () {
        const files = fs_1.default.readdirSync(tempDir);
        const batch = db.batch();
        files.forEach((fileName) => {
            const fileRef = db.collection("files").doc();
            batch.set(fileRef, { fileName });
        });
        yield batch.commit();
        res.send({ message: "File uploaded and unzipped successfully." });
    }));
}));
// Endpoint para listar archivos
app.get("/files", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const snapshot = yield db.collection("files").get();
    const files = snapshot.docs.map((doc) => doc.data());
    res.send(files);
}));
// Endpoint para descargar un archivo
app.get("/download", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const fileName = req.query.file;
    const key = req.query.key; // Implementa tu lógica de validación de clave aquí
    if (key !== "your-secure-key") {
        return res.status(403).send("Forbidden");
    }
    const file = bucket.file(fileName);
    const [exists] = yield file.exists();
    if (!exists) {
        return res.status(404).send("File not found");
    }
    const tempFilePath = path_1.default.join(__dirname, "temp", fileName);
    yield file.download({ destination: tempFilePath });
    res.download(tempFilePath);
}));
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
