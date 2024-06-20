const multer = require("multer");
const admin = require("firebase-admin");
const unzipper = require("unzipper");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const express = require("express");
const app = express();
const port = 4000;
app.use(cors());

app.use(
  cors({
    origin: "https://pruebatecnica-8a9f9.web.app/",
  })
);

// Inicializar Firebase Admin SDK
const serviceAccount = require("../config/serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "pruebatecnica-8a9f9.appspot.com",
});
const db = admin.firestore();
const bucket = admin.storage().bucket();

// Configuración de multer para subir archivos
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Endpoint para subir archivo ZIP
app.post(
  "/upload",
  upload.single("file"),
  async (
    req: any,
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        send: { (arg0: string): any; new (): any };
      };
      send: (arg0: { message: string }) => void;
    }
  ) => {
    if (!req.file) {
      return res.status(400).send("No file uploaded.");
    }

    const file = req.file!;

    // Guardar el archivo ZIP en Firebase Storage
    const zipFileRef = bucket.file(file.originalname);
    await zipFileRef.save(file.buffer);

    // Descomprimir el archivo y subir los archivos descomprimidos a Firebase Storage
    const zipFile = await unzipper.Open.buffer(file.buffer);
    const files = zipFile.files.map((file: { path: any }) => file.path);

    const batch = db.batch();

    for (const filePath of files) {
      const fileName = path.basename(filePath);
      const fileContent = await zipFile.files
        .find((f: { path: any }) => f.path === filePath)
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
  }
);

// Endpoint para listar archivos
app.get("/files", async (_req: any, res: { send: (arg0: any[]) => void }) => {
  const snapshot = await db.collection("files").get();
  const files = snapshot.docs.map((doc: { data: () => any }) => doc.data());
  res.send(files);
});

// Endpoint para descargar un archivo
app.get(
  "/download",
  async (
    req: { query: { file: string; key: string } },
    res: {
      status: (arg0: number) => {
        (): any;
        new (): any;
        send: { (arg0: string): void; new (): any };
      };
      download: (arg0: string) => void;
    }
  ) => {
    const fileName = req.query.file as string;
    const key = req.query.key as string;

    if (key !== "123") {
      return res.status(403).send("Acceso denegado");
    }

    const file = bucket.file(fileName);

    try {
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).send("Archivo no encontrado");
      }

      const tempFilePath = path.join(__dirname, "temp", fileName);
      await file.download({ destination: tempFilePath });
      res.download(tempFilePath);
    } catch (error) {
      console.error("Error al descargar el archivo:", error);
      res.status(500).send("Error interno del servidor");
    }
  }
);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
